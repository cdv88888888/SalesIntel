import { BigQuery } from '@google-cloud/bigquery';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { unstable_cache } from 'next/cache';
import { ALL_SEGMENT, BASE_SEGMENTS } from './segments';
import { assessAccounts, subtractMonths, toIsoDate, WINDOW_MONTHS } from './cadence';

let bqClient = null;
let resolvedCredentials;

/**
 * Resolve the BigQuery service-account credentials at runtime, WITHOUT a
 * build-time dependency on a git-ignored file. Resolution order:
 *   1. BQ_CREDENTIALS_JSON / GOOGLE_SERVICE_ACCOUNT_JSON env var (raw JSON or base64)
 *   2. ./bq-credentials.json on disk (local dev), read lazily at runtime
 *   3. null -> fall back to Application Default Credentials
 *
 * Returning null (rather than a hard import) keeps the production build from
 * failing when the credentials file is absent from the CI checkout.
 */
function loadBigQueryCredentials() {
  if (resolvedCredentials !== undefined) return resolvedCredentials;

  const raw = process.env.BQ_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    try {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      resolvedCredentials = JSON.parse(text);
      return resolvedCredentials;
    } catch (err) {
      console.error('[BIGQUERY] Failed to parse credentials from environment:', err.message);
    }
  }

  try {
    const filePath = path.join(process.cwd(), 'bq-credentials.json');
    if (existsSync(filePath)) {
      resolvedCredentials = JSON.parse(readFileSync(filePath, 'utf8'));
      return resolvedCredentials;
    }
  } catch (err) {
    console.error('[BIGQUERY] Failed to read local bq-credentials.json:', err.message);
  }

  resolvedCredentials = null;
  return resolvedCredentials;
}

let cachedMonths = null;
let cachedMonthsTime = 0;
const MONTHS_CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

let cachedDealers = {};
let cachedDealersTime = {};
const DEALERS_CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours

export function getBigQueryClient() {
  if (!bqClient) {
    const credentials = loadBigQueryCredentials();
    const projectId =
      (credentials && credentials.project_id) ||
      process.env.BQ_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      undefined;

    if (credentials && credentials.client_email && credentials.private_key) {
      bqClient = new BigQuery({
        projectId,
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
      });
    } else {
      // No explicit service-account credentials found: rely on Application
      // Default Credentials. BigQuery-backed pages will error at request time
      // if ADC is unavailable, but the build and non-BigQuery routes still work.
      console.warn('[BIGQUERY] No service-account credentials found; falling back to Application Default Credentials.');
      bqClient = new BigQuery(projectId ? { projectId } : {});
    }
  }
  return bqClient;
}

async function _getAvailableMonths() {
  const now = Date.now();
  if (cachedMonths && (now - cachedMonthsTime < MONTHS_CACHE_TTL)) {
    return cachedMonths;
  }
  const bq = getBigQueryClient();
  const query = `
    SELECT DISTINCT 
      EXTRACT(YEAR FROM Date) as year, 
      EXTRACT(MONTH FROM Date) as month 
    FROM \`accounts-recieva.SALES.SALES2023\` 
    WHERE Date IS NOT NULL
    ORDER BY year DESC, month DESC
  `;
  const [rows] = await bq.query({ query });
  cachedMonths = rows;
  cachedMonthsTime = now;
  return rows;
}

let cachedCompleteMonth = null;
let cachedCompleteMonthTime = 0;

