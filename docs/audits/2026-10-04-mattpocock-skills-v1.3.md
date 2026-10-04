# Matt Pocock skills v1.3 review

Checked 2026-10-04 against [v1.3.1](https://github.com/mattpocock/skills/releases/tag/v1.3.1), commit `24fe0ef7737efae15c87225755e9f6f5965e4888`. [v1.3.0 changelog](https://github.com/mattpocock/skills/blob/v1.3.1/CHANGELOG.md) introduces the glossary rename, promotes `implement-spec`, `pr`, and `retro`, and removes `resolving-merge-conflicts`. v1.3.1 corrects `ask-matt`'s bug-fix routing.

## Scope and result

Kuuki has 21 repository skill directories in `.agents/skills` (with Claude symlinks); none match Matt's current skill names. Those project/vendor skills have no direct upstream counterpart and were preserved. Matt's copies are global in `~/.agents/skills`; provenance was established from `~/.agents/.skill-lock.json`. The lock also retains records for archived skills, so it does not prove they are active.

Of Matt's active, surviving skills, 11 are byte-for-byte identical and 3 differ: `codebase-design`, `domain-modeling`, `tdd`. Their changes are the `CONTEXT.md` → `GLOSSARY.md` convention, including `CONTEXT-FORMAT.md` → `GLOSSARY-FORMAT.md` in domain-modeling. Global copies were compared, not modified.

[Full unified diff](./2026-10-04-mattpocock-v1.3.1.diff) includes all changed files in surviving active and archived copies, with the old copy on the left and v1.3.1 on the right. Upstream removals and missing installations are recorded below rather than represented as deletion/install proposals.

## Setup changes

Reviewed [setup-matt-pocock-skills at v1.3.1](https://github.com/mattpocock/skills/tree/v1.3.1/skills/engineering/setup-matt-pocock-skills). Its installed copy is archived at `~/.agents/skills-archive/2026-10-03/.agents__skills__setup-matt-pocock-skills`. Against that copy, only `SKILL.md` and `domain.md` change, both for the glossary rename.

Applied to Kuuki:

- Renamed root `CONTEXT.md` to `GLOSSARY.md`, preserving its contents exactly.
- Updated domain consumer guidance and live plan references. The audit's historical mention remains unchanged.
- Updated the local tracker conventions to `spec.md` and one file per ticket; retained existing `PRD.md` files as legacy inputs.
- Added the upstream local-markdown wayfinding operations for maps, child tickets, blocking, frontier, claim, and resolve.

Retained the configured local Markdown tracker, single-context glossary, and triage vocabulary. GitHub Issues also exist, but their existence alone does not authorize changing the configured tracker. Neither root `CLAUDE.md` nor `AGENTS.md` exists, so there is no root Agent skills pointer; adding one requires choosing the intended steering file. This migration does not require rerunning the interactive setup workflow or switching trackers.

## Skill inventory

| Skill | Local state | Comparison with v1.3.1 |
| --- | --- | --- |
| `code-review` | active | Identical |
| `codebase-design` | active | Changed: `DESIGN-IT-TWICE.md` |
| `domain-modeling` | active | Changed: `CONTEXT-FORMAT.md`, `GLOSSARY-FORMAT.md`, `SKILL.md` |
| `grill-me` | archived | Identical |
| `grill-with-docs` | active | Identical |
| `grilling` | active | Identical |
| `handoff` | active | Identical |
| `implement` | active | Identical |
| `improve-codebase-architecture` | archived | Changed: `SKILL.md` |
| `research` | active | Identical |
| `resolving-merge-conflicts` | active | Removed upstream |
| `retro` | active | Identical |
| `setup-matt-pocock-skills` | archived | Changed: `SKILL.md`, `domain.md` |
| `tdd` | active | Changed: `SKILL.md` |
| `teach` | archived | Identical |
| `to-prd` | archived | Removed upstream |
| `to-questionnaire` | archived | Identical |
| `to-spec` | active | Identical |
| `to-tickets` | active | Identical |
| `triage` | archived | Changed: `SKILL.md` |
| `wait-what` | archived | Changed: `SKILL.md` |
| `wayfinder` | active | Identical |
| `wizard` | archived | Identical |
| `writing-for-agents` | active | Identical |
| `writing-great-skills` | active | Removed upstream |

Promoted upstream skills absent from Matt's installation records: `ask-matt`, `diagnosing-bugs`, `implement-spec`, `pr`. These are not installed by this review.

`writing-great-skills` is superseded by the installed `writing-for-agents`. `to-prd` was already replaced by `to-spec` before v1.3. `resolving-merge-conflicts` is removed in v1.3 with no replacement. Archived copies remain archived.

## Verification

Compared every file in each provenance-recorded Matt skill with its tagged upstream counterpart, including Codex metadata and reference files. Confirmed glossary contents are unchanged and live Kuuki glossary references resolve. No application code, global skills, skill lock, existing specs, or issue-tracker selection changed.
