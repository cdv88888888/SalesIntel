<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# How the owner wants answers

- **Short.** A few lines, not an essay. No option surveys, no restating what
  he already said. Lead with the answer.
- **New to coding, clear on systems.** Skip the code tutorial; explain what a
  thing does and what it costs him, not how the syntax works.
- **When he asks how to do something, walk him through it.** Numbered steps,
  one action each, naming the exact button/field/page to click. Never answer a
  "how do I" with a concept and leave him to work out the clicks.

# Deployment: Claude does it, the owner does not

Production is **Firebase App Hosting**, backend `sales-intel` in `asia-east1`
on project `sales-intel-cdv-2026`, serving
https://sales-intel--sales-intel-cdv-2026.asia-east1.hosted.app - the URL the
team actually uses. The backend is connected to this GitHub repo with `main` as
its live branch, so every merge to `main` starts a rollout automatically.

So "deploy" means: merge to `main`. Concretely, when a change is ready:

1. Open the pull request and merge it.
2. Confirm the rollout reached "Current" in the console (App Hosting > the
   backend > Rollouts) and report the outcome to the owner.

Never end a task by telling the owner to run `git pull`, a deploy script or
`firebase deploy`. Merging is the whole deployment.

A rollout takes roughly four minutes. A failure in the `preparer` step within
seconds means a referenced secret is missing or unreadable; a failure in
`build` is a real build error, and the Cloud Build log names it.

## Configuration

- Firebase web config comes from `FIREBASE_WEBAPP_CONFIG`, which App Hosting
  injects for the associated web app; `next.config.mjs` maps it onto the
  `NEXT_PUBLIC_FIREBASE_*` variables. Do not hard-code those values.
- `SESSION_SECRET` is a console environment-variable override on the backend
  (Settings > Environment), not a Secret Manager reference: the Secret Manager
  IAM grants never resolved. It is mandatory - `src/lib/session.js` keeps no
  committed fallback key, so a backend without it fails closed (login returns
  503, existing cookies are rejected). Check that override first if sign-in
  breaks after a rollout.
- BigQuery uses no key file. With `BQ_CREDENTIALS_JSON` unset, the client
  authenticates as the App Hosting compute service account, which holds
  BigQuery Data Viewer and Job User on `accounts-recieva`. `BQ_PROJECT_ID`
  points jobs at that project.
- Firestore (`whitelisted_users`, `settings`, `access_logs`) is reached only
  from the server, through the Admin SDK in `src/lib/firebase-admin.js`,
  authenticated as the App Hosting compute service account - no key file. The
  browser never talks to Firestore, so `firestore.rules` denies all client
  access. A rollout does **not** publish `firestore.rules`: after editing that
  file, paste it into Firebase console > Firestore Database > Rules > Publish.
  Firestore failures fall back silently to the built-in whitelist and
  in-memory targets, so if saved targets or new users vanish after a restart,
  look for `Firestore` errors in the backend logs first.
- `MONDAY_API_TOKEN` is a commented-out Secret Manager reference in
  `apphosting.yaml`, pending the same IAM problem; set it as a console
  override instead.
- `ANTHROPIC_API_KEY` powers the Claude chat assistant (`/api/chat`). It is a
  console environment-variable override, like `SESSION_SECRET`. Without it the
  chat answers "ANTHROPIC_API_KEY is not set".
- `CRON_SECRET` guards the scheduled volume-alert run (`POST /api/cron/alerts`).
  It is a console environment-variable override, and the same value is stored
  as the `CRON_SECRET` repository secret on GitHub, where the
  `.github/workflows/volume-alerts.yml` workflow calls the endpoint every two
  days. Without it the endpoint answers 503 and no scheduled run happens. The
  run also needs `ANTHROPIC_API_KEY` to write explanations.

Vercel hosted this app until September 2026 and is being decommissioned. If
anything in the repo still refers to Vercel as production, it is stale.