// The newest month the dataset covers in full. The most recent month in the
// table is usually still being written to, so comparing it against whole
// months (or against the same month a year ago) understates it badly.
async function _getLatestCompleteMonth() {
  const now = Date.now();
  if (cachedCompleteMonth && (now - cachedCompleteMonthTime < MONTHS_CACHE_TTL)) {
    return cachedCompleteMonth;
  }
  const bq = getBigQueryClient();
  const query = `
    WITH Bounds AS (
      SELECT MAX(Date) as maxDate
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date IS NOT NULL
    )
    SELECT
      -- Complete when the data reaches the last day of its own month;
      -- otherwise the month before it is the newest complete one.
      IF(maxDate = LAST_DAY(maxDate, MONTH),
         maxDate,
         DATE_SUB(DATE_TRUNC(maxDate, MONTH), INTERVAL 1 DAY)) as completeThrough
    FROM Bounds
  `;
  const [rows] = await bq.query({ query });
  const value = rows?.[0]?.completeThrough;
  // BigQuery hands DATE columns back as { value: 'YYYY-MM-DD' }.
  const iso = typeof value === 'string' ? value : value?.value;
  if (!iso) return null;
  const [year, month] = iso.split('-').map(Number);
  cachedCompleteMonth = { year, month, period: `${year}-${String(month).padStart(2, '0')}` };
  cachedCompleteMonthTime = now;
  return cachedCompleteMonth;
}

const SEGMENT_CHANNELS = {
  dealer: ["MGSA", "MARKETER", "DEALER", "CODO", "DEALER - COBANKIAT", "DEALER-EXMARKETER", "RETAIL"],
  commercial: ["COMMERCIAL", "commercial", "Commercial", "PHILGEPS", "philgeps"],
  bulk: ["BULK", "bulk", "Bulk"],
};

// How many customers each concrete segment contributes to a listing. Applied
// per segment (not to the whole result) so the "all" view is exactly the union
// of the Dealer, Commercial and Bulk views rather than a truncation of them.
const TOP_CUSTOMERS_PER_SEGMENT = 100;

function quoteChannels(channels) {
  return channels.map(c => `"${c}"`).join(', ');
}

function channelsFor(segment) {
  if (segment === ALL_SEGMENT) {
    return BASE_SEGMENTS.flatMap(s => SEGMENT_CHANNELS[s]);
  }
  // Own-property check only: an arbitrary string (e.g. "__proto__") must fall
  // back to dealer, not resolve to something off Object.prototype.
  return Object.hasOwn(SEGMENT_CHANNELS, segment)
    ? SEGMENT_CHANNELS[segment]
    : SEGMENT_CHANNELS.dealer;
}

function getChannelFilterString(segment) {
  // "all" selects the union of every known segment's channels.
  return `AND Channel IN (${quoteChannels(channelsFor(segment))})`;
}

// SQL expression mapping a row's Channel back to its segment id, so a listing
// can be ranked within each segment.
function getSegmentExpression() {
  const whens = BASE_SEGMENTS
    .map(s => `WHEN Channel IN (${quoteChannels(SEGMENT_CHANNELS[s])}) THEN "${s}"`)
    .join(' ');
  return `CASE ${whens} ELSE "other" END`;
}

async function _getAvailableDealers(segment = 'dealer') {
  const now = Date.now();
  if (cachedDealers[segment] && (now - cachedDealersTime[segment] < DEALERS_CACHE_TTL)) {
    return cachedDealers[segment];
  }
  const bq = getBigQueryClient();
  const channelFilter = getChannelFilterString(segment);
  const query = `
    SELECT Customer_No_ as id, MAX(Customer_Name) as name
    FROM \`accounts-recieva.SALES.SALES2023\`
    WHERE Customer_No_ IS NOT NULL
      ${channelFilter}
    GROUP BY Customer_No_
    ORDER BY name ASC
  `;
  const [rows] = await bq.query({ query });
  cachedDealers[segment] = rows;
  cachedDealersTime[segment] = now;
  return rows;
}

let cachedTrend = {};
let cachedTrendTime = {};
const TREND_CACHE_TTL = 1000 * 60 * 60 * 2;

