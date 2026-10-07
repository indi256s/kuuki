export type Line = { en: string; ru: string }

const flights: [Line, Line, Line] = [
  { en: 'Flights in your selected view: {flights}.', ru: 'Перелётов в выбранном вами обзоре: {flights}.' },
  { en: 'Your current selection includes this many flights: {flights}.', ru: 'В вашей текущей выборке столько перелётов: {flights}.' },
  { en: 'Flight total for this view: {flights}.', ru: 'Всего перелётов в этом обзоре: {flights}.' },
]
const below: [Line, Line, Line] = [
  { en: 'Available evidence: {have}; required for this section: {need}.', ru: 'Доступно данных: {have}; для этого раздела нужно: {need}.' },
  { en: 'This section needs {need}; the current view provides {have}.', ru: 'Для раздела нужно: {need}; в текущей выборке доступно: {have}.' },
  { en: 'Evidence in this view: {have}. The section threshold is {need}.', ru: 'Данных в этой выборке: {have}. Порог раздела: {need}.' },
]

// Neutral placeholders; Task12 owns the section-specific narrator corpus.
export const CORPUS: Record<string, [Line, Line, Line]> = {
  records: flights, crossings: flights, manufacturers: flights, fleet: flights,
  clock: flights, rhythm: flights, rankings: flights, globe: flights,
  'below:records': below, 'below:crossings': below, 'below:manufacturers': below,
  'below:fleet': below, 'below:clock': below, 'below:rhythm': below,
  firstRun: [
    { en: 'Your flight journal has no completed flights yet.', ru: 'В вашем журнале пока нет завершённых перелётов.' },
    { en: 'There are no completed flights in your overview yet.', ru: 'В вашем обзоре пока нет завершённых перелётов.' },
    { en: 'Your overview is waiting for its first completed flight.', ru: 'Ваш обзор ждёт первого завершённого перелёта.' },
  ],
  zero: [
    { en: 'No completed flights match your current filters.', ru: 'Завершённых перелётов по вашим фильтрам нет.' },
    { en: 'Your selected view contains no completed flights.', ru: 'В выбранном вами обзоре нет завершённых перелётов.' },
    { en: 'There are no completed flights in this selection.', ru: 'В этой выборке нет завершённых перелётов.' },
  ],
}
