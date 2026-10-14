## Figure rework pass (after the dxe design audit, 2026-10-13)

Follow `.scratch/achievements-redesign/figure-worker-brief.md` (common rules: anatomy skill + craft.md, contract, harness, checks, own one file, no commits) with these changes:

- Your file is already a finished figure. This is a targeted rework of specific audit findings, not a rewrite: keep everything that works, change what the findings name.
- The briefs at `/Users/indi256/Documents/kuuki/kuuki/.scratch/achievements-redesign/` no longer exist; skip them. `code-spec.md` §3 is the design source.
- The harness already reflects two shared changes made in the main thread: dark hero faces are lifted one step, and the `later` ghost is at 50%. Don't compensate for either in your file.
- **Accent restraint (applies to every figure).** The lit part is the one thing that changed at this rung, drawn restrained: any lit face larger than about 1200 px² at hero size is accent OUTLINE plus at most a 30% accent fill (or ridge/edge lines only), never a solid accent slab. Small lit parts (a pin head, a blip, a candle flame, a prop disc) may stay solid. Check `scene.ts` for how polygon `opacity` / stroke paints work.
- **56px first.** Judge every change in the preview's 56px tiles AND the shared-k strip, in both themes, before polishing the hero. Neighbouring rungs must differ at a glance with no label. The thumb must not be busier than the hero.
- Other workers are editing the sibling figure files right now. Touch only your file; use agent-browser session `rework-<ID>`, and close it at the end.
- Report under 300 words: what changed per finding, what's lit per rung now, final PNG paths, test/tsc/oxlint/oxfmt results, anything left undone.
