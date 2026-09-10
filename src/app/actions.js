'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getBigQueryClient, getDealerAggregates, getAvailableMonths } from '../lib/bigquery';
import { normalizeSegment, ALL_SEGMENT } from '../lib/segments';

export async function setSegmentCookie(rawSegment) {
  const segment = normalizeSegment(rawSegment);
  const cookieStore = await cookies();
  cookieStore.set('segment', segment, { path: '/', maxAge: 31536000 });
  revalidatePath('/', 'layout');
}

export async function getMonthlySalesByDealers(dealerIds) {
  if (!dealerIds || dealerIds.length === 0) return [];

  const bq = getBigQueryClient();
  
  const idsString = dealerIds.map(id => `'${id}'`).join(',');
  
  const query = `
    WITH MaxDateData AS (
      SELECT FORMAT_DATE('%Y', MAX(Date)) as current_year
      FROM \`accounts-recieva.SALES.SALES2023\`
    )
    SELECT 
      Customer_No_ as id,
      FORMAT_DATE('%Y-%m', Date) as month,
      SUM(Total_KGS_Sold) as volume
    FROM \`accounts-recieva.SALES.SALES2023\`
    CROSS JOIN MaxDateData m
    WHERE FORMAT_DATE('%Y', Date) = m.current_year
      AND Customer_No_ IN (${idsString})
    GROUP BY Customer_No_, month
    ORDER BY Customer_No_, month
  `;
  try {
    const [rows] = await bq.query({ query });
    // Ensure plain objects are returned for Client Components
    return rows.map(row => ({
      id: String(row.id),
      month: String(row.month),
      volume: Number(row.volume || 0)
    }));
  } catch (error) {
    console.error("Failed to fetch monthly sales:", error);
    return [];
  }
}

export async function getSingleDealerIntelligence(dealerId, rawSegment = 'dealer') {
  if (!dealerId) return null;
  // Server actions are callable with anything: coerce to a known segment.
  const segment = normalizeSegment(rawSegment);
  
  try {
    const availableMonths = await getAvailableMonths();
    if (availableMonths.length === 0) return null;

    const asPeriod = (m) => `${m.year}-${String(m.month).padStart(2, '0')}`;
    const latest = asPeriod(availableMonths[0]);
    // Months come back newest first; step back up to a year for the wider look.
    const yearAgo = asPeriod(availableMonths[Math.min(11, availableMonths.length - 1)]);
    const ids = [dealerId, dealerId.toUpperCase()];

    // An account that has not ordered this month has no rows in the latest
    // period, which is exactly the case for every overdue account on the
    // Proactive Calling board. Widen the window, then drop the segment filter,
    // before giving up - otherwise the drawer opens on a wall of zeros.
    const attempts = [
      [latest, latest, segment],
      [yearAgo, latest, segment],
      [yearAgo, latest, ALL_SEGMENT],
    ];

    for (const [start, end, seg] of attempts) {
      const dealers = await getDealerAggregates(start, end, ids, seg);
      if (dealers && dealers.length > 0) {
        // Return a plain object copy
        return JSON.parse(JSON.stringify(dealers[0]));
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to get single dealer intelligence:", error);
    return null;
  }
}

