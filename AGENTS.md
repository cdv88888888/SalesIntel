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
`vercel deploy`, `firebase deploy`, or similar. Do not use `deploy_retry.sh`
or `apphosting.yaml`; they are leftovers from an earlier Firebase Hosting
setup and are not the production path. No Firebase credential is required to
ship a change.

If the Vercel MCP connector cannot see the project (403/404), say so in one
line and note that the connector needs project access granted in Vercel.
