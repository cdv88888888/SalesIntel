import styles from "./page.module.css";
export const dynamic = 'force-dynamic';

import { getProactiveCallingData } from "../../lib/bigquery";
import ProactiveBoard from "./ProactiveBoard";

export default async function ProactiveCalling({ searchParams }) {
  const params = await searchParams;
  const segment = params?.segment || 'dealer';
  let initialColumns = {
    overdue: [],
    today: [],
    confirmed: [],
    thisWeek: [],
    future: []
  };
  
  try {
    const rawData = await getProactiveCallingData(segment);
    
    let systemDate = new Date();
    if (rawData.length > 0) {
      const maxDateVal = Math.max(...rawData.map(d => new Date(d.last_order_date.value).getTime()));
      systemDate = new Date(maxDateVal);
    }
    
    systemDate.setHours(0,0,0,0);

    for (const dealer of rawData) {
      if (!dealer.avg_days_between_orders) continue;
      
      const lastOrder = new Date(dealer.last_order_date.value);
      lastOrder.setHours(0,0,0,0);
      
      const avgDays = Math.round(dealer.avg_days_between_orders);
      const expectedDate = new Date(lastOrder.getTime());
      expectedDate.setDate(expectedDate.getDate() + avgDays);
      
      const daysUntilExpected = Math.round((expectedDate.getTime() - systemDate.getTime()) / (1000 * 3600 * 24));
      const daysSinceLastOrder = Math.round((systemDate.getTime() - lastOrder.getTime()) / (1000 * 3600 * 24));
      
      const cardData = {
        id: dealer.id,
        name: dealer.name,
        lastOrder: lastOrder.toLocaleDateString(),
        expectedDate: expectedDate.toLocaleDateString(),
        daysUntilExpected,
        daysSinceLastOrder,
        avgDays: avgDays,
        pitchVolume: Math.round(dealer.avg_order_volume || 0),
        currentMonthVol: Math.round(dealer.current_month_vol || 0),
        prevMonthVol: Math.round(dealer.prev_month_vol || 0)
      };

      const isLost = daysSinceLastOrder > (4 * avgDays);

      if (isLost) {
        // Excluded from proactive calling, moved to risk page
      } else if (daysUntilExpected < 0) {
        initialColumns.overdue.push(cardData);
      } else if (daysUntilExpected === 0) {
        initialColumns.today.push(cardData);
      } else if (daysUntilExpected <= 7) {
        initialColumns.thisWeek.push(cardData);
      } else {
        initialColumns.future.push(cardData);
      }
    }
    
    initialColumns.overdue.sort((a, b) => a.daysUntilExpected - b.daysUntilExpected); 
    initialColumns.today.sort((a, b) => b.pitchVolume - a.pitchVolume); 
    initialColumns.thisWeek.sort((a, b) => a.daysUntilExpected - b.daysUntilExpected); 
    initialColumns.future.sort((a, b) => a.daysUntilExpected - b.daysUntilExpected);

  } catch (error) {
    console.error("Failed to load Proactive Calling data:", error);
    initialColumns.today = [{
      id: "MOCK-1", name: "SEVA LPG TRADING (Mock)", lastOrder: "2026-06-12", expectedDate: "2026-06-17", daysUntilExpected: 0, daysSinceLastOrder: 5, avgDays: 5, pitchVolume: 2500, currentMonthVol: 1000, prevMonthVol: 2000
    }];
  }

  return (
    <div className={styles.dashboard}>
      <ProactiveBoard initialColumns={initialColumns} />
    </div>
  );
}
