# Easier onboarding: handoff

Plan: [2026-10-15-easier-onboarding.md](2026-10-15-easier-onboarding.md) (wave-plan/v1). Executed 15 October 2026 on the shared root checkout, local `main`, base `e2085a8e`. Nothing is committed, pushed or deployed.

## State

- W1, W2 and W3 are implemented and accepted. The final evidence gate ran on the scoped patch `.scratch/easier-onboarding/final.patch` (sha256 in `.scratch/easier-onboarding/final.sha256`) plus the untracked `apps/next/src/app/dev/gallery/welcome-passport-gallery.tsx`.
- Final review (GPT-6.1 Sol, high) and a dxe design review (Sonnet) ran on that patch. Their accepted findings were fixed, and the repaired identity is `final.patch` sha256 `de77e8f9…` (full hashes in `final.sha256`).
- A local commit waits for the owner's request. Commit through `docs/agents/shared-checkout.md` with the owned paths below only.

## Owned paths

```
apps/next/src/app/dev/gallery/gallery.css
apps/next/src/app/dev/gallery/gallery.tsx
apps/next/src/app/dev/gallery/welcome-passport-gallery.tsx   (new)
apps/next/src/client/import/import-client.test.tsx
apps/next/src/client/import/questions.test.ts
apps/next/src/client/import/unified-session.test.ts
apps/next/src/client/import/questions.ts
apps/next/src/client/import/review-row.tsx
apps/next/src/client/import/unified-session.ts
apps/next/src/client/welcome/**
docs/adr/0001-flight-lifecycle-and-import-drafts.md
functions/api/_services/importJob.ts
functions/test/import-drafts.test.ts
functions/test/import-runtime.test.ts
functions/test/import-stream.test.ts
docs/plans/2026-10-15-easier-onboarding.md, this handoff
```

Not ours, dirty from other threads: `apps/next/src/client/import/done-step.tsx`, `apps/next/src/client/import/import-client.tsx`, `GLOSSARY.md`, ADR 0003 and the rest of the root status. `GLOSSARY.md` needed no change: it doesn't define selection in terms of verification.

## What changed

- **W1, selection.** `rowOf` no longer requires `verification` to be `verified`. The client gates in `questions.ts` (`readyAfter`), `unified-session.ts` and `welcome/review/rows.ts` (`answerDate`) follow suit. The final verification pass still only rewrites untouched version-1 rows, so member choices win. ADR 0001 has a dated "Selection (owner, 15 October 2026)" paragraph, and its two contradicting sentences are rewritten.
- **W2, phone bench.** `usePassportBench` takes `active`. Desktop is always active. A phone becomes active while the flights step reads a batch (`onReading` → `PassportPreview.reading`) and on ready, and the bench stays mounted after that. At ≤700px `[data-bench]` shows the bench under the strip at card width, height capped near 34svh. The `.wp-visas` band and the mobile CSS WELCOME box are removed, along with the dead `STAMP`/`stampDate` copy. `/dev/gallery` has a "Welcome passport" section.
- **W3, fewer steps.** On touch, "Add a screenshot or photo" is the primary action above the unchanged prompt tray. It's one file, PNG/JPEG/PDF, with no `capture`. The outline button reads "Paste a reply", and the touch sub-line leads with screenshots. Review entered fresh from a finished read saves itself once when nothing is unsure. A reload or Back is never fresh. The import `ReviewRow` has a `quiet` prop that onboarding uses to drop the confidence and verification text.

## Evidence (final gate)

| Lane                             | Result                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                 | exit 0                                                                                                                                                                                                                                                                                                               |
| `pnpm lint`                      | exit 0 (14 warnings, all in untouched files)                                                                                                                                                                                                                                                                         |
| `pnpm format:check`              | exit 1: only 5 non-product docs fail, all pre-existing (`.ui-review/*` ×2, `docs/plans/2026-10-15-easier-onboarding.md`, `docs/plans/2026-10-15-overview-ground.md`, `docs/research/2026-10-14-ground-travel-arc-ui.md`). The plan was left unformatted on purpose, because oxfmt restructures its wave-plan header. |
| `pnpm test:api`                  | 75 files, 955 tests passed (rerun after the fixes: same)                                                                                                                                                                                                                                                             |
| `pnpm --filter @kuuki/next test` | 205 files, 1827 tests passed; after the fixes, 206 files, 1832 tests passed                                                                                                                                                                                                                                          |
| `pnpm build`                     | exit 0 (rerun after the fixes, along with typecheck and lint: all exit 0)                                                                                                                                                                                                                                            |
| Browser (Sonnet, agent-browser)  | Pass. Screenshots are in `.scratch/easier-onboarding/`.                                                                                                                                                                                                                                                              |

Browser details:

- **Gallery, 390×844:**
  - The bench is 390×244 under the strip.
  - Each "Add country" adds exactly one stamp.
  - Ready shows the WELCOME entry at opacity 1, and the removed elements are absent.
  - Reduced motion leaves the plunger still. The only animations are a 200ms opacity fade and the button transition.
  - 4× CPU throttle ran on the light pass.
  - The gallery page overflows by 4px (394 against 390) at page level. Nothing inside the passport frame overflows.
- **1280×800:** the desktop bench is unchanged.
- **`/welcome/flights` with touch** (new local fixture account on `pnpm next:preview`): the screenshot button sits above the tray, "Copy prompt" and "Paste a reply" are present, and the file input has the right `accept` and no `capture`. There's no overflow.
- **Errors:** no console errors or page errors.

Not covered in a browser: a live import read on a phone. Provider calls are blocked in the local preview, so the reading → stamping → auto-save path is proved by unit tests and the gallery fixture, not end to end.

## Open notes

- **Owner call:** the first flights screen on touch has two filled primaries, "Add a screenshot or photo" and the tray's "Copy prompt". dxe suggests making "Copy prompt" secondary on touch. Left unchanged, because the tray was to stay as it is.
- The strip's cover tab sits 8px lower on name/flights than on review/ready. That's a rule at HEAD and was left alone.
- The bench box `aspect-ratio` fix was not re-rendered: the owner allowed one browser run. The stage inside already has the same ratio, so the drawn size is unchanged. The fix only reserves the box before the drawing mounts.
- The gallery page's 4px overflow comes from the gallery itself, not the passport.

## Review

GPT-6.1 Sol (high), task `easier-onboarding-final-review-r1`, made three findings. All were confirmed by the primary and fixed:

1. **P1:** the client auto-select loop in `unified-session.ts` skipped the overall confidence and airline-score gates. It now requires confidence ≥ 0.7 (or null for non-model rows) and checks `airline_iata`.
2. **P1:** every review entry set `fresh`, so a Review button on a resumed batch could auto-save. Now only the watched-read effect passes `onReview(batch, true)`.
3. **P2:** `answerDate` and `readyAfter` ignored remaining low-confidence holds. They now hold rows with a low origin/destination/airline score or overall confidence under 0.7.

dxe review (Sonnet, `.scratch/easier-onboarding/dxe/report.md`): no critical findings. Fixed: the phone bench box reserves its height (`aspect-ratio: 600 / 376`), which removes a heading jump of about 290px when the drawing mounts; the paste screen's file button now uses the same "Add a screenshot or photo" label; and the `fresh` leak (same as Sol 2). Open items are listed above.

Each fix has a regression test (`unified-session.test.ts`, `flights-step.test.tsx`, `welcome/review/rows.test.ts`, `questions.test.ts`). No second review round was run.
