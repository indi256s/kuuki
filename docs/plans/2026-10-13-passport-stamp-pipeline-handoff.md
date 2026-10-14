# Passport stamp pipeline — final handoff

Plan: [2026-10-13-passport-stamp-pipeline.md](2026-10-13-passport-stamp-pipeline.md).
Owning checkout: `/Users/indi256/.t3/worktrees/kuuki/feat-passport-stamps`, branch `feat/passport-stamps`.
Final source candidate: `479b5ebc436f693e0bfabe957517ce7e36b4b626`; initial art/review candidate `fcf07d6a0145214eb0581d6368fe9a120dd13159`. Review base: `f3b47eda3b14e97f192d6970b9d35b97e3dc33ee` (merge-base with main).
Local main integration authorized by the owner on 2026-10-14. Containing merge: `3dd0df80`, including current main `4f9ef904` and the stamp pipeline. Transfer uses fast-forward and preserves unrelated staged, unstaged and untracked work. No push or deployment; Passport, country-sheet and import integration remain outside this branch's scope.

## Delivered source

- W1/W2: deterministic engraving engine, frame and eight ink palettes, impression wear, `CountryStamp`, dev-only contact sheet and persisted Accept/Redo notes. The stamp check is part of `verify:cloudflare`. Shared press memory prevents a travelling stamp from replaying.
- W3: all **246 countries engraved**, no fallback entries. Committed assets include 246 engravings, 246 baked native-script ring labels, five shared impression masks, and the generated client index. No font shaping or art kit runs in the client.
- Ring direction supersedes the original plan's A5: native endonym above, English below; no country code; repeated names omit the second line. HarfBuzz shaping and tracked Noto CJK subsets preserve native scripts. HK/MO/MM display-name overrides remove ICU parentheticals.
- Owner sign-off on 2026-10-14: six reference countries accepted; impression wear and current dark inks retained; oval made rounder (176×192); JP changed from Himeji to Mount Fuji. Final source-render comparison against `b24cc475` confirms AM/DE/GE/JP/ME/TH SVGs remain byte-identical.
- Final regional art commits: A `b7686bee`, B `6f713428`, C `ad2274f8`; merges `4187b2a1`, `3f9cfbda`, `40874172`. User's final execution override: finish the work, all delegates `gpt-6.1-sol` with low reasoning, including the one final reviewer.
- Final integration fixes: default ground horizon is occluded by the subject; the accepted six explicitly retain their signed-off horizon. One regression test pins the failure. Four superseded, unused waterfall implementations removed. Registry module tags now match recipes; final silhouette clusters drive ink assignment. `check:stamps` rejects clusters above eight members and duplicate inks within a cluster. Planted collision/overflow checks were observed failing before catalog correction.
- Worst-case strips now render ring names on all five shapes, using textual short forms for TF (`T. australes`) and CF (`C. Africa`). The live Node font baker externalizes its existing font-data packages and HarfBuzz, and uses native source-font paths; no Expo runtime or browser fonts were added.
- Six recipes were retuned after final ink assignment (AR/BS/PE/IE/UA/GY); other small horizon-related retunes are AQ/BL/BR/FI/GB/IT/JE/MD/SI. Thresholds were not weakened.

## Local verification

- `pnpm check:stamps`: all 246 pass at the candidate. Includes geometry, worn 96px raster, ring fit/contrast, impression metrics, catalog inks, and byte drift.
- Generation: two consecutive runs produced identical hashes for 498 output files (497 SVGs plus index). A further `pnpm generate:stamps` on the committed candidate followed by `git diff --exit-code` returned 0.
- Commit hook: formatting, lint and typecheck passed on the candidate. The initial full gate also passed 176 Next test files / 1505 tests and 66 API test files / 797 tests, plus build and worker typecheck. The final smoke step failed because an unrelated workerd PID 7197 occupied port 8800; it was left untouched. A final run uses KUUKI_NEXT_PORT=8801.
- Full `KUUKI_NEXT_PORT=8801 pnpm verify:cloudflare`: **exit 0** on final source `479b5ebc`. Includes formatting/lint, stamp drift/raster/cluster checks, all typechecks, 179 Next files / 1509 tests, 66 API files / 797 tests, 13 tooling tests, geometry/config checks, import dry builds, Next/OpenNext build, worker typecheck and workerd smoke. Logs: `/tmp/stamps-final-verify-cloudflare.log`; the earlier occupied-port failure is preserved in `/tmp/stamps-initial-verify-cloudflare.log`. Port 8801 was released when smoke completed.
- Full navigation/Playwright suite: intentionally skipped per owner instruction on 2026-10-14 ("можно не проверять полные сценарии и бразуреные тесты"). Focused browser checks had already completed; no further browser suite was run.
- Independent final review: completed once on codex / gpt-6.1-sol / low. Three P2 findings confirmed: concurrent owner mark saves can lose updates, clean replay dries its only layer to zero, and the dev sheet can show stale committed SVG with current recipe lint. All three fixed in `479b5ebc`: server/client write queues and atomic JSON publication; drying scoped to worn layers; live server-rendered art/metadata/rings. Four focused regressions (server concurrency, client blur/mark ordering, clean-layer motion, live preview) failed against the original code and pass after fixes. Final full gate: exit 0. Primary inspected the entire fixes diff, tested live preview and replay in the browser, and confirmed owner review.json unchanged. No second independent review was run. Report `/tmp/stamps-final-code-review.md`. Reviewer read engine/component/dev routes in detail and structurally audited the kit inventory; did not read every one of the 24,534 kit lines or verify every landmark photograph. Primary read each final worker diff and inspected the full sheet.
- Primary inspected all 246 worn 96px sheet drawings in light/dark and representative 160px pages. Focused agent-browser checks: 246 cards and hosts, no missing masks, Rest stays tilted on card hover, compare Replay reaches both copies, reduced motion removes tilt/scale and uses the base opacity fade, no console errors. Owner review marks were not changed by these checks. After review fixes, a temporary AR recipe mutation changed the live SVG hash, shape and ink without generation; restoration returned AR to octagon/oxblood and left assets untouched. The clean copy retained opacity 1 during both normal and reduced-motion replay, with the latter using `cs-fade-in` at 0.2s and rotate/scale none. All 30 worst-case samples have rings; a fresh browser session has zero errors.

