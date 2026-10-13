# Kuuki (くうき)

A flight journal with route maps, a digital passport, statistics, opt-in rankings, and ticket import with review before saving.

The app is `apps/next`: Next.js App Router and React, built with OpenNext for Cloudflare Workers. A composed Worker serves Next pages and shared API handlers. D1 stores application data; Better Auth handles credentials and sessions; Google Gemini parses tickets behind the server API. A scheduled Worker repairs pending statistics and refreshes rankings.

The Next app uses TypeScript, Tailwind CSS, Radix controls, TanStack Query, React Hook Form and Zod. Route maps use MapLibre with local assets. UI tokens and conventions live in [DESIGN.md](DESIGN.md) and [styles.css](apps/next/src/app/styles.css). Dependency ranges are in [the app manifest](apps/next/package.json); resolved versions are in [pnpm-lock.yaml](pnpm-lock.yaml).

Supabase files are retained migration history. Cloudflare Workers Builds verifies with `pnpm verify:cloudflare` and uploads candidates only to `kuuki-next-preview`; the checked-in [CI workflow](.github/workflows/ci.yml) is a manual verification fallback; production runs Next on Workers and is deployed by hand with the [deploy-kuuki skill](docs/skills/deploy-kuuki/SKILL.md). Removing Vite source does not remove the previously deployed, held Pages fallback; verify its hosted state before relying on it.

## Development

Use the Node.js version declared in [CI](.github/workflows/ci.yml) and pnpm declared by [`packageManager`](package.json). Run commands from this directory, which contains `pnpm-workspace.yaml`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm next:build
pnpm next:preview
```

Open `http://127.0.0.1:8800`. The preview runs the compiled composed Worker in local workerd with disposable D1 data and synthetic accounts. It supplies synthetic secrets and blocks outbound requests; it does not require live credentials. The console prints fixture credentials. Ctrl-C discards the fixture. Set `KUUKI_NEXT_PORT` to use another port. Set `KUUKI_NEXT_FIXTURE=minimal` for the one-flight journal that the Playwright suites assume.

For Next hot reload, use `pnpm --filter @kuuki/next dev`; this does not wire the composed Worker's API or D1 bindings. Use the compiled preview for authenticated pages and cookie, API, D1 and Worker integration checks. Rebuild with `pnpm next:build` after source changes before checking compiled behavior. Run builds and browser/runtime fixtures serially because they share build output and a port.

Root `pnpm dev` starts workspace dev tasks. `pnpm build:api` compiles the shared Pages Functions handlers used by the composed Next Worker.

## Configuration

Bindings and non-secret variables belong to the relevant configuration: [Next Worker](apps/next/wrangler.toml), [Pages Functions compiler](wrangler.toml), [maintenance](workers/maintenance/wrangler.toml) and [local import Worker](workers/import/wrangler.local.toml). The root Wrangler config points its local asset output at `apps/next/.open-next/assets`; it does not deploy a Pages frontend. Use isolated resources and credentials for each environment. Checked-in IDs alone do not prove hosted isolation.

Configure server secrets in Cloudflare or a gitignored local `.dev.vars` for the corresponding Wrangler project. Keep secrets out of browser-exposed variables such as `NEXT_PUBLIC_*`. The synthetic fixtures supply their own settings.

