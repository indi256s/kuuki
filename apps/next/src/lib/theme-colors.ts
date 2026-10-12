// Browser-chrome colors (<meta name="theme-color">) cannot read CSS variables.
// These mirror `--background` in src/app/styles.css (light `:root`, `:root[data-theme=dark]`);
// src/app/tokens.test.ts fails if they drift from the canonical token block.
// oxlint-disable-next-line kuuki/design-tokens -- meta theme-color cannot read CSS variables; values are checked against styles.css by tokens.test.ts
export const THEME_COLOR = { light: '#fbfaf8', dark: '#292827' } as const

import { recognizeAccentKey } from '@kuuki/shared/theme/palette'

export const ACCENTS = ['shu', 'ai', 'matcha', 'asagi', 'sakura'] as const
export type Accent = (typeof ACCENTS)[number]
export const isAccent = (value: unknown): value is Accent => ACCENTS.includes(value as Accent)

/** Canonical accents pass and retired names map to their successor; anything else is not recognized. */
export const recognizeAccent = (value: unknown): Accent | null => recognizeAccentKey(value)

/** Like `recognizeAccent`, but anything unrecognized falls back to Shu. */
export const resolveAccent = (value: unknown): Accent => recognizeAccent(value) ?? 'shu'

// Canvas for stamp ink, mirroring `--surface` / `--text-muted` per theme in src/app/styles.css
// (checked against the CSS by src/app/tokens.test.ts).
// oxlint-disable-next-line kuuki/design-tokens -- canvas stamp ink cannot read CSS variables; values are checked against styles.css by tokens.test.ts
export const SURFACE_COLOR = { light: '#ffffff', dark: '#353331' } as const
// oxlint-disable-next-line kuuki/design-tokens -- canvas stamp ink cannot read CSS variables; values are checked against styles.css by tokens.test.ts
export const NEUTRAL_INK = { light: '#66605b', dark: '#c4beb7' } as const
