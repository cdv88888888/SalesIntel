# SalesIntel Simplification Spec (v1)

**Product:** CDV Sales Intelligence · Masagana Gas Corp
**Author:** CDV (with Claude, solutions-architecture review)
**Date:** 26 July 2026
**Repo:** github.com/cdv88888888/SalesIntel · Live: sales-intel-amber.vercel.app
**Audience:** Designer (act on the 7 open PRs), Jan Albert (infra), future maintainers

---

## 1. Problem Statement

MGC's sales operation loses volume through silent account churn (worst in the Commercial segment) and discovers target misses only at month-end. The current app solves this but spreads the answer across **7 pages**, forcing users to interpret analytics before acting. Adoption proved the point: the two users who adopted it self-assembled a workflow; others never found one. The team is also being rebuilt with new hires, so the app must carry the institutional knowledge a veteran would have — it cannot assume any.

**The users are Sales Assistants, not field reps.** Per their job descriptions, the role is coordination and encoding: tracking deliveries, monitoring daily cylinder sales, verifying the dealer database, checking credit limits before delivery, reactivating inactive accounts, monitoring competitor prices, and filing mandatory reports (weekly sales projection/plan and accomplishment report every Saturday; daily retail sales recon in kgs; monthly Accpac performance report). The app must serve *that* job.

## 2. Goals

1. **Volume does not drop; monthly segment targets are met.** Measured monthly per segment: actual kgs vs target, and net accounts gained/lost (forward-looking count starting from launch).
2. **A new Sales Assistant is productive on day 1** — they can work their account queue without training beyond a 15-minute walkthrough, because every card states the reason and the action.
3. **Every at-risk account gets an action or an escalation** — no card sits in Overdue > 5 days without a logged outcome.
4. **Reduce rep-facing surface from 7 pages to 1** (plus customer search); admin surface to 2 + settings.
5. **The app writes the Sales Assistant's mandated reports** from their logged activity, so daily usage is self-rewarding rather than imposed.

## 3. Non-Goals (v1)

- **AI promo recommendation.** The promo lever is a fixed rule — volume rebate tied to the account's target, or competitor price-match — decided by CDV on escalation. No ML needed.
- **Retrospective churn analysis of 2024–2025 losses.** Forward-looking counting only.
- **Offline mode / field-optimized mobile.** Users are in-office on iPhones/MacBooks with reliable internet.
- **CEO login or CEO dashboard.** The CEO receives an auto-emailed monthly digest; he never opens the app.
- **Order-entry replacement.** A separate connected order-entry app will eliminate the 2-day encoding lag; this app only bridges the gap (see §7.3).
- **Credit & collection module.** V1 shows at most a credit-hold badge (P1); AR workflows stay in existing processes.

## 4. Personas

| Persona | Who | What they need |
|---|---|---|
| **Sales Assistant (SA)** | e.g. Maclaire; new hires | A ranked daily action list for their segment; instant customer lookup during calls; their Saturday reports written for them |
| **Sales Manager / Exec** | CDV (remote oversight), sales manager | Escalation inbox (price-match / rebate decisions), segment scoreboard, auto-flags |
| **CEO** | — | Monthly one-page digest: volume per segment vs target, accounts gained/lost |
| **Maintainer** | Jan Albert | Fewer moving parts; clear runbook; no orphaned pages |

## 5. Information Architecture: 7 Pages → 3 Surfaces

| Current page | Disposition | Where it goes |
|---|---|---|
| `/` Dashboard | **Merge** | Target ring → Scoreboard; "Needs Attention" radar → queue sort logic; CRM stream → cut (no user asked for it) |
| `/intelligence` | **Cut as page** | Historical comparisons → Customer Profile card + admin Ask |
| `/risk` | **Cut as page** | Risk categories (New / Volume Decline / No Orders / Dormant) → badges + sort weight on queue cards, + auto-escalation triggers |
| `/proactive` Kanban | **Becomes THE rep surface ("Today")** | Absorbs risk badges, outcome buttons, escalation |
| `/predictive-ai` | **Cut as page** | Run-rate forecast → Scoreboard column; miss-projection → auto-flag + escalation trigger |
| `/gemini-ai` | **Admin-only ("Ask")** | Team's actual usage ("volume of client X") is served by Customer Search instead |
| `/settings` | **Keep, admin-only** | Whitelist + roles unchanged |