async function _getTrendData(startPeriod, endPeriod, segment = 'dealer') {
  const now = Date.now();
  const cacheKey = `${startPeriod}-${endPeriod}-${segment}`;
  if (cachedTrend[cacheKey] && (now - cachedTrendTime[cacheKey] < TREND_CACHE_TTL)) {
    return cachedTrend[cacheKey];
  }
  const bq = getBigQueryClient();
  
  const startYear = startPeriod.split('-')[0];
  const endYear = endPeriod.split('-')[0];
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;

  const channelFilter = getChannelFilterString(segment);

  const query = `
    SELECT 
      EXTRACT(YEAR FROM Date) as year,
      EXTRACT(MONTH FROM Date) as month,
      SUM(Total_KGS_Sold) as totalKgs
    FROM \`accounts-recieva.SALES.SALES2023\`
    WHERE Date BETWEEN CAST(@startDate AS DATE) AND CAST(@endDate AS DATE)
      ${channelFilter}
    GROUP BY year, month
    ORDER BY year ASC, month ASC
  `;
  const [rows] = await bq.query({ query, params: { startDate, endDate } });
  cachedTrend[cacheKey] = rows;
  cachedTrendTime[cacheKey] = now;
  return rows;
}

function getPeriodBoundaries(startPeriod, endPeriod) {
  const startDate = `${startPeriod}-01`;
  const [endYear, endMonth] = endPeriod.split('-');
  const endYearInt = parseInt(endYear);
  const endMonthInt = parseInt(endMonth);
  const nextMonthFirstDay = new Date(Date.UTC(endYearInt, endMonthInt, 1));
  const lastDay = new Date(nextMonthFirstDay.getTime() - 86400000);
  const endDate = lastDay.toISOString().split('T')[0];
  return { startDate, endDate };
}

let cachedAggregates = {};
let cachedAggregatesTime = {};
const AGGREGATES_CACHE_TTL = 1000 * 60 * 60 * 2;

