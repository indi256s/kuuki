# PWA install screenshots

[The web app manifest](../../apps/next/src/app/manifest.ts) references PNGs in
[`apps/next/public/screenshots`](../../apps/next/public/screenshots/). Chrome uses
the `wide` entries on desktop and the `narrow` entries on Android for its
[richer install dialog](https://web.dev/articles/web-apps/richer-install-ui).

Captured on 2026-10-30 from the local compiled preview, using only the synthetic
`a@example.test` account. Its display name and address were changed locally to
`Alex` and `alex`. No production account data appears in these public assets.

To refresh after a UI change:

1. Run `pnpm next:build`, then `pnpm next:preview` from the workspace root.
   Follow the [local preview skill](../../.agents/skills/dev-kuuki/SKILL.md).
2. Use a named `agent-browser` session and sign in as `a@example.test` with the
   fixture password printed by the preview. Set English, the light theme, Shu
   accent and reduced motion. Dismiss the cookie notice and achievement toasts.
3. Capture `/overview` and `/passport` at `1280×800` for `*-wide.png` and
   `390×844` for `*-narrow.png`, with device scale factor 1 and scroll at the top.
   Wait for fonts, stamps and the globe to finish loading. Capture the viewport,
   without annotations or browser chrome.
4. Keep the filenames and manifest dimensions aligned. Each dimension must be
   320–3840 pixels, the longest side at most 2.3 times the shortest, and all
   screenshots of the same form factor must share an aspect ratio.
5. Stop the preview, rebuild so the public images enter the Worker assets, and
   run `pnpm next:smoke`. Check `/manifest.webmanifest` and every screenshot URL
   without signing in: each image must return PNG bytes at its declared size.

The manifest retains the existing app description. Screenshots enhance browsers
that support this install dialog; they do not add offline support or change the
retired service worker.
