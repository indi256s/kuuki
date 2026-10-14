// Mirror of the shared roles in src/app/styles.css, whose values follow design-system/palette.json (the White Sheet
// spec). styles.css stays the single UI token source; this table feeds consumers that cannot read CSS variables (PNG
// renderer, favicon, meta theme-color). apps/next/src/app/tokens.test.ts fails when a resolved CSS token drifts from
// any value below, and when styles.css drifts from palette.json.
import type { MakerSlot } from '../../../data/src/aircraft-makers'

export const MODES = ['light', 'dark'] as const
export type Mode = (typeof MODES)[number]

export const ACCENT_KEYS = ['shu', 'ai', 'matcha', 'asagi', 'sakura'] as const
export type AccentKey = (typeof ACCENT_KEYS)[number]

export type Surfaces = {
  background: string
  surface: string
  inset: string
  text: string
  muted: string
}

export type HeatStep = { color: string; foreground: string }

export type AccentTheme = {
  fill: string
  foreground: string
  tint: string
  text: string
  /** The rest of a peak-vs-rest metric; independent of the heat ramp. */
  markRest: string
  /** The selected reading; equals `text`. */
  markPeak: string
  comparison: readonly [string, string, string, string, string]
  heat: readonly [HeatStep, HeatStep, HeatStep, HeatStep]
  contour: string
}

/** The domain's maker slots (type-only import: the palette must not load the aircraft reference). */
export type MakerKey = MakerSlot

export const REGION_KEYS = [
  'africa',
  'americas',
  'antarctica',
  'asia',
  'europe',
  'oceania',
] as const
export type RegionKey = (typeof REGION_KEYS)[number]

export const SURFACES: Record<Mode, Surfaces> = {
  light: {
    background: '#ffffff',
    surface: '#fafafa',
    inset: '#f2f2f2',
    text: '#302d2a',
    muted: '#66605b',
  },
  dark: {
    background: '#2e2e2e',
    surface: '#282828',
    inset: '#232323',
    text: '#f1efeb',
    muted: '#c4beb7',
  },
}