async function _getDealerAggregates(startPeriod, endPeriod, customerIds = [], segment = 'dealer') {
  const now = Date.now();
  const cacheKey = `${startPeriod}-${endPeriod}-${segment}-${customerIds.join(',')}`;
  if (cachedAggregates[cacheKey] && (now - cachedAggregatesTime[cacheKey] < AGGREGATES_CACHE_TTL)) {
    return cachedAggregates[cacheKey];
  }
  const bq = getBigQueryClient();
  
  const { startDate, endDate } = getPeriodBoundaries(startPeriod, endPeriod);
  
  const [startYear, startMonth] = startPeriod.split('-');
  const [endYear, endMonth] = endPeriod.split('-');
  const prevStartPeriod = `${parseInt(startYear) - 1}-${startMonth}`;
  const prevEndPeriod = `${parseInt(endYear) - 1}-${endMonth}`;
  const { startDate: prevStartDate, endDate: prevEndDate } = getPeriodBoundaries(prevStartPeriod, prevEndPeriod);

  const customerFilter = customerIds.length > 0 ? `AND (Customer_No_ IN UNNEST(@customerIds) OR UPPER(Customer_Name) IN UNNEST(@customerIds))` : ``;
  const channelFilter = getChannelFilterString(segment);

  const query = `
    WITH PerSegment AS (
      SELECT
        Customer_No_ as id,
        ${getSegmentExpression()} as segment,
        MAX(Customer_Name) as name,
        MAX(Classification) as classification,
        SUM(Total_KGS_Sold) as kgsSold,
        SUM(Net_Sales_Amount) as netSales
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date BETWEEN CAST(@startDate AS DATE) AND CAST(@endDate AS DATE)
      ${customerFilter}
      ${channelFilter}
      GROUP BY id, segment
    ),
    RankedPerSegment AS (
      SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY segment ORDER BY kgsSold DESC) as segmentRank
      FROM PerSegment
    ),
    -- Top N of each segment, then folded back to one row per customer. For a
    -- single segment this is the plain top N; for "all" it is the union of the
    -- three segment listings, so its totals reconcile with them.
    TopDealers AS (
      SELECT
        id,
        MAX(name) as name,
        MAX(classification) as classification,
        SUM(kgsSold) as kgsSold,
        SUM(netSales) as netSales
      FROM RankedPerSegment
      WHERE segmentRank <= ${TOP_CUSTOMERS_PER_SEGMENT}
      GROUP BY id
    ),
    PreviousMonth AS (
      SELECT 
        Customer_No_ as id, 
        SUM(Total_KGS_Sold) as prevKgsSold
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date BETWEEN CAST(@prevStartDate AS DATE) AND CAST(@prevEndDate AS DATE)
        AND Customer_No_ IN (SELECT id FROM TopDealers)
        ${channelFilter}
      GROUP BY Customer_No_
    ),
    -- The newest month in the table is still being written to. Charting it
    -- next to whole months makes a part-month look like a collapse, so the
    -- history stops at the last month the data covers end to end.
    DataWindow AS (
      SELECT
        IF(maxDate = LAST_DAY(maxDate, MONTH),
           maxDate,
           DATE_SUB(DATE_TRUNC(maxDate, MONTH), INTERVAL 1 DAY)) as completeThrough
      FROM (
        SELECT MAX(Date) as maxDate
        FROM \`accounts-recieva.SALES.SALES2023\`
        WHERE Date IS NOT NULL
      )
    ),
    MonthlyTotals AS (
      SELECT 
        Customer_No_ as id,
        EXTRACT(YEAR FROM Date) as year,
        EXTRACT(MONTH FROM Date) as month,
        SUM(Total_KGS_Sold) as monthlyKgs
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date IS NOT NULL
        AND Date <= (SELECT completeThrough FROM DataWindow)
        AND Customer_No_ IN (SELECT id FROM TopDealers)
        ${channelFilter}
      GROUP BY id, year, month
    ),
    AllTimeStats AS (
      SELECT
        id,
        MIN(monthlyKgs) as lowestMonthKgs,
        MAX(monthlyKgs) as highestMonthKgs,
        AVG(monthlyKgs) as avgMonthKgs,
        (ARRAY_AGG(STRUCT(year, month) ORDER BY monthlyKgs ASC LIMIT 1)[OFFSET(0)]).year as lowestYear,
        (ARRAY_AGG(STRUCT(year, month) ORDER BY monthlyKgs ASC LIMIT 1)[OFFSET(0)]).month as lowestMonth,
        (ARRAY_AGG(STRUCT(year, month) ORDER BY monthlyKgs DESC LIMIT 1)[OFFSET(0)]).year as highestYear,
        (ARRAY_AGG(STRUCT(year, month) ORDER BY monthlyKgs DESC LIMIT 1)[OFFSET(0)]).month as highestMonth,
        TO_JSON_STRING(ARRAY_AGG(STRUCT(year, month, monthlyKgs) ORDER BY year DESC, month DESC LIMIT 36)) as monthlyHistory
      FROM MonthlyTotals
      WHERE monthlyKgs > 0
      GROUP BY id
    )
    SELECT 
      t.*,
      p.prevKgsSold,
      a.lowestMonthKgs,
      a.highestMonthKgs,
      a.avgMonthKgs,
      a.lowestYear,
      a.lowestMonth,
      a.highestYear,
      a.highestMonth,
      a.monthlyHistory
    FROM TopDealers t
    LEFT JOIN PreviousMonth p ON t.id = p.id
    LEFT JOIN AllTimeStats a ON t.id = a.id
    ORDER BY t.kgsSold DESC
  `;

  const options = {
    query: query,
    params: { startDate, endDate, prevStartDate, prevEndDate }
  };

  if (customerIds && customerIds.length > 0) {
    options.params.customerIds = customerIds;
  }

  const [rows] = await bq.query(options);
  cachedAggregates[cacheKey] = rows;
  cachedAggregatesTime[cacheKey] = now;
  return rows;
}

// How many accounts one volume-watch agent looks after.
export const WATCH_BATCH_SIZE = 50;

