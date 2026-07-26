# Original User Request

## Initial Request — 2026-06-27T04:16:13Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Ensure the production site is live and functional within 20 minutes.

The user is away. Your objective is to ensure that the Next.js application deployed at `https://sales-intel-cdv-2026.web.app` is fully functional and does not throw a 500 Internal Server Error.

Working directory: /Users/cdv/.gemini/antigravity/scratch/CDV-sales-intelligence
Integrity mode: development

## Requirements

### R1. Live Site Verification
Verify that `https://sales-intel-cdv-2026.web.app/risk` loads successfully without a 500 Internal Server Error. 
Note: A deployment was just triggered manually before you were spawned. Please wait for it to finish and check if the site is healthy. If the site is healthy, no further action is required.

### R2. Fallback Fix Implementation
If the current deployment fails or still results in a 500 error (e.g. `ERR_MODULE_NOT_FOUND` for Turbopack external dependencies like `firebase-admin-a14c8a5423a75469`), implement a robust fix. This may involve modifying `next.config.mjs` (e.g. removing `serverExternalPackages`), completely removing `firebase-admin` and rewriting the session validation to avoid Firebase Admin entirely, or using a standard webpack build. Deploy the fix and verify.

### R3. Time Constraint
You have a maximum of 20 minutes to complete this task.

## Acceptance Criteria

### Production Health
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://sales-intel-cdv-2026.web.app/risk` returns 200.
- [ ] No `500 Internal Server Error` is visible on the live site.
- [ ] Cloud Function logs (`npx -y firebase-tools@latest functions:log`) show no crash loops.

## Follow-up — 2026-07-16T02:10:40Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Add a new "Confirmed Delivery" column to the Proactive Calling Kanban board and implement interactive client-side drag-and-drop, allowing cards from the "Overdue" and "Call Today" columns to be dragged and dropped into "Confirmed Delivery". Each card in the "Confirmed Delivery" column must display a date field.

Working directory: /Users/cdv/.gemini/antigravity/scratch/CDV-sales-intelligence
Integrity mode: development

## Requirements

### R1. Confirmed Delivery Column
Create a new column titled "Confirmed Delivery" styled in blue (e.g. using Tailwind/CSS style matching the theme) placed to the right of the "Call Today" column (or at the end of the board).

### R2. Drag and Drop Interaction
Implement interactive client-side drag-and-drop functionality on the Proactive Calling Kanban page:
- Cards in the "Overdue" and "Call Today" columns must be draggable.
- The "Confirmed Delivery" column must accept dropped cards from these columns.
- Dropping a card from "Overdue" or "Call Today" moves it to the "Confirmed Delivery" column.
- Prevent card clicks or drag operations from triggering the existing column expansion logic.

### R3. Delivery Date Field
- Cards in the "Confirmed Delivery" column display a delivery date field.
- When a card is dropped into "Confirmed Delivery", it should default to the current date (today).
- The user must be able to change/edit this delivery date (e.g., using a native date input `<input type="date">` styled nicely to fit the dark theme).

## Acceptance Criteria

### Kanban Layout & Styling
- [ ] A new column "Confirmed Delivery" is rendered on `/proactive` with a blue design theme (top border and header text styled in blue).
- [ ] Card counts badge displays the correct number of cards in "Confirmed Delivery".

### Drag and Drop Functionality
- [ ] Cards in "Overdue" and "Call Today" can be successfully dragged.
- [ ] Dragging these cards and dropping them onto "Confirmed Delivery" moves them to the "Confirmed Delivery" column in the UI immediately.
- [ ] Interacting with cards (dragging, editing date) does not trigger the column expansion view of `ExpandableKanban`.

### Delivery Date Field
- [ ] Cards in the "Confirmed Delivery" column display an editable date input.
- [ ] The default value is set to today's date upon drop.
- [ ] The date value changes correctly when the user selects a new date via the date picker.

## Follow-up — 2026-07-22T19:00:55Z

Migrate the user authorization whitelist and role management to Firestore, making it manageable in real-time from the settings page.

Working directory: /Users/cdv/.gemini/antigravity/scratch/CDV-sales-intelligence
Integrity mode: development

## Requirements

