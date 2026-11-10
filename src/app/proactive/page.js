import styles from "./page.module.css";
export const dynamic = 'force-dynamic';

import { getAccountCadence } from "../../lib/bigquery";
import { STATUS } from "../../lib/cadence";
import { normalizeSegment } from "../../lib/segments";
import ProactiveBoard from "./ProactiveBoard";

export default async function ProactiveCalling({ searchParams }) {
  const params = await searchParams;
  const segment = normalizeSegment(params?.segment);
  const initialColumns = { today: [], confirmed: [] };
  let loadError = null;

  try {
    // Accounts inside their order window, biggest first (the engine sorts them).
    // Overdue accounts are At Risk and live on the Hub and the Risk page.
    const accounts = await getAccountCadence(segment);
    initialColumns.today = accounts
      .filter(a => a.cadence.status === STATUS.PROACTIVE)
      .map(a => ({
        id: a.id,
        name: a.name,
        x: a.cadence.x,
        d: a.cadence.d,
        lastOrder: a.cadence.lastOrderDate,
        dueDate: a.cadence.dueDate,
        atRiskDate: a.cadence.atRiskDate,
        avgKg: Math.round(a.cadence.avgKgPerOrder || 0),
        declining: a.cadence.declining,
      }));
  } catch (error) {
    console.error("Failed to load Proactive Calling data:", error);
    loadError = error?.message || String(error);
  }

  return (
    <div className={styles.dashboard}>
      <ProactiveBoard initialColumns={initialColumns} loadError={loadError} />
    </div>
  );
}
