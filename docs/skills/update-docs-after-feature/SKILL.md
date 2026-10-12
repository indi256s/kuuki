---
name: update-docs-after-feature
description: Reconcile affected documentation when features, bug fixes or refactors change routes, package structure, runtime, bindings, commands or operational contracts; also use for explicit documentation drift checks.
---

# Reconcile Documentation

Update affected docs in the same change that invalidates them. Include bug fixes and refactors when they change documented behavior or structure. No prior code commit or separate docs commit is required; this skill does not authorize commits, pushes or deployments.

## Sources and destinations

Paths in the table are relative to the repository root. Resolve changing facts from the actual tree and configuration, rather than from the prose being corrected.

| Changed claim                                 | Verify against                                                                                              | Update when affected                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| App structure, routes and navigation          | `apps/next`, `functions/api`, `apps/next/worker.ts`, `scripts/build-next.mjs`, owning navigation components | `README.md`, `docs/README.md`, `docs/APP_FLOW.md`, `docs/SITEMAP.md`, applicable `AGENTS.md` |
| Commands and dependencies                     | Root/package `package.json`, `pnpm-lock.yaml`, `.github/workflows/`                                         | Setup/check instructions and relevant runbooks                                               |
| Bindings and release behavior                 | Relevant `wrangler.toml`, workflows, runtime handlers and current deploy procedure                          | Relevant release runbook and applicable `AGENTS.md`                                          |
| Domain or UI contract                         | Changed handlers/components, relevant ADR, `GLOSSARY.md`, `DESIGN.md`                                       | Relevant ADR/design docs and active plan or `.scratch/` issue                                |
| Plan scope, execution status or resume inputs | Owning checkout, Git and review evidence, adjacent handoff                                                  | Affected plan and its adjacent `*-handoff.md`, following `docs/agents/issue-tracker.md`      |

For runtime and release claims, read the current [deploy procedure](../deploy-kuuki/SKILL.md); for D1 migration gates, read [audit-remediation-release.md](../../runbooks/audit-remediation-release.md). The [4 October Next candidate runbook](../../runbooks/2026-10-04-next-release-candidate.md), `docs/TECH_STACK.md`, original MVP phases and Supabase material are historical where marked. Execution status and resume context belong in the adjacent handoff under [issue-tracker.md](../../agents/issue-tracker.md) § Plans and handoffs; update task status only when that document tracks the current task. Link to owning sources instead of copying mutable route, primitive or command inventories.

## Process

1. Identify the documented claims affected by the change. For an explicit drift check, scope the claims to the requested documents. If the workflow needs a named skill, consult the available catalog first; before declaring it absent, search the listed skill roots and repository skill directories for its exact `SKILL.md`. Resolve supporting resources relative to the discovered skill file, including symlink targets.
2. Verify each affected path, command, binding and behavior against its owning source. Distinguish implemented code, local verification, CI deployment behavior and hosted release acceptance. Report unresolved conflicts instead of inventing acceptance or approval.
3. Correct only stale claims and pointers. Preserve labeled historical records; keep desired ADR requirements distinct from observed configuration. Use source links for versions and changing inventories.
4. Check changed local links and literal paths mechanically with an existing check or a focused one-off existence check, resolving skill symlinks before relative links. Verify commands against package scripts and search related instructions for old names. Run a documented example only when needed and within the task's authorization.
5. For changed handoffs, verify every required resume input is committed and available at the named revision, or explicitly checkout-local with its owning checkout and exact retrieval steps. Reconcile status against Git and check/review evidence; path existence alone does not establish progress.

Finish when each affected claim is corrected, retained with an explicit historical label, or reported as unresolved. Prose-only changes need source/link verification, not an application build.
