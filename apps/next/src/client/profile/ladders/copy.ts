// Achievement ladder strings in English and Russian together (Russian addresses the member as «вы»).
// Rung names, Normal and To-go lines are sober; the Sarcastic lines are the witty register and aim at habits, machines and timetables.
import {
  formatCount,
  formatDistanceKm,
  formatNumber,
  type CountForms,
  type Locale,
} from '../../../lib/format'
import type { LadderId } from './figures/types'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })
export const t = (pair: Pair, locale: Locale) => pair[locale]

export const LADDER_NAME: Record<LadderId, Pair> = {
  flights: p('Flights', 'Перелёты'),
  distance: p('Distance', 'Расстояние'),
  'time-aloft': p('Time aloft', 'Время в воздухе'),
  countries: p('Countries on flights', 'Страны в перелётах'),
  airports: p('Airports', 'Аэропорты'),
  continents: p('Continents', 'Континенты'),
  airlines: p('Airlines', 'Авиакомпании'),
  'aircraft-types': p('Aircraft types', 'Типы самолётов'),
}

export const RUNG_NAME: Record<LadderId, Pair[]> = {
  flights: [
    p('Wheels up', 'Взлёт'),
    p('Regular', 'Завсегдатай'),
    p('Frequent flyer', 'Частый летун'),
    p('Centurion', 'Центурион'),
    p('Part of the furniture', 'Часть интерьера'),
  ],
  distance: [
    p('First ten thousand', 'Первые десять тысяч'),
    p('Once around', 'Кругосветка'),
    p('Two and a half laps', 'Два с половиной круга'),
    p('Past the Moon', 'Дальше Луны'),
    p('Millionaire', 'Миллионер'),
  ],
  'time-aloft': [
    p('A day aloft', 'Сутки в воздухе'),
    p('Working week', 'Рабочая неделя'),
    p('Half a month', 'Полмесяца'),
    p('A month seated', 'Месяц в кресле'),
    p('One quarter', 'Квартал'),
  ],
  countries: [
    p('Stamped', 'С отметками'),
    p('Visa pages', 'Страницы для виз'),
    p('Extra pages', 'Дополнительные страницы'),
    p('Second passport', 'Второй паспорт'),
    p('Diplomatic pouch', 'Дипломатическая почта'),
  ],
  airports: [
    p('Tower contact', 'Связь с вышкой'),
    p('Approach', 'Заход'),
    p('Holding pattern', 'Зона ожидания'),
    p('Slot holder', 'Владелец слотов'),
    p('Hub', 'Хаб'),
  ],
  continents: [
    p('Intercontinental', 'Межконтинентальный'),
    p('Three continents', 'Три континента'),
    p('Four continents', 'Четыре континента'),
    p('Five continents', 'Пять континентов'),
    p('All six', 'Все шесть'),
  ],
  airlines: [
    p('Free agent', 'Свободный агент'),
    p('No status anywhere', 'Без статуса'),
    p('Alliance-agnostic', 'Вне альянсов'),
  ],
  'aircraft-types': [
    p('Spotter', 'Споттер'),
    p('Reads registrations', 'Читает бортовые номера'),
    p('Full fleet', 'Весь парк'),
  ],
}

