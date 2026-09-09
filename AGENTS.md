<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deployment: Claude does it, the owner does not

Production is hosted on **Vercel** (project `sales-intel`, id
`prj_dP2IC6BjAGJChArY6NQpj81OqreZ`, team `cdv-4017s-projects`). Vercel is
connected to this GitHub repo: every push to `main` builds and deploys to
production automatically, and every PR gets a preview deployment that the
`vercel[bot]` reports in a PR comment.

So "deploy" means: merge to `main`. Concretely, when a change is ready:

1. Open the pull request and merge it once the Vercel check is green.
2. Confirm the production deployment (Vercel bot comment on the PR, or the
   Vercel MCP tools when they have access to the project) and report the
   outcome to the owner.

Never end a task by telling the owner to run `git pull`, a deploy script,
`vercel deploy`, `firebase deploy`, or similar. No Firebase credential is
required to ship a change to Vercel.

If the Vercel MCP connector cannot see the project (403/404), say so in one
line and note that the connector needs project access granted in Vercel.

## Firebase App Hosting migration (in progress)

The owner wants hosting consolidated onto the existing Google billing
account. A Firebase App Hosting backend on project `sales-intel-cdv-2026`,
connected to this repo with `main` as the live branch, is being trialled
alongside Vercel. `apphosting.yaml` is the live config for that backend:

- Firebase web config comes from `FIREBASE_WEBAPP_CONFIG`, which App Hosting
  injects for the associated web app; `next.config.mjs` maps it onto the
  `NEXT_PUBLIC_FIREBASE_*` variables. Do not hard-code those values.
- Secrets (`SESSION_SECRET`, `GEMINI_API_KEY`, `MONDAY_API_TOKEN`,
  `BQ_CREDENTIALS_JSON`) are Secret Manager references. A rollout that fails
  in the `preparer` step within seconds almost always means a referenced
  secret is missing or the App Hosting compute service account lacks
  "Secret Manager Secret Accessor" on it.
- The old `relationship-hub` backend (us-east4, source-upload, failed
  June 2026) is not the target; it is to be deleted after cutover.

Vercel remains production until the App Hosting backend serves a working
login and data load and the domain is switched. Update this section when the
cutover happens.
