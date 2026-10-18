# Project: CDV-sales-intelligence Firebase Auth & App Hosting Integration

## Architecture
This project integrates Firebase Authentication (Google Sign-In) and Firebase App Hosting into an existing Next.js application, enforcing strict authorization for a whitelist of team members. It also enhances the Proactive Calling Kanban board with interactive client-side drag-and-drop functionality and a new status column.

### Data Flow & Auth Flow
1. **User Access Request**: User navigates to any route (e.g., `/`, `/intelligence`).
2. **Next.js Middleware Guard**: Middleware intercepts the request, checks for session cookie or token. If not authenticated, redirects to `/login`.
3. **Authentication**: On `/login`, user clicks "Sign in with Google", which triggers Firebase Google Sign-In (using the client SDK).
4. **Access Restriction (Authorization)**: Once authenticated, the user's email is retrieved. The app checks this email against a hardcoded whitelist.
   - If **allowed**: Redirects to the originally requested route or `/`.
   - If **denied**: Redirects to `/access-denied` and invalidates any auth session on client.
5. **App Hosting Deployment**: The app is built and deployed via Firebase App Hosting, utilizing `firebase.json` and `apphosting.yaml`.

### Proactive Calling Kanban Flow
1. **Initial Render**: Page fetches proactive calling data server-side and renders cards in their default columns (Overdue, Call Today, Upcoming, Recently Ordered) based on expected order date.
2. **Drag & Drop**: User drags a card from "Overdue" or "Call Today" and drops it into "Confirmed Delivery".
3. **Column Transition**: The card is moved in the client-side state to the "Confirmed Delivery" column, updating the count badges.
4. **Delivery Date Edit**: Dropped cards display an editable date input defaulted to today. Editing the input updates the card's delivery date in local state.
5. **Click/Drag Isolation**: Card click, drag, and input edit events have propagation stopped so they do not trigger the parent `ExpandableKanban` column expansion logic.

## Milestones

### E2E Testing Track (E2ET)
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| T1 | E2E Test Suite | Design test harness, write Tier 1-4 test cases verifying Auth, Access Restriction, and routing guards. Publish `TEST_READY.md`. | None | DONE |

### Implementation Track (IMPL)
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| I1 | Firebase Setup | Provision Firebase Auth config, initialize client-side Firebase Auth SDK, configure environment variables. | None | DONE |
| I2 | Auth pages & Guard | Create `/login` page with Google Sign-in trigger. Implement Middleware or Layout-level navigation guard redirecting unauthenticated requests to `/login`. | I1 | DONE |
| I3 | Authorization Layer | Create whitelist check, `/access-denied` page. Deny access and clear session if email is not on whitelist. | I2 | DONE |
| I4 | Deploy & Final E2E | Configure `apphosting.yaml` and `firebase.json` for Firebase App Hosting. Run build, pass 100% of E2E tests, and complete Phase 2 adversarial hardening. | I3, T1 | DONE |
| I5 | Proactive Kanban Board | Add "Confirmed Delivery" column, implement drag-and-drop from Overdue/Call Today, show delivery date field defaulting to today, and isolate events from ExpandableKanban. | I4 | DONE |

### Whitelist & RBAC Migration Track (WL)
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Firestore Whitelist Store & APIs | Implement `whitelisted_users` Firestore collection handling (doc ID = lowercase email, fields `email`, `role`, `timestamp`), auto-seeding default admins/viewers if empty, update `/api/whitelist` (GET, POST, PUT, DELETE) and `/api/auth/session` (GET). | I5 | DONE |
| M2 | Middleware Proxy & RBAC | Update `src/proxy.js` to query Firestore REST API with 15s memory cache and fallback to `AUTH_WHITELIST`/defaults. Enforce admin vs viewer RBAC (`/settings` & `/admin` blocked for viewers). | M1 | DONE |
| M3 | Settings Page UI | Connect `/settings` page to `/api/whitelist` for real-time user role management (add, edit role, remove user). | M1, M2 | DONE |
| M4 | E2E Verification & Audit | Verify all 52 E2E tests pass, verify RBAC in dev and prod, run Forensic Auditor to verify clean integrity. | M1, M2, M3 | DONE |

## Interface Contracts

### Client Auth SDK ↔ App Pages
- `loginUser()`: Initiates Firebase popup / redirect Google sign-in. Returns authenticated user object or throws error.
- `logoutUser()`: Signs out from Firebase. Clears client session.
- `checkUserAccess(email)`: Returns boolean indicating if email is on whitelist.

### Middleware / Guard ↔ Authentication State
- Intercepts requests for protected paths (`/`, `/intelligence`, `/settings`, `/predictive-ai`, `/proactive`).
- Excludes public paths (`/login`, `/access-denied`, `/api/auth/session` or static files).
- Communicates authentication and authorization status via secure cookies or session headers.

### Kanban Component Props & Event Handlers
- Cards in "Overdue" and "Call Today" are draggable (`draggable="true"` or via a React DND library).
- Column "Confirmed Delivery" registers as a drop target.
- Card events (onDragStart, onClick, onMouseDown, onChange) call `e.stopPropagation()` to prevent triggering parent `ExpandableKanban` component click handler.

## Code Layout
- `src/lib/firebase.js` — Firebase client initialization.
- `src/lib/auth.js` — Auth helpers (Google provider, signIn, signOut, checkUserAccess).
- `src/middleware.js` — Next.js routing guard middleware.
- `src/app/login/page.js` — User-facing login view.
- `src/app/access-denied/page.js` — User-facing access denied view.
- `src/app/proactive/page.js` — Proactive calling Kanban board page.
- `src/app/proactive/page.module.css` — Proactive page custom styling.
- `src/components/ExpandableKanban.js` — Accordion-like wrapper for Kanban columns.
- `firebase.json` — Firebase services configuration.
- `apphosting.yaml` — Firebase App Hosting environment config.
