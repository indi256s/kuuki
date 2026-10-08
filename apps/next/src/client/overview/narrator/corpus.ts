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

// Factual fallbacks for the ten slots and the six actual section gates.
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
  'records:auckland-duration': [
    { en: "Your longest duration ends in Auckland: about {hours} h. Noted.", ru: "Самый долгий перелёт в выборке — до Окленда: около {hours} ч. Принято к сведению." },
    { en: "About {hours} h to Auckland in this view’s duration record. A substantial entry.", ru: "До Окленда — около {hours} ч по рекорду длительности. Весомая запись." },
    { en: "Auckland takes the duration record: about {hours} h. The clock has filed its report.", ru: "Окленду достался рекорд длительности: около {hours} ч. Часы представили отчёт." },
  ],
  'records:longest-distance': [
    { en: "Your distance record: {origin}–{destination}, {km} km. A long line on the map.", ru: "Ваш рекорд расстояния: {origin}–{destination}, {km} км. Длинная линия на карте." },
    { en: "{origin}–{destination} leads this view by distance: {km} km. Geography was thorough.", ru: "По расстоянию в выборке лидирует {origin}–{destination}: {km} км. География подошла основательно." },
    { en: "The longest route here is {origin}–{destination}: {km} km. Filed under distance.", ru: "Самый длинный маршрут здесь — {origin}–{destination}: {km} км. Внесено в графу расстояний." },
  ],
  'records:busiest-year': [
    { en: "Your busiest year here is {year}: flights {count}, active months {months}. A full report.", ru: "Самый насыщенный год в выборке — {year}: перелётов {count}, активных месяцев {months}. Отчёт содержательный." },
    { en: "{year} leads this view: flights {count}, months with flights {months}. Calendar evidence attached.", ru: "В выборке лидирует {year}: перелётов {count}, месяцев с перелётами {months}. Календарь прилагается." },
    { en: "Busiest year: {year}; flights: {count}; active months: {months}. The calendar kept receipts.", ru: "Самый насыщенный год: {year}; перелётов: {count}; активных месяцев: {months}. Календарь всё зафиксировал." },
  ],
  'records:busiest-day': [
    { en: "Your busiest day in this view: {date}, flights {count}. The date did some work.", ru: "Самый насыщенный день в выборке: {date}, перелётов {count}. Дата поработала." },
    { en: "{date} holds the daily record here: flights {count}. A busy calendar cell.", ru: "Рекорд за день здесь у {date}: перелётов {count}. Плотная ячейка календаря." },
    { en: "Daily maximum: {count} flights on {date}. All under the same date.", ru: "Максимум за день: перелётов {count}, дата {date}. Всё оформлено одним числом." },
  ],
  'records:streak': [
    { en: "Your longest run of consecutive months with flights: {months}. The calendar found a pattern.", ru: "Самая длинная серия месяцев с перелётами: {months}. Календарь обнаружил закономерность." },
    { en: "Consecutive active months in this view: {months}. A documented streak.", ru: "Месяцев с перелётами подряд в выборке: {months}. Серия документально подтверждена." },
    { en: "Longest monthly streak: {months}. No empty month inside that run.", ru: "Самая длинная серия активных месяцев: {months}. Внутри этой серии пустых месяцев нет." },
  ],
  'crossings:no-date-line': [
    { en: "Date-line crossings recorded in this view: {count}. That boundary stayed out of the report.", ru: "Пересечений линии перемены дат в выборке: {count}. Эта граница в отчёт не попала." },
    { en: "This view records {count} date-line crossings. The calendar kept its side of the line.", ru: "В выборке зафиксировано пересечений линии перемены дат: {count}. Календарь остался по свою сторону." },
    { en: "Recorded date-line crossings: {count}. No entry for that boundary here.", ru: "Зафиксированных пересечений линии перемены дат: {count}. По этой границе записей нет." },
  ],
  'crossings:date-line': [
    { en: "Recorded date-line crossings here: {count}. The map has a calendar boundary.", ru: "Зафиксированных пересечений линии перемены дат: {count}. У карты есть календарная граница." },
    { en: "Date-line crossing total in this view: {count}. A boundary with paperwork.", ru: "Всего пересечений линии перемены дат в выборке: {count}. Граница с отчётностью." },
    { en: "Your routes record date-line crossings: {count}. Filed separately from clock shifts.", ru: "На ваших маршрутах отмечено пересечений линии перемены дат: {count}. Учтено отдельно от сдвигов часов." },
  ],
  'crossings:forward': [
    { en: "Clock shifts in this view: forward {forward} h, back {back} h. Forward wins the ledger.", ru: "Сдвиги часов в выборке: вперёд {forward} ч, назад {back} ч. Ведомость в пользу движения вперёд." },
    { en: "Your clock-change totals favour forward: {forward} h against {back} h back. Arithmetic, not jet lag.", ru: "В ваших сдвигах часов перевес вперёд: {forward} ч против {back} ч назад. Арифметика, не джетлаг." },
    { en: "Forward shifts lead here: {forward} h; backward: {back} h. The clocks submitted totals.", ru: "Здесь больше сдвигов вперёд: {forward} ч; назад: {back} ч. Часы сдали итоги." },
  ],
  'manufacturers:airbus-boeing': [
    { en: "Airbus flights in this view: {airbus}; Boeing: {boeing}. Boeing is still auditioning.", ru: "Перелётов на Airbus в выборке: {airbus}; на Boeing: {boeing}. Boeing пока на прослушивании." },
    { en: "Airbus leads the known makers here: {airbus} flights; Boeing: {boeing}. The cast is uneven.", ru: "Среди известных производителей здесь лидирует Airbus: перелётов {airbus}; Boeing: {boeing}. Состав неравномерный." },
    { en: "Your Airbus count is {airbus}, Boeing {boeing}. Airbus has the larger file.", ru: "У вас на Airbus — {airbus}, на Boeing — {boeing}. Папка Airbus толще." },
  ],
  'manufacturers:unknown': [
    { en: "Unknown-maker count: {unknown}; total flights here: {total}. The aircraft has left a blank field.", ru: "Перелётов с неизвестным производителем: {unknown}; всего здесь: {total}. Самолёт оставил пустую графу." },
    { en: "Unknown-maker flights: {unknown}; view total: {total}. A gap in the filing.", ru: "Перелётов с неизвестным производителем: {unknown}; всего в выборке: {total}. Пробел в ведомости." },
    { en: "Unknown-maker count in this view: {unknown}; total flights: {total}. Classification is not established.", ru: "В выборке перелётов без известного производителя: {unknown} из {total}. В данных классификация не установлена." },
  ],
  'manufacturers:boeing-airbus': [
    { en: "Boeing flights here: {boeing}; Airbus: {airbus}. Boeing has the larger attendance sheet.", ru: "Перелётов на Boeing здесь: {boeing}; на Airbus: {airbus}. В списке Boeing больше отметок." },
    { en: "Boeing is ahead of Airbus in this view: {boeing} to {airbus}. Counts, not endorsements.", ru: "Boeing опережает Airbus в выборке: {boeing} против {airbus}. Подсчёт, не рекомендация." },
    { en: "Your Boeing count exceeds Airbus: {boeing} versus {airbus}. The ledger takes no sides.", ru: "У вас на Boeing больше перелётов, чем на Airbus: {boeing} против {airbus}. Ведомость беспристрастна." },
  ],
  'fleet:narrow-majority': [
    { en: "Mostly narrowbodies among known body types: {narrow} of {known}; all flights here: {total}. Classification has limits.", ru: "Среди известных типов корпуса преобладают узкофюзеляжные: {narrow} из {known}; всего перелётов: {total}. У классификации есть пределы." },
    { en: "Narrowbodies hold the known-body majority: {narrow} of {known}, from {total} total flights. The blanks abstained.", ru: "Большинство среди известных типов корпуса — узкофюзеляжные: {narrow} из {known}, при общем числе перелётов {total}. Пустые графы воздержались." },
    { en: "Your narrowbody count is {narrow} out of {known} classified flights; view total {total}. A majority with a stated denominator.", ru: "У вас узкофюзеляжных перелётов: {narrow} из {known} с известным типом корпуса; всего {total}. Большинство с указанным знаменателем." },
  ],
  'fleet:top-family': [
    { en: "A leading family in this view: {family}, flights {count}. Familiar equipment.", ru: "Среди ведущих семейств в выборке — {family}, перелётов {count}. Знакомая техника." },
    { en: "{family} is the displayed top family: flights {count}. The family file is substantial.", ru: "В плитке ведущего семейства — {family}: перелётов {count}. Папка семейства содержательная." },
    { en: "Your top-family tile names {family}: flights {count}. A name entered in the records.", ru: "Ваша плитка ведущего семейства показывает {family}: перелётов {count}. Название внесено в записи." },
  ],
  'fleet:untyped': [
    { en: "Missing aircraft designations: {untyped}; total flights here: {total}. The fleet list has blanks.", ru: "Перелётов без указанного типа самолёта: {untyped}; всего здесь: {total}. В списке флота есть пробелы." },
    { en: "Flights without an aircraft designation: {untyped}; all flights: {total}. Unassigned seats in the data.", ru: "Перелётов без указанного типа самолёта: {untyped}; всего: {total}. В данных остались свободные графы." },
    { en: "Your fleet view’s untyped count is {untyped} out of {total} flights. The missing field is still missing.", ru: "В вашем флоте перелётов без типа самолёта: {untyped} из {total}. Пустая графа пока остаётся пустой." },
  ],
  'clock:unique-peak': [
    { en: "More departures fall in the {hour} hour than any other here: {count} of {timed} timed departures. The clock has a preference.", ru: "Больше всего вылетов здесь приходится на час с {hour}: {count} из {timed} с известным временем. У часов есть предпочтение." },
    { en: "Your unique departure peak is the {hour} hour: {count} of {timed} known departure times. A well-attended hour.", ru: "Единственный пик ваших вылетов — час с {hour}: {count} из {timed} с известным временем. Посещаемый час." },
    { en: "The {hour} hour leads departures outright: {count} of {timed} timed flights. The schedule has a recurring appointment.", ru: "Час с {hour} единолично лидирует по вылетам: {count} из {timed} с известным временем. В расписании повторяется назначенный час." },
  ],
  'clock:morning-majority': [
    { en: "Before-noon departures: about {percent}% of {timed} known departure times. Before noon has the majority.", ru: "Вылеты до полудня: около {percent}% из {timed} с известным временем. До полудня — большинство." },
    { en: "Your known departures favour before noon: about {percent}% of {timed}. The before-noon report is larger.", ru: "Среди ваших вылетов с известным временем больше вылетов до полудня: около {percent}% из {timed}. Ведомость до полудня объёмнее." },
    { en: "About {percent}% of {timed} timed departures are before noon. The clock counts, without asking why.", ru: "До полудня — около {percent}% из {timed} вылетов с известным временем. Часы считают, не выясняя причин." },
  ],
  'clock:night': [
    { en: "Night-band departures here: {count} of {timed} known times. The clock did a late shift.", ru: "Вылетов в ночном диапазоне: {count} из {timed} с известным временем. Часы отработали позднюю смену." },
    { en: "Your view’s night-departure count is {count} among {timed} timed flights. Night appears in the timetable.", ru: "В вашей выборке ночных вылетов: {count} из {timed} с известным временем. Ночь присутствует в расписании." },
    { en: "Known departure times: {timed}; night-band count: {count}. Filed after hours.", ru: "Вылетов с известным временем: {timed}; из них в ночном диапазоне: {count}. Учтено во внеурочные часы." },
  ],
  'rhythm:every-july': [
    { en: "Flights every July from {from} through {to} in this view: {years} years. The calendar has a standing appointment.", ru: "Перелёты есть в каждом июле с {from} по {to} в этой выборке: лет {years}. У календаря постоянная запись." },
    { en: "Each July in the scoped {from}–{to} span has flights: {years} years. Recurrence documented.", ru: "В каждом июле выбранного периода {from}–{to} есть перелёты: лет {years}. Повторяемость подтверждена." },
    { en: "Your July cells are active throughout {from}–{to}: {years} years. A pattern with annual evidence.", ru: "У вас активны все июльские ячейки за {from}–{to}: лет {years}. Закономерность с ежегодным подтверждением." },
  ],
  'rhythm:gap': [
    { en: "Longest empty run in this view: {from}–{to}; months: {months}. A gap in the selected calendar.", ru: "Самая длинная пустая серия в выборке: месяцев {months}, {from}–{to}. Пробел в выбранном календаре." },
    { en: "No selected flights across {from}–{to}; consecutive months: {months}. The filter’s quiet interval.", ru: "Перелётов в выборке за {from}–{to} нет: месяцев подряд {months}. Тихий интервал по этим фильтрам." },
    { en: "Your current view’s longest monthly gap is {from}–{to}; months: {months}. Scope matters.", ru: "Самый длинный помесячный пробел в вашем обзоре — {from}–{to}: месяцев {months}. С учётом выборки." },
  ],
  'rhythm:pooled-month': [
    { en: "A busiest month number here is {month}: flights {count} pooled across years. Recurrence is a separate question.", ru: "Один из самых насыщенных месяцев здесь — номер {month}: перелётов {count} по всем годам выборки. Ежегодная повторяемость — отдельный вопрос." },
    { en: "Your pooled monthly peak is month {month}: flights {count} across this view’s years. Calendar totals, not an annual promise.", ru: "Общий помесячный пик у вас — месяц номер {month}: перелётов {count} за годы выборки. Сумма по календарю, не ежегодное обещание." },
    { en: "Month number {month} tops the displayed pooled totals: flights {count}. Years combined for counting.", ru: "В сводных итогах показан месяц номер {month}: перелётов {count}. Годы объединены для подсчёта." },
  ],
  'rankings:tbilisi-half': [
    { en: "Tbilisi’s endpoint count is {count}, half your flight total of {flights} here. A prominent entry.", ru: "У Тбилиси отметок в конечных точках: {count}, половина от {flights} перелётов в выборке. Заметная запись." },
    { en: "Tbilisi endpoint occurrences: {count}; flights in this view: {flights}. Exactly half the flight total.", ru: "У Тбилиси отметок в конечных точках: {count}; в выборке перелётов: {flights}. Ровно половина от числа перелётов." },
    { en: "Your Tbilisi endpoint tally is {count} against {flights} flights. Half the flight total, with the denominator stated.", ru: "У вас отметок Тбилиси в конечных точках: {count} при числе перелётов {flights}. Половина, со знаменателем." },
  ],
  'rankings:airport-leader': [
    { en: "A leading airport here is {code}: {count} of {endpoints} endpoint entries. Both ends count.", ru: "Среди ведущих аэропортов здесь — {code}: {count} из {endpoints} отметок в конечных точках. Считаются оба конца." },
    { en: "Your displayed top airport is {code}: endpoint entries {count} out of {endpoints}. The ledger counts arrivals and departures.", ru: "Вверху вашего списка аэропортов — {code}: отметок {count} из {endpoints} конечных точек. Учтены и прилёты, и вылеты." },
    { en: "{code} heads the airport list: {count} of {endpoints} endpoint entries. This denominator has both ends.", ru: "{code} возглавляет список аэропортов: {count} из {endpoints} отметок в конечных точках. В знаменателе оба конца маршрута." },
  ],
  'rankings:airline-leader': [
    { en: "A leading airline here is {code}: flights {count}; recorded-airline total {known}. Blank fields abstain.", ru: "Среди ведущих авиакомпаний здесь — {code}: перелётов {count}; всего с указанной авиакомпанией {known}. Пустые графы воздержались." },
    { en: "{code} tops your displayed airline list: flights {count}; known-airline total {known}. A count, not a loyalty programme.", ru: "В вашем списке авиакомпаний сверху {code}: перелётов {count}; всего с известной авиакомпанией {known}. Подсчёт, не программа лояльности." },
    { en: "Displayed airline leader: {code}; flights: {count}; recorded-airline total: {known}. No membership inferred.", ru: "В списке авиакомпаний лидирует {code}; перелётов: {count}; всего с указанной авиакомпанией: {known}. Членство не предполагается." },
  ],
  'rankings:route-leader': [
    { en: "A leading route here is {route}: flights {count}, both directions combined. A well-used line.", ru: "Среди ведущих маршрутов здесь — {route}: перелётов {count} в обоих направлениях. Востребованная линия." },
    { en: "Your displayed top route is {route}: flights {count} across both directions. Direction filed separately.", ru: "В вашем списке маршрутов сверху {route}: перелётов {count} в обоих направлениях. Направление учтено отдельно." },
    { en: "{route} heads the route list: flights {count}, outbound and return counted together. A recurring connection.", ru: "{route} возглавляет список маршрутов: перелётов {count}, оба направления вместе. Повторяющаяся связь." },
  ],
  'globe:filtered-total': [
    { en: "Your filters show {selected} of {total} all-time flights. The map is reading the selected file.", ru: "По вашим фильтрам показано {selected} из {total} перелётов за всё время. Карта читает выбранную папку." },
    { en: "Flights in this view: {selected}; all-time flights: {total}. A smaller file on the desk.", ru: "Перелётов в выборке: {selected}; за всё время: {total}. На столе более тонкая папка." },
    { en: "Selected flights: {selected} out of {total} all-time. The filter has narrowed the report.", ru: "В выборке перелётов: {selected} из {total} за всё время. Фильтр сократил отчёт." },
  ],
  'globe:route-footprint': [
    { en: "This view connects airport pairs: {routes}; airports: {airports}. The map has enough lines to file.", ru: "В выборке пар аэропортов: {routes}; аэропортов: {airports}. Карте есть что внести в отчёт." },
    { en: "Your selected route footprint: {routes} airport pairs across {airports} airports. Directions combined for counting.", ru: "В вашей выборке пар аэропортов: {routes}, аэропортов: {airports}. Направления объединены для подсчёта." },
    { en: "Distinct airport pairs here: {routes}; airports involved: {airports}. Geography, reduced to entries.", ru: "Различных пар аэропортов здесь: {routes}; задействовано аэропортов: {airports}. География в виде записей." },
  ],
}