Google sign-in appears when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured on the Next Worker. Create a Google OAuth **Web application** client and register `${PAGES_ORIGIN}/api/auth/callback/google` as an authorized redirect URI. Use the origin alone for the authorized JavaScript origin. Production uses `https://kuuki.marchstudio.uk`; a local server on port 8800 can use `http://127.0.0.1:8800`, with that exact value in `PAGES_ORIGIN`. See [Better Auth's Google setup](https://better-auth.com/docs/authentication/google).

To test live Google authorization locally, copy [`.dev.vars.example`](.dev.vars.example) to the ignored `apps/next/.dev.vars`, fill its secrets, build, and run the composed Worker with local D1:

```bash
pnpm next:build
pnpm --filter @kuuki/next exec wrangler d1 migrations apply DB --local
pnpm --filter @kuuki/next exec wrangler dev --local --port 8800
```

Use the same hostname in the browser, `PAGES_ORIGIN`, and Google's redirect URI. This local Wrangler server permits the Google token exchange; `pnpm next:preview` uses synthetic Google credentials and blocks it. Google only requests identity scopes and always shows account selection. Returning members resume their journal, and new members enter the welcome flow. A verified authoritative Gmail/Workspace identity can confirm the matching migrated account's email and link to its existing journal when it still has `RESET_REQUIRED` and no password or provider account. Other existing accounts link implicitly only when both the local email and Google's authoritative Gmail/Workspace email are verified; an unlinked account can use the existing email-link flow to establish a password and verify the local email. Google-only accounts use that same flow to set a password before account deletion.

| Setting                                     | Purpose                                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | Independent Better Auth signing/encryption secret; generate with `openssl rand -base64 32`                                                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth Web application credentials; both enable Google sign-in. Server-only.                                                  |
| `AUTH_SECRET`                               | Password pepper; preserve the existing production value                                                                                      |
| `PAGES_ORIGIN`                              | Exact canonical origin for auth and CSRF, including the Next Worker                                                                          |
| `GEMINI_API_KEY`                            | Server-side ticket parsing and aircraft enrichment; required separately on the production and preview API Workers, not the activation Worker |
| `MAINTENANCE_MODE`                          | Request hold before private database access                                                                                                  |
| `ACTIVATION_ORIGIN`                         | Separate HTTPS origin for legacy account activation                                                                                          |
| `ACTIVATION_MAIL`                           | Native Email Sending binding on each Next Worker, restricted to the verified sender                                                          |
| `ACTIVATION_MAIL_ACCOUNT_ID`                | Account ID for the REST fallback when the native binding is absent                                                                           |
| `ACTIVATION_MAIL_FROM`                      | Verified Email Sending sender address                                                                                                        |
| `ACTIVATION_MAIL_AUTH_TOKEN`                | Email Sending server secret for the REST fallback; unused by the native binding                                                              |

Better Auth uses the same origin as the app. The application supports migrated-account activation, password recovery and optional Google sign-in. Preserve user IDs, password pepper, signing secrets and compatible sessions during migration or frontend rollback. Follow the release runbooks for schema admission and additive migrations rather than applying remote SQL from setup instructions.

## Checks

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm typecheck:api
pnpm typecheck:scripts
pnpm typecheck:maintenance
pnpm test
```

`pnpm test` runs API integration and Next unit tests. It excludes the separate composed-Worker smoke and browser suites. For Next UI and runtime changes, run the relevant checks serially against current build output:

```bash
pnpm next:build
pnpm --filter @kuuki/next typecheck:worker
pnpm next:smoke
pnpm --filter @kuuki/next exec playwright install chromium
pnpm test:next:navigation
```

The full navigation suite is required for UI changes. `pnpm next:smoke` includes the boundary checks; `pnpm next:smoke:boundary` is a shorter diagnostic alternative. After changing API paths or exported HTTP methods, regenerate and include `apps/next/api-routes.generated.ts` with `node scripts/build-next.mjs --inventory-only`; edit the handlers or generator rather than generated output.

`pnpm verify:cloudflare` runs API and Next unit tests with four workers, builds, type checks, lint, format, generated inventory and script regressions, preview isolation checks, import dry-run builds and compiled Worker smoke. Each gate must pass before the next starts. Cloudflare Workers Builds runs this command automatically. The manual GitHub Actions fallback then installs Chromium and runs the browser journeys against the same build; they can also run locally with `pnpm test:next:navigation`. React Doctor remains a manual fallback.

See [CODING_STANDARDS.md](CODING_STANDARDS.md) for checks by change type and [verification script](scripts/verify-cloudflare.sh) for the verification pipeline. `pnpm smoke:runtime` checks the compiled Pages Functions transport locally. `pnpm next:build` builds that API and OpenNext output, including activation and old service-worker retirement assets; it does not deploy. The preview/smoke scripts and `pnpm build:maintenance` use Wrangler dry-run builds.

## Structure

```text
apps/next/           Current Next app, composed Worker and browser tests
packages/client/     Browser API, flight, passport, geography and export helpers
packages/shared/     DTOs, validation, translations
packages/data/       Static airport, aircraft, airline and country references
functions/api/       Shared API/domain handlers and retained Pages wrappers
functions/test/      API and runtime regression tests
db/migrations/       D1 schema migrations
db/_snapshot/        Gitignored legacy export, for rehearsal only
scripts/             Builds, migration admission and local fixtures
workers/maintenance/ Scheduled recovery and rankings
workers/import/      Import job Worker and local configuration
supabase/            Historical schema and migrations
```

## Migration and release

Use the current [deploy procedure](docs/skills/deploy-kuuki/SKILL.md) for Worker releases and rollback. Use [the remediation release runbook](docs/runbooks/audit-remediation-release.md) and [execution status](docs/runbooks/audit-remediation-status.md) for source migration and preservation requirements. The [4 October candidate runbook](docs/runbooks/2026-10-04-next-release-candidate.md) records historical acceptance evidence.

Local preflight and dry-run builds do not authorize remote writes or cutover. Remote D1 operations require an explicit approved target, writer hold, backup/restore proof and schema admission. Production migration, cloud configuration, delivery and paid provider evaluation require their approved release change set. A frontend rollback does not roll back D1.

Deployment gates are defined in the deploy procedure and runbooks, including a clean production SHA with successful CI, migration admission and maintenance readiness. Deployments go directly to production. The existence of configuration is not evidence that those gates have passed.

See [the documentation index](docs/README.md) for product docs and [GLOSSARY.md](GLOSSARY.md) for domain terms. [TECH_STACK.md](docs/TECH_STACK.md) records the former Vite stack.

MIT © [Indi256](https://github.com/indi256)