/** One line per rung. Airlines rung 2 carries `{n}`; fill it with `sarcastic()`. */
export const SARCASTIC: Record<LadderId, Pair[]> = {
  flights: [
    p(
      'One flight. Statistically, already a trend.',
      'Один перелёт. Статистически — уже тенденция.',
    ),
    p(
      "Twenty-five flights. You've stopped reading the safety card, and it noticed.",
      'Двадцать пять перелётов. Карточку безопасности вы больше не читаете. Это зафиксировано.',
    ),
    p(
      'Fifty flights. You board before your group is called and pretend you misheard.',
      'Пятьдесят перелётов. Посадка до объявления вашей группы. Нарушение зафиксировано.',
    ),
    p(
      'A hundred flights. Your carbon footprint has its own postcode.',
      'Сто перелётов. Углеродный след получил собственный почтовый индекс.',
    ),
    p(
      'Five hundred flights. The airline lists you under fixtures and fittings.',
      'Пятьсот перелётов. Авиакомпания учитывает вас как основное средство.',
    ),
  ],
  distance: [
    p(
      "Ten thousand kilometres. The train would have taken a week, and you'd have enjoyed it.",
      '10 000 км. Поездом вышла бы неделя. И вам бы понравилось.',
    ),
    p(
      "Once round the planet. It still doesn't know your name.",
      'Один оборот вокруг Земли. Земля вас по-прежнему не узнаёт.',
    ),
    p(
      "Two and a half laps. Magellan managed one and didn't finish it personally.",
      'Два с половиной круга. Магеллан сделал один и лично его не завершил.',
    ),
    p(
      'Past the Moon, horizontally. Nobody is sending a rocket.',
      'Дальше Луны. По горизонтали. Ракету не пришлют.',
    ),
    p(
      'A million kilometres. The only kind of millionaire this journal can make you.',
      'Миллион километров. Единственный миллион, который вам здесь светит.',
    ),
  ],
  'time-aloft': [
    p(
      'A full day in the air, most of it spent negotiating an armrest.',
      'Сутки в воздухе. Большая часть ушла на переговоры о подлокотнике.',
    ),
    p(
      'A working week aloft. Unpaid, with lunch whenever the trolley decides.',
      'Рабочая неделя в воздухе. Без оплаты. Обед — по графику тележки.',
    ),
    p(
      'Half a month upright, tray table stowed.',
      'Полмесяца в вертикальном положении спинки кресла.',
    ),
    p(
      'A month in a seat. Your spine has filed a complaint.',
      'Месяц в кресле. Позвоночник направил жалобу.',
    ),
    p(
      'A quarter of a year aloft. Some sentences are shorter, and the food is similar.',
      'Квартал в воздухе. Срок отбыт. Питание входило в стоимость.',
    ),
  ],
  countries: [
    p(
      'Five countries. Enough to start sentences with "When I was in".',
      'Пять стран. Фраза «когда мы были в…» теперь допустима за ужином.',
    ),
    p(
      'Fifteen countries. Border officers have started asking follow-up questions.',
      'Пятнадцать стран. Пограничники начали задавать уточняющие вопросы.',
    ),
    p(
      'Thirty countries. The passport ran out of pages before you ran out of opinions.',
      'Тридцать стран. Страницы в паспорте закончились раньше, чем мнения о местной кухне.',
    ),
    p(
      'Fifty countries. Two passports, one personality.',
      'Пятьдесят стран. Два паспорта, одна личность.',
    ),
    p(
      'A hundred countries. Somewhere a consulate has a file on you.',
      'Сто стран. В одном из консульств на вас заведено дело.',
    ),
  ],
  airports: [
    p(
      'Five airports. Each one charged you lunch prices for water.',
      'Пять аэропортов. В каждом вода стоила как обед.',
    ),
    p(
      'Twenty airports. You know which gates have sockets.',
      'Двадцать аэропортов. Вам известно, у каких выходов есть розетки.',
    ),
    p(
      'Fifty airports. Your belt has been X-rayed more often than you have.',
      'Пятьдесят аэропортов. Ремень просвечен чаще, чем вы.',
    ),
    p(
      'A hundred airports. You have a private ranking of the toilets.',
      'Сто аэропортов. Составлен рейтинг туалетов. Публикации не подлежит.',
    ),
    p(
      'Two hundred airports. Your permanent address is airside.',
      'Двести аэропортов. Место постоянного проживания — чистая зона.',
    ),
  ],
  continents: [
    p(
      'Two continents. Enough to write "well-travelled" on a CV.',
      'Два континента. В резюме можно писать «много путешествую».',
    ),
    p(
      'Three continents. Jet lag is now a personality trait.',
      'Три континента. Джетлаг внесён в характеристику.',
    ),
    p(
      'Four continents. The remaining two are expensive.',
      'Четыре континента. Оставшиеся два — дорогие.',
    ),
    p(
      "Five continents. The last one isn't on the way to anything.",
      'Пять континентов. Последний ни с чем не по пути.',
    ),
    p(
      'All six. Geography has nothing left to offer. Consider the train.',
      'Все шесть. География исчерпана. Рассмотрите поезд.',
    ),
  ],
  airlines: [
    p(
      'Five airlines. Loyalty is for people with status.',
      'Пять авиакомпаний. Лояльность — для тех, у кого есть статус.',
    ),
    p(
      '{n} airlines, no status. You chose on price and got exactly that.',
      'Авиакомпаний: {n}. Статусов: 0. Выбирали по цене — получили цену.',
    ),
    p(
      'Thirty airlines. Every alliance has met you once and never called back.',
      'Тридцать авиакомпаний. Каждый альянс встречался с вами однажды. Повторной встречи не назначено.',
    ),
  ],
  'aircraft-types': [
    p(
      'Five types. You look at the wing now, not the view.',
      'Пять типов. В иллюминатор вы смотрите на крыло, а не на вид.',
    ),
    p(
      'Twenty types. You\'ve said "actually, that\'s a neo" out loud.',
      'Двадцать типов. Фраза «вообще-то это neo» произнесена вслух.',
    ),
    p(
      'Fifty types. The passenger in 14B did not ask.',
      'Пятьдесят типов. Пассажир с места 14B об этом не спрашивал.',
    ),
  ],
}

