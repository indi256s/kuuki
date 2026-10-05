---
name: update-docs-after-feature
description: Reconcile affected documentation when features, bug fixes or refactors change routes, package structure, runtime, bindings, commands or operational contracts; also use for explicit documentation drift checks.
---

# Reconcile Documentation

Update affected docs in the same change that invalidates them. Include bug fixes and refactors when they change documented behavior or structure. No prior code commit or separate docs commit is required; this skill does not authorize commits, pushes or deployments.

## Sources and destinations

Paths below are relative to the repository root. Resolve changing facts from the actual tree and configuration, rather than from the prose being corrected.

| Changed claim | Verify against | Update when affected |
| --- | --- | --- |
| App structure and routes | `apps/next`, `functions/api`, `apps/next/worker.ts`, `scripts/build-next.mjs` | `README.md`, `docs/README.md`, applicable `AGENTS.md` |
| Commands and dependencies | Root/package `package.json`, `pnpm-lock.yaml`, `.github/workflows/` | Setup/check instructions and relevant runbooks |
| Bindings and release behavior | Relevant `wrangler.toml`, workflows and runtime handlers | Relevant release runbook and applicable `AGENTS.md` |
| Domain or UI contract | Changed handlers/components, relevant ADR, `GLOSSARY.md`, `DESIGN.md` | Relevant ADR/design docs and active plan or `.scratch/` issue |

For Next runtime/cutover claims, read `docs/runbooks/2026-10-04-next-release-candidate.md`; for D1 migration gates, read `docs/runbooks/audit-remediation-release.md`. Treat `docs/TECH_STACK.md`, original MVP phases and Supabase material as explicitly historical where marked. Update phase/task status only when that document tracks the current task.

## Process

1. Identify the documented claims affected by the change. For an explicit drift check, scope the claims to the requested documents.
2. Verify each affected path, command, binding and behavior against its owning source. Distinguish implemented code, local verification, CI deployment behavior and hosted release acceptance. Report unresolved conflicts instead of inventing acceptance or approval.
3. Correct only stale claims and pointers. Preserve labeled historical records; keep desired ADR requirements distinct from observed configuration. Use source links for versions and changing inventories.
4. Check that written paths and commands exist and their options match the scripts. Search for old names in related instructions to catch dangling references. Run a documented example only when needed and within the task's authorization.

Finish when each affected claim is corrected, retained with an explicit historical label, or reported as unresolved. Prose-only changes need source/link verification, not an application build.
