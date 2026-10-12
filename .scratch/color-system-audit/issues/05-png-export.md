# PNG export uses the owner theme snapshot

Status: resolved
Type: task
Node: E (spec story 10; execution map T7)
Blocked by: 01

Acceptance:
- `share.png?mode=light|dark`; missing → light; invalid → 400. Accent from the requesting user's own profile `theme_color` via `resolveAccent`; no request-supplied color.
- Renderer draws background, text, bars and any SVG from one `{mode, accent}` snapshot of the shared table (no `#2563eb` fixture literals). Missing data is not drawn as zero.
- Preserved: auth, filter parsing/validation, derived-readiness 503, signature, dimensions, `Cache-Control: no-store`, no external fetch, pre-existing lazy `import('../../_services/overviewShareCard')`.
- `functions/test/share-card.test.ts`: both modes + two accents produce different, expected pixels at sampled background/bar/text coordinates (decode the PNG); old no-mode request still 200 light; invalid mode 400; existing assertions unchanged.
- `pnpm typecheck:api`, `pnpm test:api`.

## Comments
