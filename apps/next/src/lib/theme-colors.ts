// oxlint-disable-next-line kuuki/design-tokens -- meta theme-color cannot read CSS variables; values are checked against styles.css by tokens.test.ts
export const THEME_COLOR = { light: '#ffffff', dark: '#2e2e2e' } as const

import { ACCENT_KEYS, recognizeAccentKey, type AccentKey } from '@kuuki/shared/theme/palette'

export const ACCENTS = ACCENT_KEYS
export type Accent = AccentKey
export const isAccent = (value: unknown): value is Accent => ACCENTS.includes(value as Accent)

export const recognizeAccent = recognizeAccentKey

export const resolveAccent = (value: unknown): Accent => recognizeAccent(value) ?? 'shu'

// oxlint-disable-next-line kuuki/design-tokens -- canvas stamp ink cannot read CSS variables; values are checked against styles.css by tokens.test.ts
export const SURFACE_COLOR = { light: '#fafafa', dark: '#282828' } as const
// oxlint-disable-next-line kuuki/design-tokens -- canvas stamp ink cannot read CSS variables; values are checked against styles.css by tokens.test.ts
export const NEUTRAL_INK = { light: '#66605b', dark: '#c4beb7' } as const