- Local main integration checks after merge `57de9a66`: Next typecheck, `check:stamps` (246 countries), and focused stamp tests (10 files / 25 tests) passed. Latest main `4f9ef904` was then merged without conflicts; final integration typecheck passed on `3dd0df80` (log `/tmp/stamps-latest-main-typecheck.log`). No further full navigation or browser suite was run.

## Motifs and remaining judgement

- Owner motif decisions are incorporated: KP Kumgangsan; GH Elmina Castle; MD Soroca; PA Miraflores Locks and ship; GS glaciers with a small penguin colony. IN Taj Mahal (no mosque), PG bird-of-paradise, GQ ceiba, AR unlettered Obelisco, GF unbranded launcher and SX unbranded airliner are explicit owner exceptions/choices.
- FO uses generic traditional turf-roofed coastal houses, replacing identifiable Tinganes government offices. The active-office fact was checked against [the Prime Minister's official site](https://www.lms.fo/). EH/PS/XK/IO/FK/YT use neutral nature. The final motif list was audited against the owner exclusions.
- This is implementation and local verification, not owner acceptance of every final drawing. `review.json` is owner data and remains untouched: five accepted marks plus JP's historical Fuji redo note. That note has been implemented, but the tool must not manufacture a new owner mark.
- Registry `facts` retains the original research provenance: 153 checked, 93 unchecked. These labels were not upgraded merely because a recipe passes lint. Current source checks were performed for uncertain motifs during delegated art work; the branch does not claim a fresh photographic validation of all 246 landmarks.
- Art confidence remains medium for many scenes: AO/GA/ZM improve connected water but LR/IS remain geometric; MH reads as a chart frame; MR's dune band is subtle; GS's penguin species and HN's carving details do not resolve at 96px. These are taste/detail limitations, not missing countries or failed raster gates. The contact sheet retains owner Redo+note for further art decisions.

## Cluster / ink inventory

Countries outside these clusters keep their explicit or hashed ink. The six reference inks are pinned. Every listed group has at most eight members and distinct inks.

| Cluster        | Members | Country=ink                                                                         |
| -------------- | ------: | ----------------------------------------------------------------------------------- |
| aircraft       |       2 | SX=plum, TV=teal                                                                    |
| atoll          |       5 | CC=moss, IO=plum, MP=teal, TK=umber, VC=ochre-dark                                  |
| bird           |       2 | PG=plum, UM=teal                                                                    |
| bridge         |       6 | AU=slate, BA=moss, CZ=plum, LU=teal, MM=umber, SN=ochre-dark                        |
| canal-lock     |       1 | PA=plum                                                                             |
| castle         |       8 | BY=ochre-dark, CY=indigo, DK=oxblood, ES=slate, ET=moss, GG=plum, JE=teal, RO=umber |
| castle-tower   |       7 | EE=slate, GB=moss, LT=plum, MD=teal, RS=umber, SI=ochre-dark, SM=indigo             |
| classical-ruin |       4 | GR=teal, IR=umber, LY=ochre-dark, SY=indigo                                         |
| dunes          |       3 | EH=umber, NE=ochre-dark, QA=indigo                                                  |
| fort           |       7 | CO=indigo, CU=oxblood, GH=slate, HT=moss, KN=plum, PR=teal, VI=umber                |
| fort-gate      |       2 | FI=umber, MZ=ochre-dark                                                             |
| granite-dome   |       3 | BR=oxblood, NG=slate, SZ=moss                                                       |
| gulf-fort      |       2 | BH=teal, OM=umber                                                                   |
| hill-town      |       5 | AL=plum, DZ=teal, MA=umber, TN=ochre-dark, YE=indigo                                |
| ice            |       3 | AQ=indigo, GL=oxblood, SJ=slate                                                     |
| karst          |       2 | PW=slate, VN=moss                                                                   |
| lighthouse     |       8 | AW=slate, BL=moss, BM=plum, MO=teal, NC=umber, PM=ochre-dark, SO=indigo, TC=oxblood |
| megalith       |       2 | GM=ochre-dark, TO=indigo                                                            |
| mesa           |       4 | IL=plum, MU=teal, MW=umber, ZA=ochre-dark                                           |
| palm-island    |       6 | BW=ochre-dark, CK=indigo, GN=oxblood, GW=slate, SB=moss, TT=plum                    |
| pinnacle       |       6 | BG=ochre-dark, CL=indigo, DJ=oxblood, KZ=slate, NR=moss, TR=plum                    |
| pyramid        |       7 | BZ=oxblood, EG=slate, GT=moss, HN=plum, IQ=teal, MX=umber, SD=ochre-dark            |
| river-quay     |       1 | CD=plum                                                                             |
| rock-arch      |       2 | LB=moss, TD=plum                                                                    |
| rock-cut       |       2 | JO=umber, SA=ochre-dark                                                             |
| sea-wall       |       3 | HR=moss, ME=slate, MT=plum                                                          |
| ship           |       5 | AI=plum, KM=teal, KW=umber, MF=ochre-dark, VG=indigo                                |
| station        |       1 | TF=plum                                                                             |
| stepped-gable  |       5 | CW=moss, LV=plum, NL=teal, NO=umber, SE=ochre-dark                                  |
| stilts         |       4 | BJ=plum, BN=teal, KH=umber, TH=indigo                                               |
| thatched-house |       5 | FJ=indigo, KI=oxblood, LS=slate, TG=moss, WS=plum                                   |
| triumphal-arch |       1 | DE=umber                                                                            |
| twin-peak      |       8 | CH=slate, KE=moss, LC=plum, NP=teal, NZ=umber, RU=ochre-dark, TJ=indigo, XK=oxblood |
| volcanic-plug  |       3 | CM=indigo, PF=oxblood, ST=slate                                                     |
| volcano        |       8 | CR=plum, CV=teal, MQ=umber, MS=ochre-dark, PH=indigo, RE=oxblood, TZ=slate, VU=moss |
| waterfall      |       8 | AO=teal, GA=umber, GY=ochre-dark, IS=indigo, LR=oxblood, UG=slate, VE=moss, ZM=plum |
| wetland        |       1 | SS=umber                                                                            |

## Inputs and reproduction

**Committed:** the plan, this handoff, `apps/next/src/lib/stamp-art/**` (recipes/registry/ring endonyms/overrides/kit/fonts), `apps/next/src/client/stamps/**`, dev routes, `apps/next/public/stamps/**`, `scripts/{generate-stamps,check-stamps,generate-ring-endonyms}.ts`, package manifests and `pnpm-lock.yaml`; source inputs are included in the candidate history; this final handoff is recorded in the following documentation commit. Verify required inputs with `git ls-files --error-unmatch -- <path>`.

**Reproducible:** from workspace root, `pnpm install --frozen-lockfile`, then `pnpm generate:stamps` and `pnpm check:stamps`. Font inputs are pinned package dependencies and the committed CJK subsets; see `apps/next/src/lib/stamp-art/ring-fonts/README.md`. Launch the sheet with `pnpm --filter @kuuki/next exec next dev -p 3477`; open `http://localhost:3477/dev/stamps?size=96&compare=1&locale=ru` (add `&theme=dark` for dark). The inherited dev server PID 79024 and the later test launcher PID 16457 were stopped before their build gates; port 3477 was confirmed free.

**Checkout-local evidence:** this owning checkout's `.scratch/contact/final/{light,dark}-{96,160}-01.png` through `09.png` (all 246); `.scratch/contact/browser-final-{light,dark}.png` and post-fix `.scratch/contact/browser-post-review-{light,dark}.png`; renderer `.scratch/contact/final-sheet.ts` using tracked SVGs and Arial from macOS; `.scratch/final-owned-raster/` and `.scratch/stamps-lanes/`. Logs and review report live under `/tmp/stamps-final-*`; they are local evidence, not durable build inputs.

**Checkout-local reference corpus, read-only:** `/Users/indi256/Documents/kuuki/kuuki/.scratch/passport-profile/spec.md` and `country-semantics/{registry.json,REGISTRY.md,SUMMARY.md,REVIEW.md,BRIEF.md}`. Additional art direction is this worktree's `.scratch/stamps-review/BRIEF.md`, triage `.scratch/contact/TRIAGE.md`, and lane prompts `.scratch/stamps-lanes/`. To resume art work in another checkout, copy only those listed non-private reference files; do not infer owner acceptance from a missing corpus.

## Ready for the owner

W1–W4 source work is complete. The pipeline and 246-country contact sheet are ready, with the final local gate green and all confirmed review findings fixed. The feature checkout retains local scratch evidence. Main retains the parallel work in its working tree and index. No further implementation blocker remains. Future owner art notes can be entered on `/dev/stamps`; local main landing is authorized and contains merge `3dd0df80`; no push, deployment or Passport/import integration was performed.
