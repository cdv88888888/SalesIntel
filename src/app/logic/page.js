"use client";

import styles from '../settings/page.module.css';

export default function LogicPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="gradient-text">System Logic & Formulas</h1>
        <p>Documentation of algorithms and calculations used in the platform.</p>
      </header>

      <section className={`${styles.section} glass-panel`}>
        <h2 className={styles.sectionTitle}>Target Suggestion Algorithm</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          How the &quot;Generate Suggested Split&quot; calculates the optimal monthly volume per dealer.
        </p>

        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: '#60A5FA' }}>1. Determine Base Volume</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
            The system first looks at the <strong>Target Month</strong> you selected (e.g., July). It then fetches the saved targets from the <strong>Previous Month</strong> (e.g., June). If a dealer has a target set in the previous month, that becomes their Base Volume. If no previous target exists, it falls back to the dealer&apos;s all-time historical monthly average.
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: '#60A5FA' }}>2. Calculate Historical Month-over-Month (MoM) Growth</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '12px' }}>
            The system looks at the actual sales data from the last 6 active months for each dealer. It calculates the growth rate between each consecutive month using the formula:
          </p>
          <code style={{ display: 'block', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '4px', fontFamily: 'monospace', marginBottom: '12px' }}>
            Growth Rate = (Sales_Current_Month / Sales_Previous_Month) - 1
          </code>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
            It then computes the average of these growth rates to find the dealer&apos;s <strong>Average MoM Growth</strong>. To prevent extreme outliers, this rate is capped between -50% and +50%.
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: '#60A5FA' }}>3. Calculate Projected Target</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '12px' }}>
            The Base Volume is multiplied by the anticipated growth rate:
          </p>
          <code style={{ display: 'block', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '4px', fontFamily: 'monospace' }}>
            Projected Target = Base Volume * (1 + Average MoM Growth)
          </code>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '8px', color: '#60A5FA' }}>4. Normalize to Global Target</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '12px' }}>
            Finally, the system sums up all the Projected Targets to find the <strong>Total Projected Volume</strong>. It then distributes your provided <strong>Global Target</strong> proportionally across all dealers so that the sum of all individual targets perfectly matches the global goal:
          </p>
          <code style={{ display: 'block', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '4px', fontFamily: 'monospace' }}>
            Final Suggested Target = (Projected Target / Total Projected Volume) * Global Target
          </code>
        </div>
      </section>
    </div>
  );
}
