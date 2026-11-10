"use client";

import styles from '../settings/page.module.css';

export default function LogicPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>System Logic & Formulas</h1>
        <p>Documentation of algorithms and calculations used in the platform.</p>
      </header>

      <section className={`${styles.section} glass-panel`}>
        <h2 className={styles.sectionTitle}>Target Suggestion Algorithm</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
          How the &quot;Generate Suggested Split&quot; calculates the optimal monthly volume per dealer.
        </p>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>1. Determine Base Volume</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px' }}>
            The system first looks at the <strong>Target Month</strong> you selected (e.g., July). It then fetches the saved targets from the <strong>Previous Month</strong> (e.g., June). If a dealer has a target set in the previous month, that becomes their Base Volume. If no previous target exists, it falls back to the dealer&apos;s all-time historical monthly average.
          </p>
        </div>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>2. Calculate Historical Month-over-Month (MoM) Growth</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px', marginBottom: '12px' }}>
            The system looks at the actual sales data from the last 6 active months for each dealer. It calculates the growth rate between each consecutive month using the formula:
          </p>
          <code style={{ display: 'block', background: 'var(--surface)', padding: '12px', borderRadius: '12px', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', marginBottom: '12px' }}>
            Growth Rate = (Sales_Current_Month / Sales_Previous_Month) - 1
          </code>
          <p style={{ fontSize: '15px', lineHeight: '22px' }}>
            It then computes the average of these growth rates to find the dealer&apos;s <strong>Average MoM Growth</strong>. To prevent extreme outliers, this rate is capped between -50% and +50%.
          </p>
        </div>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>3. Calculate Projected Target</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px', marginBottom: '12px' }}>
            The Base Volume is multiplied by the anticipated growth rate:
          </p>
          <code style={{ display: 'block', background: 'var(--surface)', padding: '12px', borderRadius: '12px', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
            Projected Target = Base Volume * (1 + Average MoM Growth)
          </code>
        </div>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>4. Normalize to Global Target</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px', marginBottom: '12px' }}>
            Finally, the system sums up all the Projected Targets to find the <strong>Total Projected Volume</strong>. It then distributes your provided <strong>Global Target</strong> proportionally across all dealers so that the sum of all individual targets perfectly matches the global goal:
          </p>
          <code style={{ display: 'block', background: 'var(--surface)', padding: '12px', borderRadius: '12px', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
            Final Suggested Target = (Projected Target / Total Projected Volume) * Global Target
          </code>
        </div>
      </section>
      <section className={`${styles.section} glass-panel`}>
        <h2 className={styles.sectionTitle}>Monthly Target, Forecast & Pacing</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
          One rule, used by the Operations Hub, Predictive AI, Business Intelligence and the customer drawer, so every page shows the same target for the same account.
        </p>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>1. Monthly Target</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px', marginBottom: '12px' }}>
            A target saved in Settings always wins. Otherwise the target is the average of the last three complete months plus 15%. With fewer than three months of history, the all-time monthly average plus 15% is used instead. The current month is never part of the baseline because its data is still being written.
          </p>
          <code style={{ display: 'block', background: 'var(--surface)', padding: '12px', borderRadius: '12px', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
            Target = Saved Target, else Avg(last 3 complete months) × 1.15
          </code>
        </div>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>2. Projected End of Month</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px', marginBottom: '12px' }}>
            For the month in progress, the volume so far is scaled to a full month by how much of the month has passed, then blended 70/30 with the baseline so a strong or quiet first week does not swing the forecast. For a finished month, the projection is the actual total.
          </p>
          <code style={{ display: 'block', background: 'var(--surface)', padding: '12px', borderRadius: '12px', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
            Projected = (Sold so far ÷ Share of month elapsed) × 0.7 + Baseline × 0.3
          </code>
        </div>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>3. Pacing Status</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px', marginBottom: '12px' }}>
            Sold so far at or above target is <strong>Target Met</strong>. Otherwise the projection is compared with the target: below 85% is <strong>At Risk</strong>, below 100% is <strong>Behind Target</strong>, and 100% or more is <strong>On Track</strong>. The Operations Hub lists an account as an escalation when its volume so far is under 90% of target and it normally sells more than 1,000 kg a month.
          </p>
        </div>
      </section>
    </div>
  );
}