// One row per watched account with the raw figures the volume-decline rule
// needs, all in calendar months: this month to date, the same days of the six
// months before, the last full month and the three before it, the ordering
// cycle, and which agent (batch) the account belongs to. The rule itself lives
// in lib/declineAlerts.js - this query only measures.
async function _getVolumeWatch() {
  const bq = getBigQueryClient();
  const allChannels = quoteChannels(channelsFor(ALL_SEGMENT));
  const query = `
    WITH Bounds AS (
      SELECT
        MAX(Date) as maxDate,
        DATE_TRUNC(MAX(Date), MONTH) as monthStart,
        EXTRACT(DAY FROM MAX(Date)) as dayOfMonth,
        -- Batches are ranked on the six months ending at the last month-end,
        -- so membership holds still for a whole month instead of reshuffling
        -- every time a large order lands.
        DATE_SUB(DATE_TRUNC(MAX(Date), MONTH), INTERVAL 1 DAY) as rankThrough
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date IS NOT NULL
    ),
    Lines AS (
      SELECT
        s.Customer_No_ as id,
        s.Customer_Name as name,
        s.Date,
        s.Channel,
        ${getSegmentExpression()} as segment,
        s.Total_KGS_Sold as kgs,
        -- 0 = the month the data is in now, 1 = last month, and so on.
        DATE_DIFF(b.monthStart, DATE_TRUNC(s.Date, MONTH), MONTH) as monthsAgo,
        -- Falls inside the same stretch of its own month as the data covers
        -- of this one (e.g. days 1-7), so partial months compare like for like.
        EXTRACT(DAY FROM s.Date) <= b.dayOfMonth as inSameDays,
        b.maxDate,
        b.dayOfMonth,
        b.rankThrough
      FROM \`accounts-recieva.SALES.SALES2023\` s
      CROSS JOIN Bounds b
      WHERE s.Date IS NOT NULL
        AND s.Customer_No_ IS NOT NULL
        AND s.Channel IN (${allChannels})
        -- Whole months only: the current month plus the twelve before it.
        AND s.Date >= DATE_SUB(b.monthStart, INTERVAL 12 MONTH)
    ),
    Account AS (
      SELECT
        id,
        ANY_VALUE(name HAVING MAX Date) as name,
        ANY_VALUE(Channel HAVING MAX Date) as channel,
        ANY_VALUE(segment HAVING MAX Date) as segment,
        MAX(Date) as lastOrderDate,
        COUNT(DISTINCT Date) as deliveryDays,
        ANY_VALUE(maxDate) as dataThrough,
        ANY_VALUE(dayOfMonth) as dayOfMonth,
        -- How many months back the account's first order in the window was;
        -- a newer account is averaged over the months it has existed.
        MAX(monthsAgo) as firstMonthsAgo,
        SUM(IF(monthsAgo = 0, kgs, 0)) as mtdKgs,
        SUM(IF(monthsAgo BETWEEN 1 AND 6 AND inSameDays, kgs, 0)) as prior6SameDaysKgs,
        SUM(IF(monthsAgo BETWEEN 1 AND 6, kgs, 0)) as prior6FullKgs,
        SUM(IF(monthsAgo = 1, kgs, 0)) as lastMonthKgs,
        SUM(IF(monthsAgo BETWEEN 2 AND 4, kgs, 0)) as prev3Kgs,
        SUM(IF(Date <= rankThrough
               AND Date > DATE_SUB(rankThrough, INTERVAL 180 DAY), kgs, 0)) as rankKgs
      FROM Lines
      GROUP BY id
    ),
    Gaps AS (
      SELECT
        id,
        DATE_DIFF(Date, LAG(Date) OVER (PARTITION BY id ORDER BY Date), DAY) as gapDays
      FROM (SELECT DISTINCT id, Date FROM Lines)
    ),
    -- Median gap between deliveries: one long dormancy would drag a mean out
    -- past anything the account has ever actually done.
    Cycle AS (
      SELECT id, CAST(APPROX_QUANTILES(gapDays, 2)[OFFSET(1)] AS INT64) as cycleDays
      FROM Gaps
      WHERE gapDays > 0
      GROUP BY id
    ),
    Ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY segment ORDER BY rankKgs DESC, id) as segmentRank
      FROM Account
      WHERE rankKgs > 0
    )
    SELECT
      a.id,
      a.name,
      a.channel,
      a.segment,
      a.lastOrderDate,
      a.deliveryDays,
      DATE_DIFF(a.dataThrough, a.lastOrderDate, DAY) as daysSinceLast,
      c.cycleDays,
      a.dayOfMonth,
      a.firstMonthsAgo,
      a.mtdKgs,
      a.prior6SameDaysKgs,
      a.prior6FullKgs,
      a.lastMonthKgs,
      a.prev3Kgs,
      a.rankKgs,
      r.segmentRank,
      DIV(r.segmentRank - 1, ${WATCH_BATCH_SIZE}) + 1 as batch,
      a.dataThrough
    FROM Ranked r
    JOIN Account a ON a.id = r.id
    LEFT JOIN Cycle c ON c.id = a.id
    ORDER BY a.segment, r.segmentRank
  `;
  const [rows] = await bq.query({ query });
  return rows;
}

