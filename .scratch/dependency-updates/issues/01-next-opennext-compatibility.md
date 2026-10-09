# Admit Next 16.4 after OpenNext runtime compatibility is fixed

Status: open

Next 16.4.0 with OpenNext Cloudflare 1.20.10 builds successfully but fails the existing composed Worker smoke check: `/legacy/flights` returns 500 instead of 404, with `Unexpected loadManifest(/.next/server/preview-props.json) call!`.

Keep Next and eslint-config-next at 16.3.8. Reproduce with `pnpm next:build && pnpm next:smoke`; upgrade after the unknown-route and full navigation checks pass. Original failure log: `/tmp/kuuki-dependency-smoke.log` (temporary).
