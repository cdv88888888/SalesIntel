'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getBigQueryClient, getDealerAggregates, getAvailableMonths } from '../lib/bigquery';

export async function setSegmentCookie(segment) {
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

export async function getSingleDealerIntelligence(dealerId, segment = 'dealer') {
  if (!dealerId) return null;
  
  try {
    const availableMonths = await getAvailableMonths();
    if (availableMonths.length === 0) return null;
    
    const defaultYear = availableMonths[0].year;
    const defaultMonth = String(availableMonths[0].month).padStart(2, '0');
    const period = `${defaultYear}-${defaultMonth}`;
    
    const dealers = await getDealerAggregates(period, period, [dealerId, dealerId.toUpperCase()], segment);
    if (dealers && dealers.length > 0) {
      // Return a plain object copy
      return JSON.parse(JSON.stringify(dealers[0]));
    }
    return null;
  } catch (error) {
    console.error("Failed to get single dealer intelligence:", error);
    return null;
  }
}

