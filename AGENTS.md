<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deployment: Claude does it, the owner does not

The owner does not want to be handed deploy or release commands to run
themselves. When a change is merged to `main`, deploy it yourself:

1. Run `./deploy_retry.sh` (Firebase Hosting, project `sales-intel-cdv-2026`).
2. Confirm the deploy succeeded and report the outcome.

Never end a task by telling the owner to run `git pull`, `deploy_retry.sh`,
`firebase deploy`, or similar. If the environment lacks Firebase credentials
(`FIREBASE_TOKEN` or `GOOGLE_APPLICATION_CREDENTIALS`), say so in one line and
name the exact secret to add to the Claude Code environment so the next run
can deploy unattended.

Likewise, when the owner says a change is needed now, open the pull request
and merge it once it is green rather than stopping at the branch.
