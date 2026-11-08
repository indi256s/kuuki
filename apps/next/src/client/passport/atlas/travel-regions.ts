import type { Locale } from '../../../lib/format'
import { catalogRegionOf } from '../../../../../../functions/api/_lib/regions'

/**
 * Travel regions: a display-only grouping for the phone atlas's pages (GLOSSARY "Travel region"). They exist because a
 * catalog region frames too wide on a portrait phone (Asia runs Türkiye to Japan), so they never feed filters, totals
 * or badges. West to east, the order a swipe walks.
 */
export const TRAVEL_REGIONS = [
  'north-america',
  'caribbean',
  'south-america',
  'europe',
  'north-africa',
  'west-central-africa',
  'east-southern-africa',
  'middle-east',
  'central-south-asia',
  'east-asia',
  'southeast-asia',
  'oceania',
  'antarctica',
] as const
export type TravelRegion = (typeof TRAVEL_REGIONS)[number]

/** Countries placed explicitly; Europe, Oceania and Antarctica otherwise follow the catalog region. */
const PLACED: Partial<Record<TravelRegion, string>> = {
  'north-america': 'US CA MX GL BM PM',
  caribbean:
    'GT BZ SV HN NI CR PA CU JM HT DO PR BS TT BB AG DM GD KN LC VC AI AW CW SX MF BL KY TC VG VI MQ GP MS',
  'south-america': 'BR AR CL PE CO VE EC BO PY UY GY SR GF FK GS',
  europe: 'RU CY',
  'north-africa': 'MA DZ TN LY EG SD EH',
  'west-central-africa':
    'MR ML NE TD SN GM GW GN SL LR CI BF GH TG BJ NG CM CF GQ GA CG CD AO CV ST SH',
  'east-southern-africa':
    'SS ET ER DJ SO KE UG RW BI TZ MW MZ ZM ZW BW NA ZA LS SZ MG MU SC KM YT RE IO TF',
  'middle-east': 'TR GE AM AZ IL PS JO LB SY IQ IR SA KW BH QA AE OM YE',
  'central-south-asia': 'KZ UZ TM KG TJ AF PK IN NP BT BD LK MV',
  'east-asia': 'CN JP KR KP MN TW HK MO',
  'southeast-asia': 'TH VN LA KH MM MY SG ID PH BN TL CX CC',
}
const BY_CODE = new Map<string, TravelRegion>(
  (Object.entries(PLACED) as [TravelRegion, string][]).flatMap(([region, codes]) =>
    codes.split(' ').map((code) => [code, region] as const),
  ),
)
const FOLLOWS_CATALOG: Partial<Record<string, TravelRegion>> = {
  europe: 'europe',
  oceania: 'oceania',
  antarctica: 'antarctica',
}

/** The country's travel region; null outside the catalog. */
export const travelRegionOf = (code: string): TravelRegion | null =>
  BY_CODE.get(code) ?? FOLLOWS_CATALOG[catalogRegionOf(code) ?? ''] ?? null

export const TRAVEL_REGION_NAMES: Record<Locale, Record<TravelRegion | 'world', string>> = {
  en: {
    world: 'World',
    'north-america': 'North America',
    caribbean: 'Central America & Caribbean',
    'south-america': 'South America',
    europe: 'Europe',
    'north-africa': 'North Africa',
    'west-central-africa': 'West & Central Africa',
    'east-southern-africa': 'East & Southern Africa',
    'middle-east': 'Middle East & Caucasus',
    'central-south-asia': 'Central & South Asia',
    'east-asia': 'East Asia',
    'southeast-asia': 'Southeast Asia',
    oceania: 'Oceania',
    antarctica: 'Antarctica',
  },
  ru: {
    world: 'Мир',
    'north-america': 'Северная Америка',
    caribbean: 'Центральная Америка и Карибы',
    'south-america': 'Южная Америка',
    europe: 'Европа',
    'north-africa': 'Северная Африка',
    'west-central-africa': 'Западная и Центральная Африка',
    'east-southern-africa': 'Восточная и Южная Африка',
    'middle-east': 'Ближний Восток и Кавказ',
    'central-south-asia': 'Центральная и Южная Азия',
    'east-asia': 'Восточная Азия',
    'southeast-asia': 'Юго-Восточная Азия',
    oceania: 'Океания',
    antarctica: 'Антарктида',
  },
}

/**
 * Where a huge country frames: its main populated part, not its whole outline ([west, south, east, north]). A stand-in
 * for the places the member actually visited, which the Passport payload does not carry yet. The country is still
 * drawn and filled whole.
 */
export const FRAME_ANCHORS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  RU: [30, 43, 50, 60],
  US: [-125, 24, -66, 49],
  CA: [-127, 43, -60, 58],
  CN: [97, 20, 123, 42],
  BR: [-58, -30, -34, -2],
  AU: [113, -39, 154, -11],
  KZ: [50, 40, 83, 55],
  AR: [-73, -42, -53, -22],
  CL: [-75, -42, -67, -18],
  ID: [105, -9, 116, -5],
  GL: [-56, 59, -40, 72],
}
