# Modern web audit — 8 October 2026

Audited the working tree on `main`, based on `c60f042`, including existing uncommitted changes. Three independent subagents used `gpt-6-sol` with medium reasoning for controls/accessibility, performance/CSS, and data/runtime. The primary agent checked each retained finding against callers and installed dependencies. The original audit changed no application code; the subsequent authorized remediation is recorded below.

The audit retained five findings: four P2 issues and one P3 performance opportunity. No P0/P1 issue was substantiated within the reviewed scope. All five now have local fixes; the findings below preserve the original evidence.

## Findings

### 1. P2 — A delayed import reload can restore a discarded batch

Location: [use-import-batch.ts:112](../../apps/next/src/client/import/use-import-batch.ts#L112).

`reload()` reads without an abort signal and applies its snapshot without checking whether the active batch/controller changed. The watcher already performs those checks; the explicit reload does not.

Reachable sequence: cancel processing batch A with retained rows. Cancellation starts a reload in [import-client.tsx:202](../../apps/next/src/client/import/import-client.tsx#L202). While that request is pending, the watcher can receive the cancellation and show Review. Review's discard action checks `confirming`, but not `cancelling` ([review-step.tsx:121](../../apps/next/src/client/import/review-step.tsx#L121)). Discard removes A and resets to Source. A delayed pre-discard snapshot then restores A in client state, despite its deletion and the cleared URL.

Minimum remedy: tie reload to the active controller/batch, abort superseded reads, and ignore superseded results. A superseded cancellation must also leave a newly started batch intact when its reload returns null. Cover both reset during an in-flight reload and cancellation answering after discard/restart. The latter was reproduced in an ImportClient regression test during remediation. React documents the same need to [ignore obsolete asynchronous responses](https://react.dev/reference/react/useEffect#fetching-data-with-effects).

### 2. P2 — Delayed publication suppresses committed lifecycle updates

Location: [activity.tsx:83](../../apps/next/src/client/activity.tsx#L83).

`syncOwnerFlights()` refreshes routes and dispatches the lifecycle event only when derived publication becomes ready. If publication errors or the bounded poll ends as delayed, neither occurs. The endpoint has already committed upcoming → awaiting or automatic confirmation ([sync-upcoming.ts:21](../../functions/api/flights/sync-upcoming.ts#L21)).

If the mounted Journal/queue read preceded that transition, it can continue showing the old state after a successful sync. Queue can recover on a later focus; Journal needs a refresh or lifecycle event. Both [queue](../../functions/api/_services/queue.ts#L90) and [Journal](../../functions/api/_services/journal.ts#L18) read canonical flights independently of publication readiness, so they can safely show the new lifecycle state with pending derived status. This also conflicts with ADR 0001 section 2's requirement to refresh and announce changed flights.

Minimum remedy: refresh canonical reads after committed transitions even if publication is delayed, while preserving the existing pending/error indication and identity guards. Refresh again when publication becomes ready if needed. Add one committed-but-delayed regression check.

### 3. P2 — Password reset repeatedly moves focus to the heading

Location: [reset-password-form.tsx:47](../../apps/next/src/client/account/reset-password-form.tsx#L47).

The heading-focus effect depends on `busy`. Submitting a valid password sets `busy=true` and moves focus away from the input/Save button to the heading. A failed request sets `busy=false` and moves focus there again, including if the user has moved elsewhere during the request. The form already has busy state and an error announcement.

Minimum remedy: focus only on meaningful entry/expired/success state transitions; keep ordinary pending and failure updates from refocusing the heading. The effect and submission paths establish this behavior in source; keyboard/screen-reader testing was not performed. Guidance used: `forms`, `accessibility`, and `accessible-error-announcement`. [React's effect dependency semantics](https://react.dev/reference/react/useEffect#parameters) explain why both busy changes retrigger the effect.

### 4. P2 — Public fonts cannot reuse the HTTP cache

Location: [worker.ts:81](../../apps/next/worker.ts#L81), with font URLs in [styles.css:2](../../apps/next/src/app/styles.css#L2).

The Worker sends `Cache-Control: no-store` for `/fonts/*`, because only Next's hashed static files and six versioned map assets bypass the default. This prevents HTTP cache storage/reuse for the self-hosted fonts on subsequent document loads. The four Commissioner WOFF2 files and JetBrains Mono TTF total **453 KiB**; this is the entire font set, not a claim that every page downloads every face.

Minimum remedy: allow a short cache lifetime with revalidation for these stable font URLs. Use long immutable caching only after versioning their filenames. Keep private responses under the existing no-store policy. Guidance used: `performance`, caching and fonts sections. See [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching). Header behavior is source-proven; no network or LCP measurement was taken.

### 5. P3 — Overview computes every route's SVG geometry twice

Locations: [map-preview.tsx:38](../../apps/next/src/client/overview/map-preview.tsx#L38) and [preview.tsx:33](../../apps/next/src/client/maps/preview.tsx#L33).

Overview calls `previewArcPath` for every pair to count unavailable paths; CountryPreview calls it again to render paths. The [projection endpoint](../../functions/api/flights/route-projection.ts#L12) permits 5,000 pairs. A deterministic current-source CPU benchmark took about **135–142 ms per warmed 5,000-path pass**, generating 3,640,865 path-string characters. The two passes therefore represent roughly 270–284 ms of geometry work for that synthetic input, before React/SVG rendering.

Minimum remedy: compute paths once and reuse them for rendering and the unavailable count. This is a measured CPU cost and a potential large-account interaction risk, not a measured browser INP regression. Do not add workers, route caps, or scheduling abstractions without browser evidence. Guidance used: `performance`, main-thread work section; [web.dev INP guidance](https://web.dev/articles/optimize-inp).

Reproduce from the workspace root:

```sh
pnpm exec tsx -e 'import { previewArcPath } from "./apps/next/src/client/maps/preview.tsx"; const pairs = Array.from({length:5000}, (_,i) => ({from:[-160+(i%160)*2, -50+(i%90)], to:[-150+((i*7)%150)*2, -40+((i*11)%80)]})); const run=()=>{const t=performance.now();let chars=0;for(const p of pairs)chars+=(previewArcPath(p as any)?.length??0);return {ms:Math.round(performance.now()-t),chars}}; console.log(JSON.stringify({warm:run(),first:run(),second:run()}));'
```

## Scope and guidance

Reviewed active web flows across `apps/next`, shared browser transports in `packages/client`, relevant shared models, representative browser-facing API handlers/services, and related Worker/build/CI configuration. The subagents examined controls; auth/reset/activation; account settings; capture/passport forms; shell/navigation/transitions; reads/profile/leaderboard; overview/maps; bootstrap/assets; import snapshots/SSE/receipts; identity, lifecycle, freshness, publication, and storage.

Modern-web-guidance searches ran before frontend review, using `--skill-version 2026_09_04-7de96777`, followed by guide retrieval. Relevant guides included `forms`, `accessibility`, autofill guides, `accessible-error-announcement`, `html`, `performance`, `defer-rendering-heavy-content`, `interactions-in-complex-layouts`, `css-layout`, and privacy/security/visibility guidance. The corpus did not provide a direct SSE/cancellation guide; async-response findings use official React guidance and repository source instead. Backend SQL and CI are outside the skill's guidance scope.

This was a repository-wide web audit with focused flow tracing, not a line-by-line review of every backend module, migration, historical document, or vendored dependency. No comprehensive security certification, live deployment validation, visual acceptance, cross-browser acceptance, or Core Web Vitals result is implied.

## Original audit verification

- `pnpm lint` and `pnpm typecheck`: passed via valid Turbo cache hits.
- Direct `pnpm typecheck:api`, `typecheck:scripts`, `typecheck:maintenance`, `typecheck:import`, and `typecheck:operator`: passed.
- `pnpm --filter @kuuki/next exec vitest run src/client/import/use-import-batch.test.tsx src/client/import/batch-watcher.test.ts src/client/lifecycle-sync.test.ts src/client/activity.test.tsx`: 4 files, 50 tests passed. These tests do not cover the reported import reload or delayed-publication scenarios.
- CPU benchmark: independently repeated by the primary agent; warmed passes were 139 and 142 ms.
- No production build, browser suite, remote D1 action, deployment, or application-code edit.

Lint/typecheck logs are in `/tmp/kuuki-modern-web-*.log`. Guides retrieved by the primary agent are saved in `/tmp/kuuki-modern-web-performance-security.md` and the guide index in `/tmp/kuuki-modern-web-guides.txt`.

## Authorized remediation — 8 October 2026

All five retained findings are addressed in the local working tree:

- Import reloads use the active batch identity and controller signal, ignore obsolete responses and abort failures, and reject mismatched snapshots. Cancellation callbacks are invalidated on reset/start; late success, failure and cleanup cannot affect a new import. A null reload cannot reset a replacement batch.
- Lifecycle sync refreshes canonical changes and announces them immediately, including pending/error publication. A later ready publication triggers a second guarded route refresh without a duplicate lifecycle event. ADR 0001 section 2 now states this explicitly.
- Password reset focuses its heading on token/success transitions; ordinary saving and retryable failures preserve input focus.
- Successful public WOFF2/TTF GET, HEAD and 304 responses receive `public, max-age=3600, must-revalidate`. Existing cookie, status and HTML guards apply; missing fonts and font licenses remain no-store.
- Overview memoizes route paths once per agreed projection and passes those paths to CountryPreview. Rendering and the unplaced count share the result; existing geometry and projection-state checks still pass.

Remediation verification:

- Pre-fix checks reproduced the four original unit failures and the font-cache Worker failure. Additional import checks reproduced an old reload callback restoring batch A after B started, and A's failed cancellation appearing on B's processing screen.
- Focused Vitest run: **9 files, 136 tests passed**, covering recovery focus, import reload/client/recovery/watchers, lifecycle sync, map geometry and Overview map states.
- `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm --filter @kuuki/next typecheck:worker`, and `pnpm next:build`: passed. The affected Next checks ran directly; three unrelated Turbo typecheck tasks reused valid cache results.
- `pnpm next:smoke` and `pnpm next:smoke:boundary`: passed against the final build, including font GET/HEAD/304 caching and missing-font no-store checks.
- Full `pnpm test:next:navigation` suite against the final build: **151 tests passed**.
- The primary agent reviewed the complete remediation diff; independent subagent review found no remaining actionable issues, including the final cancellation fence.

Existing unrelated changes were preserved. Runtime and browser checks use synthetic local fixtures; no remote D1 write or deployment was performed. Final logs are `/tmp/kuuki-audit-*-final.log`, with the reviewed code diff at `/tmp/kuuki-audit-fixes.diff`.

## Discarded finding

An initial report claimed account deletion lost focus when changing steps. Installed Radix focus-scope observes removal of focused nodes and restores focus to the labelled dialog container. The subagent withdrew the claim after dependency review; it is not an actionable finding.