### R1. Firestore Whitelist Store
Migrate the user whitelisting and role mapping database from local files and environment parsing to a Firestore collection named `whitelisted_users`. Each document ID should be the lowercase email of the whitelisted user, and contain at least:
* `email`: String (original user email)
* `role`: String (`admin` or `viewer`)
* `timestamp`: Timestamp

### R2. Settings and Auth API Routes
Update the route handlers for `/api/whitelist` (GET, POST, PUT, DELETE) and `/api/auth/session` (GET) to read and write directly to Firestore for user whitelist and role lookups in both development and production.

### R3. Middleware Routing Proxy
Update the Next.js routing proxy (`src/proxy.js`) to query the `whitelisted_users` collection via the Firestore REST API instead of using static environment variables.
* The REST call should build the URL using the project ID environment variable.
* Implement a short memory cache (e.g. 15 seconds) for the whitelist results in the middleware to optimize loading speed and prevent API rate-limiting.
* Implement a try-catch fallback in the middleware that checks the static `AUTH_WHITELIST` environment variable or defaults if Firestore is offline.

### R4. Automatic Seeding
If the `whitelisted_users` collection in Firestore is empty, the application must automatically seed it with the default admins (`cdv@masaganagas.com`, `team@example.com`) and default viewers from `AUTH_WHITELIST` or the default emails list.

## Acceptance Criteria

### Whitelist & RBAC Verification
- [ ] Whitelisted users can authenticate and access `/intelligence` in both dev and prod.
- [ ] Users with `admin` role can access `/settings` and manage the whitelist.
- [ ] Users with `viewer` role are blocked from `/settings` and `/admin` with `403 Forbidden` or redirect to `/access-denied`.
- [ ] Adding, removing, or updating a user's role on the Settings page writes to the Firestore collection in real-time, and takes effect instantly.
- [ ] All 52 E2E tests pass successfully when run.

## Follow-up — 2026-07-23T07:19:36Z

Implement bidirectional Kanban drag-and-drop on the Proactive Calling board, verify Next.js proxy conventions, and harden local E2E test runners against process port contention and cold-start proxy 502 errors.

Working directory: /Users/cdv/.gemini/antigravity/scratch/CDV-sales-intelligence
Integrity mode: development

## Requirements

### R1. Bidirectional Kanban Drag-and-Drop
- Cards in the "Confirmed Delivery" column on `/proactive` must be draggable.
- Dragging a card from "Confirmed Delivery" and dropping it onto "Overdue" or "Call Today" moves the card back to that column.
- Dropping a card back into "Overdue" or "Call Today" clears its `deliveryDate` field and restores its column sorting.
- Dragging/dropping cards must continue to prevent parent column expansion (`e.stopPropagation()`).

### R2. Next.js Proxy & Deprecation Cleanup
- Ensure `next.config.mjs` uses `skipProxyUrlNormalize: true` with zero remaining deprecated `skipMiddlewareUrlNormalize` references.
- Ensure route guards and middleware follow Next.js 16 `src/proxy.js` conventions.

### R3. E2E Test Process Resiliency & Port Management
- Update test scripts (`tests/run-e2e-real.js`, `tests/run-e2e-real-auditor.js`, `tests/run-e2e-real-challenger.js`, `tests/run_52_e2e_real_verification.mjs`) to detect and terminate any orphan `next dev` processes under the workspace before spawning the dev server.
- Harden the edge proxy retry mechanism in E2E scripts with sufficient retries and exponential/linear backoff so cold Turbopack route compilation does not trigger 502/ECONNREFUSED test failures.

## Acceptance Criteria

### Kanban Drag & Drop
- [ ] Cards in "Confirmed Delivery" can be dragged into "Overdue" or "Call Today".
- [ ] Returning a card to "Overdue" or "Call Today" removes its delivery date picker and updates the count badges for both columns.
- [ ] Card clicks and drag events do not trigger parent accordion column expansion.

### Next.js Proxy & Clean Build
- [ ] `next build` or `next dev` runs without deprecation warnings regarding `skipMiddlewareUrlNormalize` or `middleware`.

### E2E Test Suite Execution
- [ ] Running `npm run test:e2e` automatically cleans orphan dev server processes.
- [ ] All 52 E2E test cases pass cleanly with 100% success rate (`0 failed`).



