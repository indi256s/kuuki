# Kuuki tech stack

> Legacy: describes the Vite app (apps/web). For current work on apps/next, read [DESIGN.md](../DESIGN.md) for UI and [GLOSSARY.md](../GLOSSARY.md) for domain terms.

Manifests specify compatible ranges; `pnpm-lock.yaml` records the installed versions. Use the lockfile rather than treating older documentation as a version pin.

| Layer | Current implementation |
| --- | --- |
| Web | React 19, TypeScript, Vite, React Router |
| UI | Tailwind CSS 4, shadcn/ui and Radix |
| State | Zustand and TanStack Query |
| Forms | React Hook Form and Zod; shared flight validation at API boundaries |
| Translation | react-i18next, Russian and English |
| Maps/charts | react-simple-maps and Recharts |
| Hosting/API | Cloudflare Pages and Pages Functions |
| Database | Cloudflare D1, additive SQL migrations |
| Authentication | Better Auth with D1 credential accounts and sessions, existing peppered passwords, HTTP-only signed session cookie and CSRF cookie |
| Activation delivery | Cloudflare Email Sending REST API; fake sender for local proof |
| Recovery | Scheduled maintenance Worker, revision-guarded derived-state publication |
| AI | Server-side `@google/genai`; model configuration and provider errors stay behind the API |
| Toolchain | Node.js 24, pnpm 9.15.0, Turborepo, Wrangler |
| Testing | Vitest, Testing Library, Miniflare D1 and compiled local workerd smoke |

## Runtime contracts

The browser uses same-origin `/api` requests. Mutations require the CSRF cookie/header pair. Ownership is enforced in every user query; Supabase RLS is no longer the live authorization layer.

A create request carries an `Idempotency-Key`. A retry must retain its original key and payload. Canonical mutations and dirty revisions commit together; statistics, visits and badges publish atomically for that revision. A saved flight may return `derived_state: pending`; the client waits for recovery without creating another flight. Maintenance retries dirty users and refreshes rankings every five minutes. Its status records the last successful cycle; operators investigate a gap longer than fifteen minutes.

Migrated accounts initially use `RESET_REQUIRED`. Activation requires a short-lived, one-use email token on a separate HTTPS origin. The server stores only its digest. Active users keep their existing credentials, and activation is not a general password-reset service. Preserve the production `AUTH_SECRET` when migrating.

Activation delivery uses the fixed Cloudflare Email Sending API with text and HTML content. Only an explicit delivered or queued acknowledgement for the intended recipient counts as provider acceptance. Account ID, verified sender address and a secret scoped to Email Sending are required; real delivery remains gated on domain onboarding and an authorized recipient test. See [the sender setup](runbooks/audit-remediation-release.md#activation-delivery) for operational requirements.

Modern browsers with Web Locks coordinate requests and identity changes across tabs. Browsers without Web Locks retain a per-tab fallback; full cross-tab identity protection is a release compatibility limitation. Old tabs should reload after cutover. The activation origin serves isolated assets and does not serve the application service worker.

Ticket extraction produces review drafts, never automatic database writes. Missing years and other uncertain fields require confirmation. Fake-provider checks establish the HTTP/SDK integration; real OCR quality, latency, cost and retention require a separate approved corpus evaluation.

## Configuration and references

D1 and import KV bindings belong to each environment. Preview and production must never share them. Server configuration includes `BETTER_AUTH_SECRET`, `AUTH_SECRET`, `PAGES_ORIGIN`, `GEMINI_API_KEY`, `MAINTENANCE_MODE` and activation delivery settings. See [the release runbook](runbooks/audit-remediation-release.md) for exact gates and secret handling.

`packages/data` supplies web reference data; D1 migration references include an additive, provenance-recorded supplement. Unknown historical route codes remain raw historical evidence instead of being mapped to guessed airports. Supabase migrations and export artifacts are historical inputs retained until production cutover is accepted.

## Commands

Use the [README](../README.md) for setup and check commands. `pnpm build:maintenance` is a local dry run, and `pnpm dev:fixture` is an isolated synthetic app. Source migration and validation require explicit targets; do not use legacy reset or global replacement scripts on a populated database.

GitHub Actions verifies the same SHA used for deployment. External preview isolation, required branch checks, Pages Git deployment shutdown, schema/evidence readiness and maintenance activation are operational gates, not facts proved by the presence of workflow YAML.
