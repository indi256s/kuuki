// Country → continent maps, ported VERBATIM from the live PL/pgSQL CASE expressions.
// Two variants are intentionally different (parity — do not "unify" them):
//   * continentOf7  — used by recalculate_user_stats. 7 buckets, NA & SA SEPARATE, unmapped → 'OTHER'.
//   * regionOf      — used by compute_continent_breakdown / compute_region_breakdown.
//                     NA & SA both collapse to 'americas'; unmapped → 'other'.

const NORTH_AMERICA = ['US','CA','MX','GT','BZ','SV','HN','NI','CR','PA','CU','JM','HT','DO','PR','BS','TT','BB']
const SOUTH_AMERICA = ['BR','AR','CL','CO','PE','VE','EC','BO','PY','UY','GY','SR']
const EUROPE = ['GB','DE','FR','IT','ES','PT','NL','BE','CH','AT','PL','CZ','HU','RO','BG','GR','SE','NO','DK','FI','IE','LU','SK','SI','HR','RS','UA','BY','LT','LV','EE','MD','AL','MK','ME','BA','XK','IS','MT','CY','MC','SM','AD','LI','VA']
const ASIA = ['RU','CN','JP','KR','IN','TH','VN','MY','SG','ID','PH','TW','HK','MO','KZ','UZ','TM','KG','TJ','MN','NP','BD','LK','PK','AF','IR','IQ','SA','AE','QA','KW','BH','OM','YE','JO','LB','SY','IL','PS','TR','GE','AM','AZ','MM','LA','KH','BN','TL']
const OCEANIA = ['AU','NZ','FJ','PG','NC','PF','WS','TO','VU','SB','GU','FM','MH','PW','KI','NR','TV','CK','NU','TK','WF','AS']
const AFRICA = ['ZA','EG','MA','DZ','TN','LY','NG','KE','ET','GH','TZ','UG','SD','SS','SN','CI','CM','ZW','AO','MZ','MG','ZM','BW','NA','MU','RE','RW','BJ','TG','ML','BF','NE','TD','SO','DJ','ER','MW','LS','SZ','GM','GN','GW','SL','LR','GA','CG','CD','CF','GQ','ST','CV','KM','SC','YT']

const SET_NA = new Set(NORTH_AMERICA)
const SET_SA = new Set(SOUTH_AMERICA)
const SET_EU = new Set(EUROPE)
const SET_AS = new Set(ASIA)
const SET_OC = new Set(OCEANIA)
const SET_AF = new Set(AFRICA)

export type Continent7 = 'NA' | 'SA' | 'EU' | 'AS' | 'OC' | 'AF' | 'OTHER'
export type Region = 'americas' | 'europe' | 'asia' | 'oceania' | 'africa' | 'other'

/** recalculate_user_stats continent bucket (7-way; NA/SA separate; unmapped → OTHER). */
export function continentOf7(cc: string | null | undefined): Continent7 {
  if (!cc) return 'OTHER'
  if (SET_NA.has(cc)) return 'NA'
  if (SET_SA.has(cc)) return 'SA'
  if (SET_EU.has(cc)) return 'EU'
  if (SET_AS.has(cc)) return 'AS'
  if (SET_OC.has(cc)) return 'OC'
  if (SET_AF.has(cc)) return 'AF'
  return 'OTHER'
}

/** compute_*_breakdown region bucket (NA+SA → americas; unmapped → other). */
export function regionOf(cc: string | null | undefined): Region {
  if (!cc) return 'other'
  if (SET_NA.has(cc) || SET_SA.has(cc)) return 'americas'
  if (SET_EU.has(cc)) return 'europe'
  if (SET_AS.has(cc)) return 'asia'
  if (SET_OC.has(cc)) return 'oceania'
  if (SET_AF.has(cc)) return 'africa'
  return 'other'
}