**Resulting nav:**
- **SA (viewer role):** `Today` (queue) + persistent Customer Search. Nothing else visible.
- **Admin:** `Scoreboard` · `Ask` · `Settings` (+ can see Today).

## 6. User Stories & Acceptance Criteria

### P0 — Today queue (SA)

**US-1.** As a Sales Assistant, I want to open the app and see my segment's accounts ranked by urgency, each with the reason, so I know exactly who to contact without analyzing anything.
- [ ] Login → lands directly on Today, pre-filtered to my segment(s)
- [ ] Card shows: account name, badge (Overdue / Volume Decline / No Orders / New / Dormant / Behind Target), days vs expected cycle, MTD kgs vs typical, contact info
- [ ] Sort = severity × account volume (big declining accounts float to top)
- [ ] Empty queue state says "All clear — next expected orders below" (upcoming list)

**US-2.** As a Sales Assistant, I want one-tap outcomes on every card so the system learns and my reports write themselves.
- [ ] Outcomes: **Confirmed delivery** (+date, default today) · **Follow up on [date]** (snoozes card) · **No answer** (card stays, attempt logged) · **Lost — reason** (picker: price / closed / competitor / other)
- [ ] Given a card marked Confirmed delivery, when the queue recalculates, then the account is suppressed until its next expected cycle (bridges the 2-day Accpac lag)
- [ ] Every outcome is timestamped with user, visible in the account's history

**US-3.** As a Sales Assistant, I want to escalate an account to management in one tap so pricing decisions don't stall on me.
- [ ] Escalate button opens: reason picker (competitor price / needs rebate approval / credit concern / other) + competitor price field (₱/kg or ₱/cylinder) + optional note
- [ ] Escalated card shows "Waiting for management" state; SA cannot resolve it
- [ ] Given a card in Overdue ≥ 5 days with no outcome, OR a top-20 account projected to miss target, then the system auto-escalates it