export const THEMES: Record<AccentKey, Record<Mode, AccentTheme>> = {
  shu: {
    light: {
      fill: '#ec684d',
      foreground: '#202020',
      tint: '#fff0ec',
      text: '#ae4e3b',
      markRest: '#8d8c89',
      markPeak: '#ae4e3b',
      comparison: ['#864132', '#6b7542', '#386061', '#767ece', '#9a4e8f'],
      heat: [
        { color: '#f5dfda', foreground: '#202020' },
        { color: '#f1bcb0', foreground: '#202020' },
        { color: '#cb7361', foreground: '#202020' },
        { color: '#c82800', foreground: '#ffffff' },
      ],
      contour: '#886842',
    },
    dark: {
      fill: '#ea846f',
      foreground: '#292827',
      tint: '#4f3e3a',
      text: '#e2a193',
      markRest: '#8d8c89',
      markPeak: '#e2a193',
      comparison: ['#d6725d', '#a5b469', '#609fa1', '#bcc1e7', '#db8bce'],
      heat: [
        { color: '#6a4d47', foreground: '#ffffff' },
        { color: '#966257', foreground: '#ffffff' },
        { color: '#c87b6a', foreground: '#202020' },
        { color: '#ffc2b4', foreground: '#202020' },
      ],
      contour: '#d1a168',
    },
  },
  ai: {
    light: {
      fill: '#4e5ea2',
      foreground: '#ffffff',
      tint: '#edeef3',
      text: '#5264b6',
      markRest: '#8d8c89',
      markPeak: '#5264b6',
      comparison: ['#3e4d9e', '#c26287', '#846a42', '#508967', '#385f67'],
      heat: [
        { color: '#dadee8', foreground: '#202020' },
        { color: '#b0b9d8', foreground: '#202020' },
        { color: '#7d8ece', foreground: '#202020' },
        { color: '#404e98', foreground: '#ffffff' },
      ],
      contour: '#886842',
    },
    dark: {
      fill: '#acbbef',
      foreground: '#292827',
      tint: '#3d4250',
      text: '#a2b0df',
      markRest: '#8d8c89',
      markPeak: '#a2b0df',
      comparison: ['#8695c8', '#e8b3c5', '#cba468', '#79cc9c', '#5f9daa'],
      heat: [
        { color: '#4d546c', foreground: '#ffffff' },
        { color: '#636f9b', foreground: '#ffffff' },
        { color: '#7d8ece', foreground: '#202020' },
        { color: '#c2d0ff', foreground: '#202020' },
      ],
      contour: '#d1a168',
    },
  },
  matcha: {
    light: {
      fill: '#59702a',
      foreground: '#ffffff',
      tint: '#eaf2e0',
      text: '#5f713f',
      markRest: '#8d8c89',
      markPeak: '#5f713f',
      comparison: ['#495b26', '#385f66', '#8677ce', '#c76174', '#6f5133'],
      heat: [
        { color: '#d8e3c7', foreground: '#202020' },
        { color: '#b0c392', foreground: '#202020' },
        { color: '#859c5e', foreground: '#202020' },
        { color: '#495b28', foreground: '#ffffff' },
      ],
      contour: '#886842',
    },
    dark: {
      fill: '#b7ce92',
      foreground: '#292827',
      tint: '#3f4537',
      text: '#9fbc6c',
      markRest: '#8d8c89',
      markPeak: '#9fbc6c',
      comparison: ['#85a053', '#5f9ea9', '#c3bfe7', '#e8b5bb', '#b78758'],
      heat: [
        { color: '#515944', foreground: '#ffffff' },
        { color: '#6a7852', foreground: '#ffffff' },
        { color: '#859c5e', foreground: '#202020' },
        { color: '#bedc89', foreground: '#202020' },
      ],
      contour: '#d1a168',
    },
  },
  asagi: {
    light: {
      fill: '#0c747d',
      foreground: '#ffffff',
      tint: '#e5f1f2',
      text: '#437277',
      markRest: '#8d8c89',
      markPeak: '#437277',
      comparison: ['#335b5f', '#7a6bc1', '#c76175', '#645733', '#477e49'],
      heat: [
        { color: '#c7e5e8', foreground: '#202020' },
        { color: '#90c6cc', foreground: '#202020' },
        { color: '#649da4', foreground: '#202020' },
        { color: '#2b5b60', foreground: '#ffffff' },
      ],
      contour: '#886842',
    },
    dark: {
      fill: '#85cfd8',
      foreground: '#292827',
      tint: '#394546',
      text: '#74bec6',
      markRest: '#8d8c89',
      markPeak: '#74bec6',
      comparison: ['#5f9ea5', '#b6b1e2', '#e8b5bb', '#a59059', '#74c076'],
      heat: [
        { color: '#47595b', foreground: '#ffffff' },
        { color: '#56797c', foreground: '#ffffff' },
        { color: '#649da4', foreground: '#202020' },
        { color: '#92dfe7', foreground: '#202020' },
      ],
      contour: '#d1a168',
    },
  },
  sakura: {
    light: {
      fill: '#964969',
      foreground: '#ffffff',
      tint: '#f3edef',
      text: '#a64b72',
      markRest: '#8d8c89',
      markPeak: '#a64b72',
      comparison: ['#863a5b', '#75603a', '#50886b', '#3e6886', '#8d74cb'],
      heat: [
        { color: '#e8d9de', foreground: '#202020' },
        { color: '#daacbc', foreground: '#202020' },
        { color: '#c37895', foreground: '#202020' },
        { color: '#89375b', foreground: '#ffffff' },
      ],
      contour: '#886842',
    },
    dark: {
      fill: '#e8a9c0',
      foreground: '#292827',
      tint: '#4e3d43',
      text: '#e29cb6',
      markRest: '#8d8c89',
      markPeak: '#e29cb6',
      comparison: ['#cf6e95', '#ba9960', '#7acca2', '#66a6d3', '#c7bde7'],
      heat: [
        { color: '#684c56', foreground: '#ffffff' },
        { color: '#936073', foreground: '#ffffff' },
        { color: '#c37895', foreground: '#202020' },
        { color: '#ffbdd5', foreground: '#202020' },
      ],
      contour: '#d1a168',
    },
  },
}

