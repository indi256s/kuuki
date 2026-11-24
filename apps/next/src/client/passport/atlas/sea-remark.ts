import type { Locale } from '../../../lib/format'

type Copy = Record<Locale, string>

const LANDLOCKED = new Set(
  'AD AF AM AT BF BI BO BT BW BY CF CH CZ ET HU KG LA LI LS LU MD MK ML MN MW NE NP PY RS RW SK SM SS SZ TD TJ UG UZ VA XK ZM ZW'.split(
    ' ',
  ),
)
const CASPIAN = new Set(['AZ', 'KZ', 'TM'])

const LINES: ((country: Copy) => Copy)[] = [
  (country) => ({
    en: `${country.en} has no coastline. A river, presumably. Noted.`,
    ru: `${country.ru}: выхода к морю нет. Предположительно, по реке. Зафиксировано.`,
  }),
  () => ({
    en: 'Arrived by sea in a country without one. The navigator deserves a raise.',
    ru: 'Прибытие морем при отсутствии моря. Штурману объявлена благодарность.',
  }),
  (country) => ({
    en: `${country.en} has no sea. The discrepancy is on file.`,
    ru: `${country.ru}: моря нет. Расхождение с протоколом принято к сведению.`,
  }),
]

const CASPIAN_LINE: Copy = {
  en: 'The Caspian is technically a lake. Counted anyway.',
  ru: 'Каспий формально озеро. Засчитано.',
}
const BOLIVIA_LINE: Copy = {
  en: 'Bolivia has a navy and no sea. You two will get along.',
  ru: 'У Боливии есть флот, но нет моря. Вы сработаетесь.',
}

export function seaRemark(code: string, country: Copy): Copy | undefined {
  if (CASPIAN.has(code)) return CASPIAN_LINE
  if (!LANDLOCKED.has(code)) return undefined
  if (code === 'BO') return BOLIVIA_LINE
  const pick = (code.charCodeAt(0) + code.charCodeAt(1)) % LINES.length
  return LINES[pick](country)
}