**US-4.** As a Sales Assistant, I want to search any customer and see their profile while on a call.
- [ ] Search by name from any screen (replaces team's Gemini "volume of X" usage)
- [ ] Profile card: volume trend (12 mo), last order date + qty, avg cycle days, target completion, current price, outcome history, escalation history

### P0 — Escalation inbox & Scoreboard (Admin)

**US-5.** As a manager on the escalation inbox (Jen, Patrick; CDV oversight), I want escalations with the context to decide, so I resolve each in under a minute.
- [ ] Each item: account, volume at stake (kgs/mo), competitor price entered, account's target, suggested commit volume per the rebate formula (§7.6), editable
- [ ] Actions: **Approve rebate** · **Match price** · **Reject / other** (+note) — decision flows back to the SA's card
- [ ] New escalations trigger a notification (email; Viber/Telegram P1 — see §7.2)
- [ ] Daily digest email if ≥1 open escalation; real-time only for top-20 accounts

**US-6.** As management, I want a scoreboard of volume vs target per segment with end-of-month projection so there are no month-end surprises.
- [ ] Per segment: MTD kgs, target, run-rate projection (existing 70/30 engine), accounts gained/lost this month
- [ ] Accounts flagged Behind Target listed with gap in kgs

### P0 — CEO digest

**US-7.** As the CEO, I want a monthly summary without logging in.
- [ ] Auto-email on the 1st: volume per segment vs target (hit/miss), net accounts gained/lost, top 5 escalations resolved
- [ ] One page; no interaction required

### P1 — Report generation (the adoption engine)

**US-8.** As a Sales Assistant, I want the app to generate my mandated reports from my logged activity.
- [ ] **Weekly Accomplishment Report** (due Saturdays): auto-compiled from logged outcomes, exportable/emailable
- [ ] **Weekly Sales Projection/Plan**: pre-filled from upcoming-cycle accounts; SA edits and submits
- [ ] **Daily Retail Sales Recon (kgs)** view, exportable CSV
- [ ] Competitor price entries compile into the Price Monitoring report

### P1 — Credit-hold badge

- [ ] If AR exceeds credit limit/terms (data confirmed available in BigQuery), card shows a Credit Hold badge before delivery confirmation

### P2 — Future considerations

- Order-entry app integration replaces the lag-bridge rule in US-2
- Viber/Telegram bot for notifications (matches existing JD reporting habit)
- Rebate redemption tracking (did the volume commitment get met?)

## 7. Key Design Rules

1. **No interpretation surfaces for SAs.** If a screen requires reading a chart to decide an action, it belongs to admin or gets deleted.
2. **Notifications land where habits already are.** JD-mandated reporting already flows through Viber/Telegram/Google Drive. V1: email (reliable, zero build risk). P1: **Telegram bot** posting formatted text with a deep link to the escalation, and attaching generated reports as files (CSV/PDF). No screenshot automation — screenshots are brittle to build, unsearchable, and unreadable on phones; a bot message with a link outperforms them in every way. In-app-only notification is not notification.
3. **Freshness rule.** Until the order-entry integration ships, BigQuery data is ~2 days stale. Any card actioned as Confirmed delivery is suppressed for its full cycle regardless of what stale data says. Never flag an account as Overdue within the lag window of its last confirmed delivery — a wrong "call today" in week one destroys trust permanently.
4. **Escalations must stay scarce.** Auto-escalation thresholds are tuned so a normal week produces < 10 items. If everything pings management, nothing does.
5. **Segment taxonomy (resolved):** four segments — Dealer, Commercial, Bulk, Retail Outlet. Retail Outlet is separated in filters, queue assignment, targets, and the Scoreboard.
6. **Rebate commit-volume formula.** For an escalated account, suggested commit volume = **max(monthly target, 110% of trailing 3-month average)**, **capped at the account's best month in the trailing 12**. Rationale: commit must feel attainable (all-time-high anchoring makes offers feel fake and kills uptake — a peak month is often a one-off), yet must buy *incremental* volume, never rebate kgs the account would have ordered anyway. The rebate pays only on volume **above the trailing 3-month baseline**. All three numbers already exist in BigQuery; the card shows the computed suggestion and lets the approver override it.

## 8. Mapping to the 7 Open PRs

| PR (page) | Designer instruction |
|---|---|
| Dashboard | Rebuild as admin **Scoreboard** (§US-6); delete CRM stream & radar |
| Intelligence | Close PR — page removed; salvage table components for Customer Profile |
| Risk | Close PR — page removed; badge styles move to queue cards |
| Proactive | Primary design effort: **Today** queue per US-1–US-3 (cards, outcomes, escalate flow, empty state) |
| Predictive AI | Close PR — page removed; projection component reused in Scoreboard |
| Gemini AI | Restyle as admin **Ask**; add Customer Search as global component (US-4) |
| Settings | Minor: role labels (SA / Admin), notification email config |

## 9. Decisions (resolved 26 Jul 2026)

| # | Decision |
|---|---|
| 1 | AR / credit-limit data **is available** in BigQuery → Credit Hold badge (P1) confirmed feasible |
| 2 | **Retail Outlet is a separate segment** → four segments: Dealer, Commercial, Bulk, Retail Outlet |
| 3 | Escalation inbox recipients post-transition: **Jen and Patrick** (CDV retains oversight access) |
| 4 | Rebate commit volume: **formula in §7.6** (baseline-plus-uplift, capped at best month in trailing 12) |
| 5 | Notifications: **email in v1; Telegram bot in P1** (formatted text + link, plus report file exports — not screenshots) |

**Remaining open:** ₱/kg discount ceiling for rebates and price-matching — CDV to set with finance so the app can enforce a max on the approval form. Non-blocking for design; blocking for launch.

## 10. Phasing

- **Phase 1 (this design cycle):** IA collapse, Today queue with outcomes + escalation, Scoreboard, Customer Search, email notifications, CEO digest.
- **Phase 2:** Report generation (US-8), credit badge, Viber/Telegram bot.
- **Phase 3:** Order-entry integration (kills the lag rule), rebate redemption tracking.

## 11. Success Metrics

**Leading (first 30 days):** 100% of SAs open Today ≥5 days/week; ≥90% of Overdue cards get an outcome within 48h; zero "already ordered" complaint calls (freshness rule working).
**Lagging (quarterly):** monthly segment targets hit; net accounts gained/lost ≥ 0; Commercial segment volume stabilized vs launch-month baseline.
