export type Line = { en: string; ru: string }

const flights: [Line, Line, Line] = [
  { en: 'Flights in your selected view: {flights}.', ru: 'Перелётов в выборке: {flights}.' },
  {
    en: 'Your current selection includes this many flights: {flights}.',
    ru: 'Всего перелётов: {flights}.',
  },
  { en: 'Flight total for this view: {flights}.', ru: 'В обзоре перелётов: {flights}.' },
]
// Factual fallbacks for the slots and the six section gates.
export const CORPUS: Record<string, [Line, Line, Line]> = {
  records: flights,
  crossings: flights,
  routes: flights,
  aircraft: flights,
  clock: flights,
  rhythm: flights,
  rankings: flights,
  globe: flights,
  firstRun: [
    {
      en: 'Your flight journal has no completed flights yet.',
      ru: 'В журнале пока нет завершённых перелётов.',
    },
    {
      en: 'There are no completed flights in your overview yet.',
      ru: 'Завершённых перелётов пока нет.',
    },
    {
      en: 'Your overview is waiting for its first completed flight.',
      ru: 'Обзор ждёт первого завершённого перелёта.',
    },
  ],
  zero: [
    {
      en: 'No completed flights match your current filters.',
      ru: 'По фильтрам завершённых перелётов нет.',
    },
    {
      en: 'Your selected view contains no completed flights.',
      ru: 'В выборке нет завершённых перелётов.',
    },
    {
      en: 'There are no completed flights in this selection.',
      ru: 'Завершённых перелётов не найдено.',
    },
  ],
  'records:auckland-duration': [
    {
      en: 'Your longest duration ends in Auckland: about {hours} h. Noted.',
      ru: 'Окленд: около {hours} ч в пути. Принято к сведению.',
    },
    {
      en: 'About {hours} h to Auckland in this view’s duration record. A substantial entry.',
      ru: 'До Окленда — около {hours} ч. Весомая запись.',
    },
    {
      en: 'Auckland takes the duration record: about {hours} h. The clock has filed its report.',
      ru: 'Рекорд длительности — Окленд, около {hours} ч. Часы отчитались.',
    },
  ],
  'records:longest-distance': [
    {
      en: 'Your distance record: {origin}–{destination}, {km} km. A long line on the map.',
      ru: '{origin}–{destination}: {km} км. Самая длинная линия на карте.',
    },
    {
      en: '{origin}–{destination} leads this view by distance: {km} km. Geography was thorough.',
      ru: 'Дальше всего — {origin}–{destination}, {km} км. Основательно.',
    },
    {
      en: 'The longest route here is {origin}–{destination}: {km} km. Filed under distance.',
      ru: 'Самый длинный маршрут — {origin}–{destination}, {km} км. Зафиксировано.',
    },
  ],
  'records:busiest-year': [
    {
      en: 'Your busiest year here is {year}: flights {count}, active months {months}. A full report.',
      ru: '{year}: перелётов {count}, активных месяцев {months}. Отчёт плотный.',
    },
    {
      en: '{year} leads this view: flights {count}, months with flights {months}. Calendar evidence attached.',
      ru: 'Лидирует {year}: перелётов {count}, активных месяцев {months}.',
    },
    {
      en: 'Busiest year: {year}; flights: {count}; active months: {months}. The calendar kept receipts.',
      ru: 'В {year} — перелётов {count}, активных месяцев {months}. Год удался.',
    },
  ],
  'records:busiest-day': [
    {
      en: 'Your busiest day in this view: {date}, flights {count}. The date did some work.',
      ru: 'Рекорд дня — {date}: перелётов {count}. Дата поработала.',
    },
    {
      en: '{date} holds the daily record here: flights {count}. A busy calendar cell.',
      ru: '{date}: перелётов {count} за день. Плотная ячейка календаря.',
    },
    {
      en: 'Daily maximum: {count} flights on {date}. All under the same date.',
      ru: 'Больше всего за день — {date}: перелётов {count}.',
    },
  ],
  'records:streak': [
    {
      en: 'Your longest run of consecutive months with flights: {months}. The calendar found a pattern.',
      ru: 'Месяцев подряд с перелётами: {months}. Закономерность обнаружена.',
    },
    {
      en: 'Consecutive active months in this view: {months}. A documented streak.',
      ru: 'Серия: {months} мес. подряд. Подтверждено документально.',
    },
    {
      en: 'Longest monthly streak: {months}. No empty month inside that run.',
      ru: 'Самая длинная серия — {months} мес. Без пустых месяцев.',
    },
  ],
  'crossings:no-date-line': [
    {
      en: 'Date-line crossings recorded in this view: {count}. That boundary stayed out of the report.',
      ru: 'Пересечений линии перемены дат: {count}. Граница в отчёт не попала.',
    },
    {
      en: 'This view records {count} date-line crossings. The calendar kept its side of the line.',
      ru: 'Линия перемены дат, пересечений: {count}. Календарь не пострадал.',
    },
    {
      en: 'Recorded date-line crossings: {count}. No entry for that boundary here.',
      ru: 'По линии перемены дат: {count}. Замечаний нет.',
    },
  ],
  'crossings:date-line': [
    {
      en: 'Recorded date-line crossings here: {count}. The map has a calendar boundary.',
      ru: 'Пересечений линии перемены дат: {count}. Календарь подал жалобу.',
    },
    {
      en: 'Date-line crossing total in this view: {count}. A boundary with paperwork.',
      ru: 'Линия перемены дат, пересечений: {count}. Календарь сверяет показания.',
    },
    {
      en: 'Your routes record date-line crossings: {count}. Filed separately from clock shifts.',
      ru: 'По линии перемены дат: {count}. Учтено отдельно от сдвигов часов.',
    },
  ],
  'crossings:forward': [
    {
      en: 'Clock shifts in this view: forward {forward} h, back {back} h. Forward wins the ledger.',
      ru: 'Часы: вперёд {forward} ч, назад {back} ч. Перевес вперёд.',
    },
    {
      en: 'Your clock-change totals favour forward: {forward} h against {back} h back. Arithmetic, not jet lag.',
      ru: 'Перевес вперёд: {forward} ч против {back} ч. Арифметика, не джетлаг.',
    },
    {
      en: 'Forward shifts lead here: {forward} h; backward: {back} h. The clocks submitted totals.',
      ru: 'Вперёд — {forward} ч, назад — {back} ч. Часы сдали итоги.',
    },
  ],
  'manufacturers:airbus-boeing': [
    {
      en: 'Airbus flights in this view: {airbus}; Boeing: {boeing}. Boeing is still auditioning.',
      ru: 'Airbus: {airbus}, Boeing: {boeing}. Boeing пока на прослушивании.',
    },
    {
      en: 'Airbus leads the known makers here: {airbus} flights; Boeing: {boeing}. The cast is uneven.',
      ru: 'Airbus впереди: {airbus} против {boeing}. Состав неравномерный.',
    },
    {
      en: 'Your Airbus count is {airbus}, Boeing {boeing}. Airbus has the larger file.',
      ru: 'На Airbus — {airbus}, на Boeing — {boeing}. Папка Airbus толще.',
    },
  ],
  'manufacturers:unknown': [
    {
      en: 'Unknown-maker count: {unknown}; total flights here: {total}. The aircraft has left a blank field.',
      ru: 'Производитель неизвестен: {unknown} из {total}. Графа пустует.',
    },
    {
      en: 'Unknown-maker flights: {unknown}; view total: {total}. A gap in the filing.',
      ru: 'Без производителя: {unknown} из {total}. Пробел в ведомости.',
    },
    {
      en: 'Unknown-maker count in this view: {unknown}; total flights: {total}. Classification is not established.',
      ru: 'Производитель не установлен: {unknown} из {total}. Выясняется.',
    },
  ],
  'manufacturers:boeing-airbus': [
    {
      en: 'Boeing flights here: {boeing}; Airbus: {airbus}. Boeing has the larger attendance sheet.',
      ru: 'Boeing: {boeing}, Airbus: {airbus}. В списке Boeing больше отметок.',
    },
    {
      en: 'Boeing is ahead of Airbus in this view: {boeing} to {airbus}. Counts, not endorsements.',
      ru: 'Boeing впереди: {boeing} против {airbus}. Подсчёт, не рекомендация.',
    },
    {
      en: 'Your Boeing count exceeds Airbus: {boeing} versus {airbus}. The ledger takes no sides.',
      ru: 'На Boeing — {boeing}, на Airbus — {airbus}. Ведомость беспристрастна.',
    },
  ],
  'fleet:narrow-majority': [
    {
      en: 'Mostly narrowbodies among known body types: {narrow} of {known}; all flights here: {total}. Classification has limits.',
      ru: 'Узкофюзеляжные: {narrow} из {known}, всего {total}. Пустые графы воздержались.',
    },
    {
      en: 'Narrowbodies hold the known-body majority: {narrow} of {known}, from {total} total flights. The blanks abstained.',
      ru: 'Большинство — узкофюзеляжные: {narrow} из {known}, всего {total}.',
    },
    {
      en: 'Your narrowbody count is {narrow} out of {known} classified flights; view total {total}. A majority with a stated denominator.',
      ru: 'Один проход: {narrow} из {known}, всего {total}. Много локтей.',
    },
  ],
  'fleet:top-family': [
    {
      en: 'A leading family in this view: {family}, flights {count}. Familiar equipment.',
      ru: 'Среди лидеров — {family}: перелётов {count}. Знакомая техника.',
    },
    {
      en: '{family} is the displayed top family: flights {count}. The family file is substantial.',
      ru: 'Ведущее семейство — {family}: перелётов {count}. Внесено в записи.',
    },
    {
      en: 'Your top-family tile names {family}: flights {count}. A name entered in the records.',
      ru: '{family}: перелётов {count}. Семейство на виду.',
    },
  ],
  'fleet:untyped': [
    {
      en: 'Missing aircraft designations: {untyped}; total flights here: {total}. The fleet list has blanks.',
      ru: 'Без типа самолёта: {untyped} из {total}. В списке флота пробелы.',
    },
    {
      en: 'Flights with no aircraft recorded: {untyped} of {total}.',
      ru: 'Самолёт не указан: {untyped} из {total}.',
    },
    {
      en: 'Your fleet view’s untyped count is {untyped} out of {total} flights. The missing field is still missing.',
      ru: 'Перелётов без типа: {untyped} из {total}. Пустая графа пока пуста.',
    },
  ],
  'routes:commuter': [
    {
      en: '{flights} flights on {distinct} routes. Technically a commute with a boarding pass.',
      ru: 'Перелётов: {flights}, маршрутов: {distinct}. По сути, поездки на работу, только с посадочным.',
    },
    {
      en: '{flights} flights over {distinct} routes. The routes have memorised you.',
      ru: 'Перелётов: {flights}, маршрутов: {distinct}. Новизна по большей части не зафиксирована.',
    },
    {
      en: '{distinct} routes cover {flights} flights. Variety is kept to a minimum.',
      ru: 'Маршрутов: {distinct}, перелётов: {flights}. Разнообразие сведено к необходимому минимуму.',
    },
  ],
  'routes:explorer': [
    {
      en: '{distinct} routes in {flights} flights. Repeating one would have been sentimental.',
      ru: 'Маршрутов: {distinct}, перелётов: {flights}. Повторы практически исключены.',
    },
    {
      en: 'Almost every flight went somewhere new: {distinct} routes, {flights} flights. The loyalty programmes are confused.',
      ru: 'Маршрутов: {distinct}, перелётов: {flights}. Программы лояльности озадачены.',
    },
    {
      en: '{flights} flights, {distinct} routes. Returning was clearly never the plan.',
      ru: 'Перелётов: {flights}, маршрутов: {distinct}. Возвращаться, судя по данным, не планировалось.',
    },
  ],
  'routes:top-repeat': [
    {
      en: '{route} has been flown {count} times. Less a route than a habit.',
      ru: '{route}: перелётов по маршруту — {count}. Это уже не маршрут, а привычка.',
    },
    {
      en: '{route}, {count} times. The gate staff have stopped checking the name.',
      ru: '{route}, перелётов: {count}. Персонал на посадке, судя по всему, запомнил вас в лицо.',
    },
    {
      en: 'Most-flown route: {route}, {count} times. Noted.',
      ru: 'Самый частый маршрут: {route}, перелётов: {count}. Принято к сведению.',
    },
  ],
  'routes:home': [
    {
      en: '{percent}% of flights touch your home airport. Everything else is a guest appearance.',
      ru: '{percent}% перелётов затрагивают домашний аэропорт. Всё остальное — гастроли.',
    },
    {
      en: '{percent}% of flights start or end at home. Leaving is evidently always a round trip.',
      ru: '{percent}% перелётов начинаются или заканчиваются дома. Отъезд, судя по данным, всегда обратимый.',
    },
    {
      en: 'The home airport features in {percent}% of flights. It will take that as a compliment.',
      ru: 'Домашний аэропорт фигурирует в {percent}% перелётов. Претензий с его стороны не поступало.',
    },
  ],
  'clock:unique-peak': [
    {
      en: 'More departures fall in the {hour} hour than any other here: {count} of {timed} timed departures. The clock has a preference.',
      ru: 'Пик вылетов — час с {hour}: {count} из {timed}. Часы определились.',
    },
    {
      en: 'Your unique departure peak is the {hour} hour: {count} of {timed} known departure times. A well-attended hour.',
      ru: 'Час с {hour} — единоличный лидер: {count} из {timed}.',
    },
    {
      en: 'The {hour} hour leads departures outright: {count} of {timed} timed flights. The schedule has a recurring appointment.',
      ru: 'Чаще всего — час с {hour}: {count} из {timed}. Встреча по расписанию.',
    },
  ],
  'clock:morning-majority': [
    {
      en: 'Before-noon departures: about {percent}% of {timed} known departure times. Before noon has the majority.',
      ru: 'Вылеты до полудня: около {percent}% из {timed}. Большинство.',
    },
    {
      en: 'Your known departures favour before noon: about {percent}% of {timed}. The before-noon report is larger.',
      ru: 'До полудня — около {percent}% из {timed}. Перевес зафиксирован.',
    },
    {
      en: 'About {percent}% of {timed} timed departures are before noon. The clock counts, without asking why.',
      ru: 'Около {percent}% из {timed} — до полудня. Причины не выясняются.',
    },
  ],
  'clock:night': [
    {
      en: 'Night-band departures here: {count} of {timed} known times. The clock did a late shift.',
      ru: 'Ночных вылетов: {count} из {timed}. Часы отработали позднюю смену.',
    },
    {
      en: 'Your view’s night-departure count is {count} among {timed} timed flights. Night appears in the timetable.',
      ru: 'Ночь в расписании: {count} из {timed}. Принято к сведению.',
    },
    {
      en: 'Known departure times: {timed}; night-band count: {count}. Filed after hours.',
      ru: 'Вылетов ночью: {count} из {timed}. Учтено во внеурочные часы.',
    },
  ],
  'rhythm:every-july': [
    {
      en: 'Flights every July from {from} through {to} in this view: {years} years. The calendar has a standing appointment.',
      ru: 'Каждый июль {from}–{to} — с перелётами. Лет подряд: {years}.',
    },
    {
      en: 'Each July in the scoped {from}–{to} span has flights: {years} years. Recurrence documented.',
      ru: '{from}–{to}: перелёты в каждом июле. Лет: {years}. Традиция.',
    },
    {
      en: 'Your July cells are active throughout {from}–{to}: {years} years. A pattern with annual evidence.',
      ru: 'Июль без пропусков с {from} по {to}, лет: {years}. Календарь в курсе.',
    },
  ],
  'rhythm:gap': [
    {
      en: 'Longest empty run in this view: {from}–{to}; months: {months}. A gap in the selected calendar.',
      ru: 'Самый долгий перерыв — {from}–{to}, месяцев {months}.',
    },
    {
      en: 'No selected flights across {from}–{to}; consecutive months: {months}. The filter’s quiet interval.',
      ru: 'Без перелётов: {from}–{to}, месяцев подряд {months}. Тихий интервал.',
    },
    {
      en: 'Your current view’s longest monthly gap is {from}–{to}; months: {months}. Scope matters.',
      ru: 'Пауза {from}–{to}: месяцев {months}. Чемодан ждал.',
    },
  ],
  'rhythm:pooled-month': [
    {
      en: 'A busiest month number here is {month}: flights {count} pooled across years. Recurrence is a separate question.',
      ru: 'Месяц номер {month} — среди лидеров: перелётов {count} по всем годам.',
    },
    {
      en: 'Your pooled monthly peak is month {month}: flights {count} across this view’s years. Calendar totals, not an annual promise.',
      ru: 'Месяц номер {month}: перелётов {count} за все годы. Сумма, не традиция.',
    },
    {
      en: 'Month number {month} tops the displayed pooled totals: flights {count}. Years combined for counting.',
      ru: 'В сумме лидирует месяц номер {month}: перелётов {count}. Годы сложены.',
    },
  ],
  'rankings:tbilisi-half': [
    {
      en: 'Tbilisi’s endpoint count is {count}, half your flight total of {flights} here. A prominent entry.',
      ru: 'Тбилиси: отметок {count}, перелётов {flights}. Ровно половина.',
    },
    {
      en: 'Tbilisi endpoint occurrences: {count}; flights in this view: {flights}. Exactly half the flight total.',
      ru: 'С Тбилиси связан каждый второй перелёт: {count} из {flights}.',
    },
    {
      en: 'Your Tbilisi endpoint tally is {count} against {flights} flights. Half the flight total, with the denominator stated.',
      ru: 'Тбилиси — в {count} из {flights}. Половина, со знаменателем.',
    },
  ],
  'rankings:airport-leader': [
    {
      en: 'A leading airport here is {code}: {count} of {endpoints} endpoint entries. Both ends count.',
      ru: 'Среди лидеров — {code}: {count} из {endpoints}. Оба конца маршрута.',
    },
    {
      en: '{code} tops the airport list: {count} of {endpoints}. Arrivals and departures both count.',
      ru: '{code} вверху списка: {count} из {endpoints}. Учтены вылеты и прилёты.',
    },
    {
      en: '{code} heads the airport list: {count} of {endpoints} endpoint entries. This denominator has both ends.',
      ru: '{code} лидирует: {count} из {endpoints}. В знаменателе оба конца.',
    },
  ],
  'rankings:airline-leader': [
    {
      en: 'A leading airline here is {code}: flights {count}; recorded-airline total {known}. Blank fields abstain.',
      ru: 'Среди лидеров — {code}: {count} из {known}. Пустые графы воздержались.',
    },
    {
      en: '{code} tops your displayed airline list: flights {count}; known-airline total {known}. A count, not a loyalty programme.',
      ru: 'Вверху списка — {code}: {count} из {known}. Подсчёт, не программа лояльности.',
    },
    {
      en: 'Displayed airline leader: {code}; flights: {count}; recorded-airline total: {known}. No membership inferred.',
      ru: 'Лидирует {code}: {count} из {known}. Членство не предполагается.',
    },
  ],
  'rankings:route-leader': [
    {
      en: 'A leading route here is {route}: flights {count}, both directions combined. A well-used line.',
      ru: '{route}: перелётов {count} в обе стороны. Линия востребована.',
    },
    {
      en: 'Your displayed top route is {route}: flights {count} across both directions. Direction filed separately.',
      ru: 'Вверху списка — {route}: перелётов {count}. Направления сложены.',
    },
    {
      en: '{route} heads the route list: flights {count}, outbound and return counted together. A recurring connection.',
      ru: '{route} возглавляет список: перелётов {count}, туда и обратно.',
    },
  ],
  'globe:filtered-total': [
    {
      en: 'Your filters show {selected} of {total} all-time flights. The map is reading the selected file.',
      ru: 'По фильтрам: {selected} из {total} за всё время. Карта читает выбранное.',
    },
    {
      en: 'Flights in this view: {selected}; all-time flights: {total}. A smaller file on the desk.',
      ru: 'В выборке {selected} из {total}. Папка на столе потоньше.',
    },
    {
      en: 'Selected flights: {selected} out of {total} all-time. The filter has narrowed the report.',
      ru: 'Фильтр оставил {selected} из {total} за всё время. Отчёт сокращён.',
    },
  ],
  'globe:route-footprint': [
    {
      en: 'This view connects airport pairs: {routes}; airports: {airports}. The map has enough lines to file.',
      ru: 'Пар аэропортов: {routes}, аэропортов: {airports}. Карте есть что внести.',
    },
    {
      en: 'Your selected route footprint: {routes} airport pairs across {airports} airports. Directions combined for counting.',
      ru: 'Маршрутов: {routes}, аэропортов: {airports}. Направления объединены.',
    },
    {
      en: 'Distinct airport pairs here: {routes}; airports involved: {airports}. Geography, reduced to entries.',
      ru: 'Аэропортов: {airports}, пар между ними: {routes}. География в виде записей.',
    },
  ],
}
