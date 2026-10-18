import { BigQuery } from '@google-cloud/bigquery';
import credentials from '../../bq-credentials.json' assert { type: 'json' };
import { unstable_cache } from 'next/cache';

let bqClient = null;

let cachedMonths = null;
let cachedMonthsTime = 0;
const MONTHS_CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

let cachedDealers = {};
let cachedDealersTime = {};
const DEALERS_CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours

export function getBigQueryClient() {
  if (!bqClient) {
    bqClient = new BigQuery({
      projectId: credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      }
    });
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

function getChannelFilterString(segment) {
  if (segment === 'commercial') {
    return `AND Channel IN ("COMMERCIAL", "commercial", "Commercial", "PHILGEPS", "philgeps")`;
  }
  if (segment === 'bulk') {
    return `AND Channel IN ("BULK", "bulk", "Bulk")`;
  }
  return `AND Channel IN ("MGSA", "MARKETER", "DEALER", "CODO", "DEALER - COBANKIAT", "DEALER-EXMARKETER", "RETAIL")`;
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
    WITH TopDealers AS (
      SELECT 
        Customer_No_ as id, 
        MAX(Customer_Name) as name, 
        MAX(Classification) as classification,
        SUM(Total_KGS_Sold) as kgsSold,
        SUM(Net_Sales_Amount) as netSales
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date BETWEEN CAST(@startDate AS DATE) AND CAST(@endDate AS DATE)
      ${customerFilter}
      ${channelFilter}
      GROUP BY Customer_No_
      ORDER BY kgsSold DESC
      LIMIT 100
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
    MonthlyTotals AS (
      SELECT 
        Customer_No_ as id,
        EXTRACT(YEAR FROM Date) as year,
        EXTRACT(MONTH FROM Date) as month,
        SUM(Total_KGS_Sold) as monthlyKgs
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Date IS NOT NULL
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

export const getAvailableMonths = unstable_cache(
  async () => await _getAvailableMonths(),
  ['bq-months'],
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

export const getProactiveCallingData = (segment = 'dealer') => unstable_cache(
  async () => await _getProactiveCallingData(segment),
  ['bq-proactive', segment],
  { revalidate: 7200 }
)();