export const MAKERS: Record<Mode, Record<MakerKey, string>> = {
  light: {
    airbus: '#568db2',
    boeing: '#487a6b',
    embraer: '#988451',
    atr: '#8457a8',
    aerospatiale: '#8b5f50',
    antonov: '#508b70',
    'bae-systems': '#81508b',
    beechcraft: '#848b50',
    bombardier: '#50738b',
    cessna: '#8b5061',
    concorde: '#508b50',
    dassault: '#61508b',
    'de-havilland': '#8b7350',
    douglas: '#508b84',
    'fairchild-dornier': '#8b5081',
    fokker: '#708b50',
    gulfstream: '#505f8b',
    harbin: '#8b5350',
    'hawker-siddeley': '#508b64',
    ilyushin: '#75508b',
    learjet: '#8b8650',
    lockheed: '#507f8b',
    'mcdonnell-douglas': '#8b506e',
    namc: '#5c8b50',
    partenavia: '#55508b',
    pilatus: '#8b6650',
    piper: '#508b78',
    saab: '#89508b',
    shorts: '#7c8b50',
    sukhoi: '#506b8b',
    tupolev: '#8b505a',
    yakovlev: '#508b58',
    other: '#5e574f',
  },
  dark: {
    airbus: '#a2cae7',
    boeing: '#71bca5',
    embraer: '#dec179',
    atr: '#bd99dd',
    aerospatiale: '#cfaca0',
    antonov: '#a0cfba',
    'bae-systems': '#c7a0cf',
    beechcraft: '#c9cfa0',
    bombardier: '#a0bccf',
    cessna: '#cfa0ae',
    concorde: '#a0cfa0',
    dassault: '#aea0cf',
    'de-havilland': '#cfbca0',
    douglas: '#a0cfc9',
    'fairchild-dornier': '#cfa0c7',
    fokker: '#b9cfa0',
    gulfstream: '#a0accf',
    harbin: '#cfa2a0',
    'hawker-siddeley': '#a0cfb0',
    ilyushin: '#bea0cf',
    learjet: '#cfcba0',
    lockheed: '#a0c5cf',
    'mcdonnell-douglas': '#cfa0b7',
    namc: '#aacfa0',
    partenavia: '#a4a0cf',
    pilatus: '#cfb2a0',
    piper: '#a0cfc0',
    saab: '#cda0cf',
    shorts: '#c3cfa0',
    sukhoi: '#a0b5cf',
    tupolev: '#cfa0a8',
    yakovlev: '#a0cfa6',
    other: '#9b9084',
  },
}

/** In palette order. `MAKERS` is typed by the domain's slots, so a maker without a colour fails the type check. */
export const MAKER_KEYS = Object.keys(MAKERS.light) as MakerKey[]

export const REGIONS: Record<Mode, Record<RegionKey, string>> = {
  light: {
    africa: '#9f8151',
    americas: '#844333',
    antarctica: '#4e586c',
    asia: '#945198',
    europe: '#558cb9',
    oceania: '#487a6d',
  },
  dark: {
    africa: '#e7bd7a',
    americas: '#d5725a',
    antarctica: '#8892a8',
    asia: '#d48dd8',
    europe: '#a6c9e7',
    oceania: '#71bca8',
  },
}

/**
 * Distinct neutral roles. They may share a hex but never a meaning: `zero` is a known zero,
 * `missing` is no data, `makerUnknown` is the outline for an unknown category (never a fill),
 * `markGhost` is the baseline, `brandNeutral` stands in for an airline without a catalog colour.
 */
export type Neutrals = {
  zero: string
  missing: string
  makerUnknown: string
  markGhost: string
  brandNeutral: string
}

export const NEUTRALS: Record<Mode, Neutrals> = {
  light: {
    zero: '#f2f2f2',
    missing: '#837b74',
    makerUnknown: '#7a726b',
    markGhost: '#978c7f',
    brandNeutral: '#8a8076',
  },
  dark: {
    zero: '#232323',
    missing: '#958b82',
    makerUnknown: '#a39a90',
    markGhost: '#897e70',
    brandNeutral: '#958b82',
  },
}

/** The profile holder's data page: laminate rule, guilloche, perforation, MRZ band and the UV print's fluorescent tint. */
export type HolderInks = {
  rule: string
  guilloche: string
  perforation: string
  band: string
  uv: string
}

export const HOLDER: Record<Mode, HolderInks> = {
  light: {
    rule: '#dedad5',
    guilloche: '#e7e3de',
    perforation: '#b7b0a8',
    band: '#f2f0ed',
    uv: '#6a52b8',
  },
  dark: {
    rule: '#5f5954',
    guilloche: '#45403c',
    perforation: '#5f5954',
    band: '#2e2c2a',
    uv: '#b9a6ff',
  },
}

// Accent names retired by earlier palettes; public/bootstrap.js keeps the same table for the device cookie.
const LEGACY_ACCENTS: Readonly<Record<string, AccentKey>> = {
  terracotta: 'shu',
  kincha: 'shu',
  sumi: 'shu',
  yellow: 'shu',
  red: 'shu',
  orange: 'shu',
  blue: 'ai',
  cyan: 'asagi',
  teal: 'asagi',
  purple: 'sakura',
  coral: 'sakura',
}

/** Canonical accents pass and retired names map to their successor; anything else is not recognized. */
export function recognizeAccentKey(value: unknown): AccentKey | null {
  if ((ACCENT_KEYS as readonly unknown[]).includes(value)) return value as AccentKey
  return typeof value === 'string' && Object.hasOwn(LEGACY_ACCENTS, value)
    ? LEGACY_ACCENTS[value]
    : null
}
