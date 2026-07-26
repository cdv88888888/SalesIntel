import Image from 'next/image';
import Link from 'next/link';
import styles from './about.module.css';

export const metadata = {
  title: 'CDV Sales Intelligence | About',
  description: 'Stop Reacting. Start Predicting. AI-powered sales intelligence platform.',
};

export default function AboutPage() {
  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <h1 className={`${styles.title} gradient-text`}>Stop Reacting. Start Predicting.</h1>
        <p className={styles.subtitle}>
          The AI-powered sales intelligence platform that identifies at-risk accounts before they churn, turning raw data into immediate strategic action.
        </p>
        <Link href="/login">
          <button className={styles.ctaButton}>See It In Action</button>
        </Link>
        
        <div className={styles.mockupContainer}>
          <Image 
            src="/landing-mockup.jpg" 
            alt="CDV Sales Intelligence Dashboard Mockup" 
            width={1200} 
            height={800} 
            layout="responsive"
            priority
          />
        </div>
      </section>

      {/* The Problem */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeader}>The Hidden Cost of Reactive Sales</h2>
        <div className={styles.problemList}>
          <div className={styles.problemItem}>
            <div className={styles.problemTitle}>Problem 1: Silent Churn</div>
            <div className={styles.cardDesc}>
              You only find out a dealer has been poached by a rival after they stop ordering. By then, it&apos;s too late.
            </div>
          </div>
          <div className={styles.problemItem}>
            <div className={styles.problemTitle}>Problem 2: Data Without Direction</div>
            <div className={styles.cardDesc}>
              You have mountains of sales data, but your team lacks clear, actionable steps on what to actually do with it today.
            </div>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeader}>Revenue Protection, Automated.</h2>
        <div className={styles.grid}>
          
          <div className={styles.card}>
            <div className={styles.cardIcon}>⚠️</div>
            <h3 className={styles.cardTitle}>Predictive Anomaly Alerts</h3>
            <p className={styles.cardDesc}>
              <strong>The Fix:</strong> We calculate a localized baseline for every single dealer based on historical BigQuery data.<br/><br/>
              <strong>The Impact:</strong> If a dealer&apos;s ordering volume collapses below 90% of their target, the system instantly flags them as an &quot;Active Escalation.&quot; You intervene before the relationship is lost.
            </p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon}>🧠</div>
            <h3 className={styles.cardTitle}>AI-Driven Strategic Action Plans</h3>
            <p className={styles.cardDesc}>
              <strong>The Fix:</strong> Integrated Gemini AI acts as your automated sales strategist, analyzing purchasing patterns in real-time.<br/><br/>
              <strong>The Impact:</strong> When cadence slows, the AI doesn&apos;t just alert you—it generates a localized playbook, suggesting immediate interventions like pre-approved volume promotions to shield the account from rivals.
            </p>
          </div>

        </div>
      </section>

      {/* Footer CTA */}
      <footer className={styles.footer}>
        <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Ready to shift from order-taking to proactive account management?</h2>
        <Link href="/login">
          <button className={styles.ctaButton}>Secure Your Revenue Today</button>
        </Link>
      </footer>
    </div>
  );
}
