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
        <h2 className={styles.sectionTitle}>Order Cadence: Proactive, At Risk, Lost</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
          One rule for &quot;when should this account have ordered&quot;, worked out per account within its segment.
        </p>

        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>1. Typical gap between orders (x)</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px' }}>
            The system looks at the account&apos;s orders in the <strong>last 24 months</strong>. Several deliveries on the same day count as <strong>one order</strong>. <strong>x</strong> is the <strong>median</strong> number of days between one order date and the next, so a single long pause does not distort it. An account needs at least <strong>3 orders</strong> in the 24 months; with fewer it is <strong>New</strong> and has no x.
          </p>
        </div>
        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>2. Days since last order (d)</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px' }}>
            <strong>d</strong> is the number of days from the account&apos;s most recent order to today. When the account orders again, d goes back to zero, so the status clears by itself.
          </p>
        </div>
        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>3. Status</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px', marginBottom: '12px' }}>
            Compare d with x:
          </p>
          <code style={{ display: 'block', background: 'var(--surface)', padding: '12px', borderRadius: '12px', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
            Healthy: d &lt; 0.8x (rounded up)  |  Proactive: 0.8x &le; d &lt; 1.2x  |  At Risk: 1.2x &le; d &lt; 4x  |  Lost: d &ge; 4x
          </code>
        </div>
        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>4. Declining (separate flag)</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px' }}>
            An account is <strong>Declining</strong> when its average kg per order over the <strong>last 3 months</strong> is below <strong>80%</strong> of its average kg per order over the 24 months. This is independent of status. If the account has no orders in the last 3 months it is not flagged Declining: that is a timing problem, and the status already shows it.
          </p>
        </div>
        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>5. Sorting</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px' }}>
            Lists show the biggest accounts first, by average kg per order over 24 months.
          </p>
        </div>
        <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: 'var(--r-card)', marginBottom: '0' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--text)', fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: 600 }}>Example</h3>
          <p style={{ fontSize: '15px', lineHeight: '22px' }}>
            An account that orders every <strong>10 days</strong> (x = 10) is <strong>Proactive from day 8</strong>, <strong>At Risk from day 12</strong> and <strong>Lost from day 40</strong> since its last order.
          </p>
        </div>
      </section>
    </div>
  );
}
