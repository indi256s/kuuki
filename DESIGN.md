# Kuuki Design System 2.0

Kuuki is a personal flight journal with a restrained editorial character. Typography, whitespace, and the details of stamps and tickets carry the design. This document is the implementation source of truth for the Next experience and supersedes conflicting color, font, glass, grain, and motion guidance elsewhere. The [Redesign 2.0 UX brief](docs/plans/2026-10-04-redesign-2.0-ux-ui.md) explains the experience decisions. The Vite app remains a compatibility surface during migration.

## Color and surfaces

Use semantic CSS variables from `apps/next/src/app/styles.css`; do not place palette literals in components. Light uses paper (`#fbfaf8`) and charcoal text (`#302d2a`); dark uses ink (`#292827`) and warm white text (`#f1efeb`). Terracotta is the accent in both themes. Text colors are separate from fills. Muted text must meet 4.5:1 contrast, control borders and focus must meet 3:1; do not fade text with opacity. Hairlines are for structure, control borders for inputs and controls. In-flow cards use one subtle boundary and no shadow. Floating surfaces use a solid background and elevation. No glass, backdrop blur, glow, gradient buttons, or decorative grain.

The default accent is terracotta. Map fills use a sequential accent ramp and a titled legend with fixed buckets 1, 2–3, 4–9, 10+. Flag colors may inform stamp ink, never map fill. Claims must have a text and shape cue. Curated accent alternatives require independently checked light/dark foreground pairs; unknown legacy values map to terracotta and never overwrite status colors.

## Type and layout

Self-hosted Onest is the Cyrillic-capable UI and display face; JetBrains Mono is for ticket codes, flight numbers, times, table dates, and handles. OFL licenses ship beside font assets. Changing and aligned numbers use tabular figures. Body is 15/24, small 13/20, caption 12/16, H3 17/24, H2 22/28, H1 30/36, display 44/48. Wrap headings with balance and body with pretty wrapping. Use locale-aware EN/RU dates, numbers, and real plural forms. Russian copy addresses the user as «вы».

The shared header and page container align at 1200px. Gutters are 24px desktop and 16px mobile. Spacing uses a 4px base; section gaps are 48px desktop and 32px mobile. Cards fit content instead of matching heights. Radii: 6px small internal chips, 10px controls, 14px cards/popovers, 20px dialogs and sheets. An inner radius must account for container padding.

## Interaction and states

Navigation stays available while private data streams in. Every data surface distinguishes loading, empty, partial, error, and ready states. Never present an unavailable read as a confirmed empty journal. Links and controls have visible 2px offset focus rings and 44px touch targets. Press feedback is 120ms scale to 0.96 except static rows and cards; hover styles apply only to fine pointers. Reduced-motion users get static state changes. Disabled actions explain why in visible text. Use Lucide icons with text labels; color alone does not signal active state. Capture, authentication, privacy, and destructive copy is calm and direct.

System theme is the default for new users. Preserve an explicit light/dark choice, map supported legacy settings, and keep EN/RU and theme consistent with the first usable page. Client persistence uses same-origin cookies; private app data and authorization are never cached in shared shells.
