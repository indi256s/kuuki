# Dependency applicability — 2026-10-03

The reviewed lockfile updates React Router to 7.18.4, Vite to 6.4.3, Vitest/coverage to 4.1.11, Turbo to 2.11.7 and Wrangler to 4.147.0. Direct Miniflare remains on its stable 4.x line. Worker types match Wrangler’s peer contract. The existing Gemini SDK remains 1.39.0. Narrow version-range overrides patch protobufjs 7.6.5, ws 8.21.0 and Rollup 4.59.0; their parent ranges permit these versions. Remove each override when its parent lock resolution includes the fix.

The saved whole-workspace audit changed from 3 critical / 82 high / 91 moderate / 13 low to 0 critical / 33 high / 56 moderate / 9 low. These are advisory occurrences, not distinct reachable vulnerabilities. An audit exit of 1 is expected while the findings below remain.

The actual Pages Functions esbuild metadata has no inputs from Hono, @hono/node-server, Express rate limiting, ip-address, minimatch, protobufjs, ws or google-auth-library. They occur in installed optional SDK peers, development tools or SDK exports that the deployed web-target bundle excludes. The final build must retain the same absence before release.

| Remaining family | Reachable path and disposition | Next step |
| --- | --- | --- |
| d3-color 2 | Present through maps/charts. Application color values come from fixed theme/reference values or bounded numeric HSL generation; no user text is passed as a CSS color. The advisory requires malicious long color strings. This source review supports limited applicability, not a claim that the package is patched. | Upgrade the map dependency and validate its React 19 behavior; reassess immediately if user-supplied color input is added. |
| Hono, @hono/node-server, express-rate-limit, ip-address, path-to-regexp, qs, body-parser | Agentation’s development MCP service and optional Gemini SDK peer. No corresponding server is served by Pages and relevant inputs are absent from the API bundle. | Upgrade the development MCP tool/SDK peer before exposing it to untrusted clients. |
| minimatch, brace-expansion, flatted, js-yaml, nanoid, postcss, ajv, @humanfs/node, @babel/core | Build/lint/test dependencies. Inputs are repository paths, configuration and source, not application request bodies. CI executes untrusted PR code without deploy credentials in the verification job. | Refresh compatible parent toolchains; never run untrusted source builds with release secrets. |
| serialize-javascript 6 | Workbox build/terser path. The vulnerable operation serializes executable RegExp/Date objects; the app does not invoke it on user objects or request data. | Update Workbox’s serializer parent when compatible; do not force a major serializer replacement without validating generated service-worker output. |
| sharp | Development image/asset tooling, absent from API bundle. No ticket-upload route invokes native image decoding. | Update its tooling parent before processing untrusted HEIF/AVIF through that tool. |
| undici 7.28 | Direct stable Miniflare development runtime. Wrangler’s separate newer Miniflare uses patched 7.29.1. Synthetic fixtures deny or fake external requests; Pages uses workerd fetch. | Adopt a stable patched Miniflare release, or independently verify a narrow override before relying on affected networking features. |

No automatic monitor or dependency-bot configuration was added. Reassess this table after dependency or runtime-input changes.

The [d3-color advisory](https://github.com/advisories/GHSA-36jr-mh4h-2g58), [serializer advisory](https://github.com/advisories/GHSA-5c6j-r48x-rmvq), [Undici advisory](https://github.com/advisories/GHSA-w293-vg96-wgc3) and [sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) describe the affected inputs/features. Installed paths and bundle reachability are project-local evidence.

## Remaining high advisories

| Package | Advisory |
| --- | --- |
| @hono/node-server | [GHSA-wc8c-qw6v-h7f6](https://github.com/advisories/GHSA-wc8c-qw6v-h7f6) |
| brace-expansion | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) |
| brace-expansion | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) |
| brace-expansion | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) |
| brace-expansion | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) |
| brace-expansion | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) |
| d3-color | [GHSA-36jr-mh4h-2g58](https://github.com/advisories/GHSA-36jr-mh4h-2g58) |
| express-rate-limit | [GHSA-46wh-pxpv-q5gq](https://github.com/advisories/GHSA-46wh-pxpv-q5gq) |
| flatted | [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f) |
| flatted | [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) |
| hono | [GHSA-88fw-hqm2-52qc](https://github.com/advisories/GHSA-88fw-hqm2-52qc) |
| hono | [GHSA-q5qw-h33p-qvwr](https://github.com/advisories/GHSA-q5qw-h33p-qvwr) |
| ip-address | [GHSA-mwp4-54f8-5fhr](https://github.com/advisories/GHSA-mwp4-54f8-5fhr) |
| js-yaml | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) |
| js-yaml | [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) |
| js-yaml | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) |
| minimatch | [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) |
| minimatch | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) |
| minimatch | [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) |
| nanoid | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) |
| nanoid | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) |
| nanoid | [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) |
| path-to-regexp | [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f) |
| postcss | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) |
| postcss | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) |
| serialize-javascript | [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) |
| sharp | [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) |
| undici | [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272) |
| undici | [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) |
| undici | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) |
