# Dependency updates — 9 October 2026

Updated 28 distinct library declarations across all five workspace manifests, refreshed compatible transitive dependencies, and updated pnpm 9.15.0 → 9.15.9 in the package manifest and CI. The 10 October integration retains the compatible Radix dropdown version as documented below.

## Updated libraries

- @cloudflare/workers-types: ^5.20261003.1 → ^5.20261009.1
- @google/genai: ^1.52.0 → ^2.28.0
- @hookform/resolvers: ^5.2.2 → ^5.9.1
- @opennextjs/cloudflare: 1.20.8 → 1.20.10
- @playwright/test: 1.63.0 → 1.64.0
- @ssgoi/react: 7.4.0 → 7.4.1
- @tailwindcss/postcss: ^4.0.0 → ^4.3.3
- @tanstack/react-query: ^5.62.0 → ^5.104.1
- @testing-library/jest-dom: ^6.9.1 → ^7.0.1
- @testing-library/react: ^16.3.2 → ^16.3.3
- @testing-library/user-event: ^14.6.1 → ^14.6.7
- @turf/great-circle: ^7.3.5 → ^7.4.0
- @types/node: ^24.0.0 → ^24.19.1
- @types/react: ^19.0.0 → ^19.3.0
- @types/react-dom: ^19.0.0 → ^19.3.0
- eslint: ^9.39.2 → ^9.39.5
- facehash: 0.0.7 → 0.1.0
- jsdom: ^27.4.0 → ^30.1.2
- lucide-react: ^0.563.0 → ^1.54.0
- maplibre-gl: 6.12.0 → 6.13.0
- react: 19.2.4 → 19.3.0
- react-dom: 19.2.4 → 19.3.0
- react-hook-form: ^7.71.1 → ^7.89.0
- tailwindcss: ^4.0.0 → ^4.3.3
- tsx: ^4.21.0 → ^4.23.15
- typescript: ^5.7.0 → ^6.0.3, ^5.9.3 → ^6.0.3
- vitest: ^4.1.11 → ^5.0.3
- wrangler: ^4.147.0 → ^4.149.0

## Compatibility holds

- Next (including optional auth peer through a global override) and eslint-config-next 16.3.8: 16.4.0 fails the composed Worker unknown-route check with the current OpenNext adapter. See issues/01-next-opennext-compatibility.md.
- Radix dialog/popover 1.1.15: 1.2.0 and 1.1.23 fail the existing animation-retention/outside-focus tests. See issues/02-radix-focus-and-presence.md.
- Radix dropdown-menu 2.1.16: local Journal/Overview integration reproduced keyboard focus theft in a portalled Menu inside Sheet with 2.1.25. Its separate focus-scope 1.2.0 conflicts with dialog/popover's 1.1.7. The shared Sheet/Menu keyboard regression fails before the hold and passes after it.
- ESLint 9.39.5: eslint-plugin-react does not declare ESLint 10 support.
- TypeScript 6.0.3: typescript-eslint requires TypeScript <6.1, excluding TypeScript 7.
- Node types 24.19.1 match the Node 24 runtime.
- Miniflare 4.20260730.0 is the newest stable v4; the registry latest tag points to a v5 alpha.
- pnpm stays on its current major at 9.15.9; pnpm 12 requires a separate install-policy/configuration migration.
- Existing React Hooks plugin 7.0.1 override retained: newer compiler diagnostics fail existing application code.

## Integration and security

- Carried the SSGOI scroll patch to core 7.4.1.
- Updated self-hosted MapLibre worker/CSS/license assets and all runtime URLs to 6.13.0; assets match installed package bytes. Version 6.13 has a self-contained worker, so removed its empty shared module and the obsolete browser assertion requiring that request.
- TypeScript 6 configs explicitly preserve Node type inclusion and shared-package output roots.
- Added a narrow glob override to patched 10.5.0. Audit still reports braces 3.0.3 by version; the existing nesting-limit patch passes its regression check.
- Adapted vendored UI source (ARC, mapcn, flightcn and animated icons) remains application code; no wholesale upstream replacement was performed.

## Verification

- All 634 API tests and 669 Next unit/component tests pass.
- Workspace package builds and typechecks pass; API, scripts, maintenance, import, release-operator and composed-Worker typechecks pass.
- ESLint, production Next/OpenNext build and composed Worker smoke/boundary checks pass.
- Frozen-lockfile install and existing braces security-patch regression pass.
- Actual GoogleGenAI 2.28.0 SDK passes a local custom-fetch check for JSON-schema request serialization and SSE response decoding; no live API call.
- Independent review covered all manifest/lockfile/patch/integration changes and approved the final graph.
- All 39 browser navigation tests pass against the final production Worker build, including local MapLibre loading, route selection, theme changes, cleanup and WebGL failure fallback.

Logs: `/tmp/kuuki-dependency-*.log`; final audit: `/tmp/kuuki-audit-final.json`. These paths are temporary. No deployment or remote data writes performed.
