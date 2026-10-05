# Working on K9SAR

Read `docs/MAINTENANCE_AND_HANDOFF.md` before infrastructure, deployment, database,
authentication, or email changes. It covers both repositories and the verified
production layout. Keep it current when behavior or operating procedures change.

- Frontend entry: `src/main.jsx`; shared API helpers: `src/lib/api.ts`.
- Use the npm lockfile. Build with `npm run build`; lint with `npm run lint`.
- Baseline on 2026-10-05: build passes; lint has 16 errors and 5 warnings. Distinguish
  existing findings from regressions. No frontend test script is configured.
- Backend source is a separate repository, `TSK9SAR/k9sar_backend`. Production
  access and deployment are separate from a local frontend build.
- Keep credentials, SSH configuration/private keys, member data, and production
  environment files out of commits and output. `VITE_*` values reach the browser.
- Preserve existing no-reply and catch-all email forwarding. Forum email replies
  use only the dedicated `forum@tsk9sar.org` Cloudflare Worker route.
- Do not assume legacy sync/deploy scripts match production; the guide records
  known differences from the live configuration.
- Preserve preview/confirm flows for destructive administration and enforce
  authorization in the backend, not just in frontend route guards.
