# Unused library audit — 9 October 2026

Audited all five workspace manifests against source imports, tests, CSS, framework/configuration entry points, CLI scripts, compiler type packages and package requirements. Read-only dependency audit; no dependencies removed.

| Item | Location | Notes |
|------|----------|-------|
| `fast-check` | `package.json:35` | No current source, test, config or script references repository-wide; its property tests were removed in commit `91e1b4bb`, leaving only historical documentation references; confirmed unused and safe to remove. |

No other unused direct declarations found. Root/runtime helpers, all Next libraries, type packages, Tailwind/PostCSS, browser/test tools and workspace dependencies have current use. Transitive packages remain owned by the dependencies that require them.

Separate placement observation: `packages/shared/src/overview/prefs.ts:1` imports `zod` without declaring it in the shared package; it currently resolves from the root declaration. This is a package portability concern, not an unused root dependency.

Independent read-only review confirmed usage for all four non-root manifests. No build/test rerun needed because runtime and dependency files were unchanged.