/** The Sarcastic line for a 1-based rung; `{n}` (Airlines rung 2) takes the current airlines count or the threshold. */
export function sarcastic(id: LadderId, rung: number, n: number, locale: Locale): string {
  const pair = SARCASTIC[id][rung - 1]
  return pair ? t(pair, locale).replaceAll('{n}', formatNumber(locale, n)) : ''
}

const days: CountForms = {
  en: { one: '{count} day', other: '{count} days' },
  ru: { one: '{count} сутки', few: '{count} суток', many: '{count} суток', other: '{count} суток' },
}
const hours: CountForms = {
  en: { one: '{count} hour', other: '{count} hours' },
  ru: { one: '{count} час', few: '{count} часа', many: '{count} часов', other: '{count} часа' },
}

const NORMAL: Record<Exclude<LadderId, 'distance' | 'time-aloft'>, Pair> = {
  flights: p('Flights logged: {n}.', 'Перелётов в журнале: {n}.'),
  countries: p('Countries on flights: {n}.', 'Стран в перелётах: {n}.'),
  airports: p('Airports: {n}.', 'Аэропортов: {n}.'),
  continents: p('Continents: {n}.', 'Континентов: {n}.'),
  airlines: p('Airlines flown: {n}.', 'Авиакомпаний: {n}.'),
  'aircraft-types': p('Aircraft types: {n}.', 'Типов самолётов: {n}.'),
}

/** The sober line with the current value in display units (hours for time aloft: days from 48 h, else hours). */
export function normal(id: LadderId, value: number, locale: Locale): string {
  if (id === 'distance') {
    const km = formatDistanceKm(locale, Math.floor(value))
    return locale === 'ru' ? `Пролетено ${km}.` : `You've flown ${km}.`
  }
  if (id === 'time-aloft') {
    const whole = Math.floor(value)
    return whole >= 48
      ? `${formatCount(locale, Math.floor(whole / 24), days)} ${locale === 'ru' ? 'в воздухе' : 'in the air'}.`
      : `${formatCount(locale, whole, hours)} ${locale === 'ru' ? 'в воздухе' : 'in the air'}.`
  }
  return t(NORMAL[id], locale).replace('{n}', formatNumber(locale, value))
}

const TO_GO: Record<LadderId, Pair> = {
  flights: p('Flights to go: {n}', 'Осталось перелётов: {n}'),
  distance: p('Kilometres to go: {n}', 'Осталось км: {n}'),
  'time-aloft': p('Hours to go: {n}', 'Осталось часов: {n}'),
  countries: p('Countries to go: {n}', 'Осталось стран: {n}'),
  airports: p('Airports to go: {n}', 'Осталось аэропортов: {n}'),
  continents: p('Continents to go: {n}', 'Осталось континентов: {n}'),
  airlines: p('Airlines to go: {n}', 'Осталось авиакомпаний: {n}'),
  'aircraft-types': p('Types to go: {n}', 'Осталось типов: {n}'),
}

/** The one-line label of the next strip slot; `remaining` is in display units. */
export function toGo(id: LadderId, remaining: number, locale: Locale): string {
  return t(TO_GO[id], locale).replace('{n}', formatNumber(locale, remaining))
}

export const rungOf = (n: number, m: number, locale: Locale) =>
  locale === 'ru' ? `Ступень ${n} из ${m}` : `Rung ${n} of ${m}`

export const FOUNDING = {
  // The name stays English in both locales (owner, 2026-10-12).
  name: p('Founding crew', 'Founding crew'),
  normal: p('Here since before launch.', 'С нами с самого начала.'),
  sarcastic: p(
    'Signed up before anything worked. Brave or bored. Noted.',
    'Зарегистрировались, когда ничего не работало. Смелость или скука — комиссия не определилась.',
  ),
}

export const NEW = p('New', 'Новое')
export const EARNED = (date: string, locale: Locale) =>
  locale === 'ru' ? `Получено ${date}` : `Earned ${date}`
export const TOP_RUNG = p('Top rung', 'Верхняя ступень')
/** Visually hidden state after a strip slot's rung name. */
export const SLOT_EARNED = p(', earned', ', получено')
export const SLOT_LOCKED = p(', locked', ', закрыто')
export const SLOT_NEXT = p(', next', ', следующая')
export const EARNED_COUNT = (n: number, locale: Locale) =>
  locale === 'ru' ? `Получено: ${formatNumber(locale, n)}` : `${formatNumber(locale, n)} earned`
export const SHOW_ALL = (n: number, locale: Locale) =>
  locale === 'ru' ? `Показать все: ${n}` : `Show all ${n}`
export const CLOSE = p('Close', 'Закрыть')
export const ACHIEVEMENTS_TITLE = p('Achievements', 'Достижения')
export const NO_ACHIEVEMENTS = p('No achievements yet.', 'Достижений пока нет.')
export const NEW_ACHIEVEMENTS = p('New achievements', 'Новые достижения')