// What one account actually bought over the last seven months: kilograms and
// deliveries per month per product, and each delivery day in the last 120 days.
// This is the evidence the alert explanation is written from.
export async function getAccountOrderDetail(customerId) {
  const bq = getBigQueryClient();
  const params = { customerId: String(customerId) };
  const monthly = `
    WITH Bounds AS (
      SELECT MAX(Date) as maxDate
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date IS NOT NULL
    )
    SELECT
      FORMAT_DATE('%Y-%m', s.Date) as month,
      s.Item_Description as item,
      SUM(s.Total_KGS_Sold) as kgs,
      COUNT(DISTINCT s.Date) as deliveryDays
    FROM \`accounts-recieva.SALES.SALES2023\` s
    CROSS JOIN Bounds b
    WHERE s.Customer_No_ = @customerId
      AND s.Date IS NOT NULL
      AND s.Date > DATE_SUB(b.maxDate, INTERVAL 210 DAY)
    GROUP BY month, item
    ORDER BY month, kgs DESC
  `;
  const deliveries = `
    WITH Bounds AS (
      SELECT MAX(Date) as maxDate
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date IS NOT NULL
    )
    SELECT
      s.Date as orderDate,
      SUM(s.Total_KGS_Sold) as kgs
    FROM \`accounts-recieva.SALES.SALES2023\` s
    CROSS JOIN Bounds b
    WHERE s.Customer_No_ = @customerId
      AND s.Date IS NOT NULL
      AND s.Date > DATE_SUB(b.maxDate, INTERVAL 120 DAY)
    GROUP BY orderDate
    ORDER BY orderDate
  `;
  const [[monthlyRows], [deliveryRows]] = await Promise.all([
    bq.query({ query: monthly, params }),
    bq.query({ query: deliveries, params }),
  ]);
  return { monthly: monthlyRows, deliveries: deliveryRows };
}

async function _getProactiveCallingData(segment = 'dealer') {
  const bq = getBigQueryClient();
  const channelFilter = getChannelFilterString(segment);
  const query = `
    WITH MaxDateData AS (
      SELECT 
        MAX(Date) as max_date,
        FORMAT_DATE('%Y-%m', MAX(Date)) as current_month,
        FORMAT_DATE('%Y-%m', DATE_SUB(MAX(Date), INTERVAL 1 MONTH)) as prev_month
      FROM \`accounts-recieva.SALES.SALES2023\`
    ),
    FirstOrder AS (
      SELECT 
        Customer_No_ as id, 
        MIN(Date) as true_first_order_date
      FROM \`accounts-recieva.SALES.SALES2023\`
      GROUP BY Customer_No_
    ),
    DealerStats AS (
      SELECT 
        Customer_No_ as id,
        MAX(Customer_Name) as name,
        MAX(Date) as last_order_date,
        COUNT(DISTINCT Transaction_No_) as total_orders,
        SUM(Total_KGS_Sold) / NULLIF(COUNT(DISTINCT Transaction_No_), 0) as avg_order_volume,
        DATE_DIFF(MAX(Date), MIN(Date), DAY) as days_active,
        SUM(CASE WHEN FORMAT_DATE('%Y-%m', Date) = m.current_month THEN Total_KGS_Sold ELSE 0 END) as current_month_vol,
        SUM(CASE WHEN FORMAT_DATE('%Y-%m', Date) = m.prev_month THEN Total_KGS_Sold ELSE 0 END) as prev_month_vol
      FROM \`accounts-recieva.SALES.SALES2023\`
      CROSS JOIN MaxDateData m
      WHERE Date >= DATE_SUB(m.max_date, INTERVAL 180 DAY)
        ${channelFilter}
      GROUP BY Customer_No_, m.current_month, m.prev_month
    )
    SELECT 
      d.id, 
      d.name, 
      d.last_order_date,
      d.total_orders,
      d.avg_order_volume,
      d.days_active / NULLIF(d.total_orders - 1, 0) as avg_days_between_orders,
      d.current_month_vol,
      d.prev_month_vol,
      f.true_first_order_date
    FROM DealerStats d
    LEFT JOIN FirstOrder f ON d.id = f.id
    ORDER BY d.last_order_date DESC
  `;
  const [rows] = await bq.query({ query });
  return rows;
}

