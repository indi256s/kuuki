# Chart fixtures omit mandatory scale definitions

Status: resolved — routine correction authorized by the user

Task 13 Step 1 uses `defineChart({ marks: [...] })` for the Rhythm cells and
Clock bars. The pinned `@tanstack/charts@1.0.0` requires reserved x/y scales;
the exact planned form cannot render. Its installed source throws in
`dist/scene.js:resolveScaleDefinitions`, and `dist/types.d.ts:ChartSpecForMarks`
requires the scales property. React's SSR prerender uses the same scene path.

## Verified evidence

Both initial RED runs failed because the package was missing. After installing
exact version 1.0.0 in root and Next, both focused tests fail, each 1 file /
1 test, with:

```text
TypeError: Chart scales must define reserved `x` and `y` entries
```

Next typecheck exits 2:

```text
error TS2769: No overload matches this call.
Property 'scales' is missing ... but required ...
```

API typecheck exits 0 (its config excludes shared and Next test files).
Logs: `/tmp/kuuki-overview-execution/r2-t13-api-green.log`,
`r2-t13-next-green.log`, `r2-t13-next-types.log`, `r2-t13-api-types.log`.

Primary documentation: TanStack's
[grammar example](https://github.com/tanstack/charts/blob/main/docs/concepts/grammar-of-graphics.md)
explicitly supplies scaleBand for bar x and scaleLinear for bar y.
Installed 1.0.0 source confirms the mandatory requirement.

## Proposed correction

Keep the engine arrays and mark mappings unchanged. Supply band scales for
Rhythm x/y (month/year), and band x plus linear y for Clock/Fleet bar fixtures:

```ts
// Rhythm fixture
scales: { x: { scale: scaleBand }, y: { scale: scaleBand } }
// Clock and Fleet fixtures
scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } }
```

Import from `/scales/band` and `/scales/linear`. Update Task 13 Step 1 to include
these mandatory fixture scales, preserving unstyled tests with no product
chart definitions, tokens, colors or legends. This is held under the user's
wrong-plan-step approval rule; no proposed correction has been implemented.

Task 12 accepted commit: `a1fbe2f`. Task 13 dependencies and tests remain
prepared/uncommitted, all boxes unchecked. Full suites/build and route client
JS delta are held until the known failure is resolved. Before-dependency
Overview client JS: 18 deduplicated route/root/polyfill files, 1,268,522 bytes,
recorded in `/tmp/kuuki-overview-execution/r2-t13-js-before.json`.
No Task 14–17 implementation, per-task review, UI, remote or GitHub action.

## Resolution

The user instructed: "Do not ask every time. Do a best practice". Required
x/y fixture scales are implemented and the plan updated. Engine rows and mark
mappings are unchanged; no product chart or styling is added. Focused DOM-free
and React SSR tests each pass 1/1; shared/Next typechecks exit 0. The shared
test creates each heterogeneous scene inside its own inferred closure rather
than passing an incompatible union of definitions to a generic constructor.
Full API 70/769 and Next 107/1113 pass. Production/GitHub/UI/parity gates remain.
