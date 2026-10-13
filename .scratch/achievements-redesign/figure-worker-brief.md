## Common rules for every ladder figure worker

Repo: /Users/indi256/.t3/worktrees/kuuki/feat-achievements-ladders (git worktree, Kuuki flight journal, Next app in apps/next). Run every command from that root.

**You own exactly one file**: `apps/next/src/client/profile/ladders/figures/<FILE>` (currently a placeholder stub). Do not edit any other file, do not create files outside `.scratch/achievements-redesign/preview/out/`, do not run `git commit`, `git stash` or `pnpm install`. Other workers are editing sibling figure files at the same time; ignore typecheck errors in files that aren't yours.

### Read first (in this order)
1. `~/.claude/skills/anatomy/SKILL.md`, then `~/.claude/skills/anatomy/references/craft.md` (parts vocabulary, tone hierarchy, painter's order, lines that end on edges, anti-patterns). Follow the anatomy craft rules for the drawing: many small precise solid parts (seams, rivets, bevels, panel lines, gaskets, placards), crease vs silhouette strokes, painter's order back-to-front, every line ends on an edge or fades, a soft contact shadow under the base, no chunky toy boxes. You draw with the APP's own kernel (below), not the skill's kit runtime; the skill gives you the craft, the kernel gives you the API.
2. The design briefs (absolute paths): `/Users/indi256/Documents/kuuki/kuuki/.scratch/achievements-redesign/final-brief.md` (rules + your object; it wins conflicts) and `variants-brief.md` in the same folder (rung names, thresholds).
3. The code spec: `.scratch/achievements-redesign/code-spec.md` §3.
4. The contract: `apps/next/src/client/profile/ladders/figures/types.ts` and its test `figures.test.ts` (same folder).
5. The kernel: `apps/next/src/client/overview/iso/scene.ts` (Scene: `box`, `rbox`, `prism`, `poly`, `line`, `segs`, `circle`, `on`, `group`, `lit`, `glow`, `done`; paints are theme roles: top/front/side faces, `line` silhouette, `crease` interior edges, `detail` fine marks, `glass`, `ghost`, `shadow`/`shade`, `accent*`), helpers in `solids.ts` (`cylZ`, `cylX`, `cylY`, `slabRot`, `shadowDisc`, `shadowRect`, `rrOn`) and `flat.ts`. Study one finished builder end to end for the house style: `apps/next/src/client/overview/iso/stamper.ts` (and skim `cabin-window.ts`, `suitcase.ts`, `fleet.ts`).

### Contract (enforced by the test)
- `export const <EXPORT>: LadderFigureDef = { id, rungs, build(k, { rung, lod, initials }) }`, built with `new Scene(k)` and returning `s.done()`. World units ≈ 1px of the object at k=1; azimuth/elevation are fixed by the kernel.
- Exactly ONE `s.group('lit', …)` per drawing holding the accent part = the thing that changed at this rung (use `s.lit(...)` or accent paints inside it). No accent paint anywhere else. Locked/unchanged parts use normal tones.
- No text nodes (Flights top rung initials are the only exception).
- Deterministic (no Math.random; seed any texture from a fixed hash of indices).
- `lod: 'thumb'` is the same object and state for a 56px slot: drop parts finer than ~1px at that size (rivets, screws, speckle, fine ticks); keep everything that distinguishes this rung from its neighbours. Thumb must have ≤ nodes than hero. Every rung must draw differently.
- Each part sits on another part; people only as traces (never a figure).

### The 56px check comes before polish
Each rung must be told apart from its neighbours at 56px with no label. If two neighbouring rungs look alike, change the object state, not a label. Thumbs are rendered line-only (faces = background, strokes muted, lit part accent) — see the harness.

### Preview and verify (real checks, required)
- Build the preview: `pnpm exec tsx .scratch/achievements-redesign/preview/build.ts <ID>` → `.scratch/achievements-redesign/preview/out/<ID>.html` (dark then light: heroes 320×200 per rung, own-fit 56px tiles in 72px marks, the rung strip with shared k and ghost next/later states).
- Screenshot with agent-browser (read `~/.agents/skills/agent-browser/SKILL.md` first). Use your OWN session name `--session <ID>` and close it when done: `agent-browser --session <ID> open "file://<abs path>"`, `agent-browser --session <ID> screenshot --full <ID>.png`, then `sips -Z 1200 <png>` before reading it. For 4× close-ups, `agent-browser --session <ID> set viewport` / zoom via a temporary copy of the html with `style="zoom:4"` on body (keep temp files in preview/out/). Read every PNG. Iterate until each hero is instantly the real object, rich in small parts, and each 56px rung reads.
- Tests: `pnpm --filter @kuuki/next exec vitest run src/client/profile/ladders/figures` — all tests for your ladder id must pass (other ladders' failures are not yours, but report them).
- Typecheck: `pnpm --filter @kuuki/next exec tsc --noEmit -p .` — zero errors in your file.
- Format: `pnpm exec oxfmt apps/next/src/client/profile/ladders/figures/<FILE>` and lint `pnpm --filter @kuuki/next exec oxlint src/client/profile/ladders/figures/<FILE>`.

### Scope and report
When the figure is done and checked, stop and report. Don't add features, tests, files, docs or refactors that weren't asked for; if you think one would help, mention it at the end. Report: what each rung draws and what is lit; part count (hero, roughly); the paths of your final dark+light preview PNGs (downscaled); test/typecheck/lint output summaries; anything you couldn't satisfy or are unsure of. Keep the report under 400 words.