// "Today" for the cadence rule, as a calendar date in the business timezone.
function manilaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

// Order cadence engine input: one row per account per order date (several
// transactions on a day are one order), read-only, one query per segment.
// The median gap and status are worked out in JavaScript by ./cadence.
async function _getAccountCadence(segment = 'dealer') {
  const bq = getBigQueryClient();
  const channelFilter = getChannelFilterString(segment);
  const today = manilaToday();
  const windowStart = subtractMonths(today, WINDOW_MONTHS);
  const query = `
    SELECT
      Customer_No_ as id,
      MAX(Customer_Name) as name,
      MAX(Classification) as classification,
      Date as date,
      SUM(Total_KGS_Sold) as kg
    FROM \`accounts-recieva.SALES.SALES2023\`
    WHERE Customer_No_ IS NOT NULL
      AND Date IS NOT NULL
      AND Date >= DATE(@windowStart)
      AND Date <= DATE(@today)
      ${channelFilter}
    GROUP BY Customer_No_, Date
  `;
  const [rows] = await bq.query({ query, params: { windowStart, today } });
  return assessAccounts(rows.map(r => ({ ...r, date: toIsoDate(r.date) })), today);
}

export const getAvailableMonths = unstable_cache(
  async () => await _getAvailableMonths(),
  ['bq-months'],
  { revalidate: 43200 }
);

export const getLatestCompleteMonth = unstable_cache(
  async () => await _getLatestCompleteMonth(),
  ['bq-complete-month'],
  { revalidate: 43200 }
);

export const getAvailableDealers = (segment = 'dealer') => unstable_cache(
  async () => await _getAvailableDealers(segment),
  ['bq-dealers', segment],
  { revalidate: 7200 }
)();

export const getTrendData = (startPeriod, endPeriod, segment = 'dealer') => unstable_cache(
  async () => await _getTrendData(startPeriod, endPeriod, segment),
  ['bq-trend', startPeriod, endPeriod, segment],
  { revalidate: 7200 }
)();

export const getDealerAggregates = (startPeriod, endPeriod, customerIds = [], segment = 'dealer') => unstable_cache(
  async () => await _getDealerAggregates(startPeriod, endPeriod, customerIds, segment),
  ['bq-aggregates', startPeriod, endPeriod, customerIds.join(','), segment],
  { revalidate: 7200 }
)();

export const getVolumeWatch = unstable_cache(
  async () => await _getVolumeWatch(),
  ['bq-volume-watch-monthly'],
  { revalidate: 7200 }
);

export const getProactiveCallingData = (segment = 'dealer') => unstable_cache(
  async () => await _getProactiveCallingData(segment),
  ['bq-proactive', segment],
  { revalidate: 7200 }
)();

export const getAccountCadence = (segment = 'dealer') => unstable_cache(
  async () => await _getAccountCadence(segment),
  ['bq-account-cadence', segment],
  { revalidate: 7200 }
)();
