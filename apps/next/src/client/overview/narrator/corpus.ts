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
      en: 'A whole planet, and not one route on it. Bold of you.',
      ru: 'Целая планета — и ни одного маршрута. Смело.',
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
  'records:southernmost': [
    {
      en: 'Furthest south: {code}, {lat}° S. The sun sits in the north there.',
      ru: 'Самая южная точка — {code}, {lat}° ю. ш. Солнце там светит с севера.',
    },
    {
      en: "{code}, {lat}° south. Most maps don't bother to centre here.",
      ru: '{code}: {lat}° ю. ш. Большинство карт сюда не заглядывает.',
    },
    {
      en: '{code} at {lat}° south. The seasons run backwards there, on principle.',
      ru: '{code}, {lat}° ю. ш. Времена года там идут наоборот — принципиально.',
    },
  ],
  'records:shortest-duration': [
    {
      en: 'Shortest flight: {minutes} min. The gear barely had time to retract.',
      ru: 'Самый короткий — {minutes} мин. Шасси можно было не убирать.',
    },
    {
      en: '{minutes} min in the air. The seatbelt sign barely went off.',
      ru: '{minutes} мин в воздухе. Табло «Пристегните ремни» почти не гасло.',
    },
    {
      en: '{minutes} min aloft. Climb, level off, descend.',
      ru: 'Всего {minutes} мин: набор высоты, снижение, посадка.',
    },
  ],
  'records:biggest-clock-jump': [
    {
      en: 'One flight moved the clock {hours} h. The body filed an appeal.',
      ru: 'Один перелёт сдвинул часы на {hours} ч. Организм подал апелляцию.',
    },
    {
      en: 'Biggest clock jump: {hours} h in one flight. The watch adjusted; sleep did not.',
      ru: 'Сдвиг на {hours} ч за один перелёт. Часы перестроились, сон — нет.',
    },
    {
      en: '{hours} h in one go. Local time won on points.',
      ru: '{hours} ч за один рейс. Местное время победило по очкам.',
    },
  ],
  'records:latest-departure': [
    {
      en: 'Latest departure: {time}. Sensible people were asleep.',
      ru: 'Самый поздний вылет — {time}. Здравомыслящие люди в это время спят.',
    },
    {
      en: 'Departure at {time}. The day went into unpaid overtime.',
      ru: 'Вылет в {time}. День ушёл в неоплачиваемую переработку.',
    },
    {
      en: 'A {time} departure. Bedtime was negotiable.',
      ru: 'Вылет в {time}. Отбой перенесён.',
    },
  ],
  'crossings:continent-majority': [
    {
      en: '{percent}% of flights start or end on the same continent. The rest of the tray is for visits.',
      ru: '{percent}% перелётов начинаются или заканчиваются на одном континенте. Остальные — для визитов.',
    },
    {
      en: 'One continent is on {percent}% of flights. The others get the occasional turn.',
      ru: 'Один континент — в {percent}% перелётов. Остальным перепадает изредка.',
    },
    {
      en: '{percent}% of flights touch one continent. Home turf, statistically speaking.',
      ru: 'На один континент приходится {percent}% перелётов. Домашняя территория, по статистике.',
    },
  ],
  'crossings:no-new-continent': [
    {
      en: 'No new continent since {year}. The flying carried on; the tray stopped growing.',
      ru: 'После {year} года новых континентов не поступало. Полёты продолжаются, лоток — нет.',
    },
    {
      en: 'The last new continent arrived in {year}. Since then, reruns.',
      ru: 'Последний новый континент добавлен в {year} году. Дальше — только повторы.',
    },
    {
      en: 'Every flight after {year} kept to continents already reached. The tray is in maintenance mode.',
      ru: 'После {year} года — только знакомые континенты. Лоток в режиме обслуживания.',
    },
  ],
  'crossings:no-antarctica': [
    {
      en: '{flown} continents, Antarctica not among them. The ice can wait.',
      ru: 'Континентов: {flown}, Антарктиды среди них нет. Лёд подождёт.',
    },
    {
      en: 'Continents reached: {flown}. Antarctica is still holding out.',
      ru: 'Освоено континентов: {flown}. Антарктида пока держит оборону.',
    },
    {
      en: '{flown} continents in the tray. Antarctica stays in the box.',
      ru: 'Континентов в лотке: {flown}. Антарктида остаётся в коробке.',
    },
  ],
  'crossings:no-date-line': [
    {
      en: 'Estimated antimeridian crossings recorded in this view: {count}. That boundary stayed out of the report.',
      ru: 'Расчётных пересечений антимеридиана: {count}. Граница в отчёт не попала.',
    },
    {
      en: 'Estimated antimeridian crossings: {count}. The estimate stays on this side.',
      ru: 'Антимеридиан, расчётных пересечений: {count}. Расчёт остался по эту сторону.',
    },
    {
      en: 'Estimated antimeridian crossings: {count}. No entry for that boundary here.',
      ru: 'Расчётных пересечений антимеридиана: {count}. Замечаний нет.',
    },
  ],
  'crossings:date-line': [
    {
      en: 'Estimated antimeridian crossings here: {count}. An estimated arc, not a flight track.',
      ru: 'Расчётных пересечений антимеридиана: {count}. Расчётная дуга, не трек самолёта.',
    },
    {
      en: 'Estimated antimeridian crossing total in this view: {count}. A boundary with paperwork.',
      ru: 'Антимеридиан, расчётных пересечений: {count}. Расчёт сверяет показания.',
    },
    {
      en: 'Estimated arc antimeridian crossings: {count}. Filed separately from clock shifts.',
      ru: 'Расчётных пересечений антимеридиана: {count}. Учтено отдельно от сдвигов часов.',
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
  'crossings:mostly-backwards': [
    {
      en: 'The clock returned {back} h. The days keep running long.',
      ru: 'Часы вернули {back} ч. Дни получаются длиннее.',
    },
    {
      en: 'Clock refunds: {back} h. Non-transferable.',
      ru: 'Часы вернули {back} ч. Без права передачи.',
    },
    {
      en: '{back} h back. The clock gives refunds.',
      ru: '{back} ч назад. Часы возвращают сдачу.',
    },
  ],
  'crossings:arctic-circle': [
    {
      en: 'Estimated Arctic Circle crossings: {count}. The penguins are at the other end.',
      ru: 'Расчётных пересечений Полярного круга: {count}. Пингвины, напомним, на другом конце.',
    },
    {
      en: 'Estimated Arctic Circle crossings: {count}. Polar bears were not informed.',
      ru: 'Полярный круг, расчётных пересечений: {count}. Белых медведей не уведомляли.',
    },
    {
      en: 'Estimated Arctic Circle crossings: {count}. The line is invisible from above.',
      ru: 'Полярный круг, расчётных пересечений: {count}. С высоты линия не видна.',
    },
  ],
  'crossings:equator': [
    {
      en: 'Estimated equator crossings: {count}. The water in the sink was not consulted.',
      ru: 'Расчётных пересечений экватора: {count}. Мнение воды в раковине не учитывалось.',
    },
    {
      en: 'Estimated equator crossings: {count}. The seasons have stopped making sense.',
      ru: 'Экватор, расчётных пересечений: {count}. Времена года утратили логику.',
    },
    {
      en: 'Estimated equator crossings: {count}. No ceremony was held, presumably.',
      ru: 'Экватор, расчётных пересечений: {count}. Церемоний, по-видимому, не проводилось.',
    },
  ],
  'crossings:zones': [
    {
      en: 'Hourly UTC bins: {zones} used, {left} empty. The endpoints submitted their hours.',
      ru: 'Часовых бинов UTC: {zones}, пустых: {left}. Аэропорты сдали показания.',
    },
    {
      en: 'Endpoint UTC bins: {zones} filled, {left} empty. The clock face keeps score.',
      ru: 'UTC по аэропортам: бинов {zones}, пустых {left}. Циферблат ведёт учёт.',
    },
    {
      en: 'Hourly endpoint bins: {zones} occupied, {left} vacant. Space on the clock remains.',
      ru: 'Часовых бинов по аэропортам: {zones}, пустых: {left}. На циферблате есть место.',
    },
  ],
  'crossings:no-equator': [
    {
      en: 'No estimated arc crosses the equator. The other hemisphere awaits paperwork.',
      ru: 'Расчётные дуги не пересекают экватор. Второе полушарие ждёт документов.',
    },
    {
      en: 'The estimated arcs leave the equator alone. No ceremony required.',
      ru: 'По расчётным дугам экватор не пересечён. Церемония не требуется.',
    },
    {
      en: 'No equator crossings in the estimated arcs. The line has the day off.',
      ru: 'По расчётным дугам пересечений экватора нет. У линии выходной.',
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
  'aircraft:sample': [
    {
      en: 'The fleet below is a sample. The rest flew on something, presumably.',
      ru: 'Ниже — выборка. Остальные, предположительно, тоже летели на чём-то.',
    },
    {
      en: 'Most of the aircraft never introduced themselves. Rude.',
      ru: 'Большинство самолётов не представились. Невежливо.',
    },
    {
      en: 'Blank fields stay blank. Nobody here is guessing.',
      ru: 'Пустые графы остаются пустыми. Гадать здесь не принято.',
    },
  ],
  'aircraft:full': [
    {
      en: 'Every flight has its aircraft. Suspiciously thorough.',
      ru: 'Тип указан для всех перелётов. Подозрительно тщательно.',
    },
    {
      en: 'No blank aircraft fields. Someone enjoys paperwork.',
      ru: 'Пустых граф нет. Кто-то любит заполнять бланки.',
    },
    {
      en: 'Aircraft known for every flight. The report has no complaints.',
      ru: 'Тип известен для каждого перелёта. Претензий к отчёту нет.',
    },
  ],
  'fleet:few-types': [
    {
      en: 'Aircraft types: {types}, across {typed} flights. A compact fleet.',
      ru: 'Типов: {types}, перелётов с типом: {typed}. Парк компактный.',
    },
    {
      en: 'Types: {types} over {typed} flights. It all fits on a sticky note.',
      ru: 'Типов: {types}, перелётов с типом: {typed}. Умещается на стикере.',
    },
    {
      en: '{typed} typed flights, types: {types}. Brand loyalty, or a lack of options.',
      ru: 'Перелётов с типом: {typed}, типов: {types}. Лояльность или отсутствие выбора.',
    },
  ],
  'fleet:widebody-minority': [
    {
      en: 'Widebodies: {wide} of {typed}. Two aisles remain a special occasion.',
      ru: 'Широкофюзеляжные: {wide} из {typed}. Два прохода — по особым случаям.',
    },
    {
      en: '{wide} of {typed} known-type flights had two aisles. A rare upgrade in floor space.',
      ru: 'Два прохода: {wide} из {typed}. Дополнительное пространство — редкость.',
    },
    {
      en: 'Two aisles on {wide} of {typed}. Luxury has a small market share.',
      ru: 'Широких бортов — {wide} из {typed}. У простора скромная доля рынка.',
    },
  ],
  'fleet:family-majority': [
    {
      en: '{family}: {percent}% of known-type flights. Other aircraft do exist.',
      ru: '{family}: {percent}% рейсов с типом. Другие самолёты тоже существуют.',
    },
    {
      en: '{family}: {percent}% of known-type flights. You could find the lavatory blindfolded.',
      ru: '{family} — {percent}% рейсов с типом. Туалет вы найдёте с закрытыми глазами.',
    },
    {
      en: '{family} on {percent}% of known-type flights. Practically a company car.',
      ru: 'На {family} — {percent}% рейсов с типом. Практически служебный транспорт.',
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
  'routes:repeat-share': [
    {
      en: 'Repeat routes: {percent}%. Novelty is rationed.',
      ru: 'Повторяющиеся маршруты — {percent}%. Новизна выдаётся по талонам.',
    },
    {
      en: '{percent}% on routes flown more than once. The map draws over its own lines.',
      ru: '{percent}% — на маршрутах-повторах. Карта обводит собственные линии.',
    },
    {
      en: 'Routes used more than once carry {percent}%. Familiar airports, familiar queues.',
      ru: 'Знакомые маршруты — {percent}% перелётов. Знакомые аэропорты, знакомые очереди.',
    },
  ],
  'routes:mixed-profile': [
    {
      en: '{flights} flights, {distinct} routes. Habit, with lapses into curiosity.',
      ru: 'Перелётов: {flights}, маршрутов: {distinct}. Привычка с редкими приступами любопытства.',
    },
    {
      en: '{distinct} routes over {flights} flights. Some returns, some firsts.',
      ru: 'Маршрутов: {distinct}, перелётов: {flights}. Повторы чередуются с новинками.',
    },
    {
      en: '{flights} flights on {distinct} routes. Neither a rut nor a grand tour.',
      ru: 'Перелётов: {flights}, маршрутов: {distinct}. Ни колея, ни кругосветка.',
    },
  ],
  'routes:all-new-year': [
    {
      en: 'Every route in {year} was a first. {flights} flights, no reruns.',
      ru: '{year}: все маршруты новые. Перелётов: {flights}, повторов нет.',
    },
    {
      en: '{year}: {flights} flights, each on a new route. Remarkably unrepetitive.',
      ru: '{year}: ни одного повтора. Перелётов: {flights}.',
    },
    {
      en: 'No route repeated in {year}. The map gained {flights} new lines.',
      ru: '{year} прошёл без повторов. Новых линий на карте: {flights}.',
    },
  ],
  'routes:nothing-new-year': [
    {
      en: '{year}: {flights} flights, all on routes you knew.',
      ru: '{year}: перелётов: {flights}, все по знакомым маршрутам.',
    },
    {
      en: 'No new routes in {year}, across {flights} flights. The old ones coped.',
      ru: '{year}: новых маршрутов нет, перелётов: {flights}. Старые справлялись.',
    },
    {
      en: '{year} repeated itself: {flights} flights, no premieres.',
      ru: '{year} прошёл в повторе. Перелётов: {flights}, премьер нет.',
    },
  ],
  'routes:home-on-margin': [
    {
      en: 'Home airport: {percent}% of flights. It hears about the trips afterwards.',
      ru: 'Домашний аэропорт — в {percent}% перелётов. О поездках он узнаёт постфактум.',
    },
    {
      en: '{percent}% touch the home airport. Home base, in name only.',
      ru: 'Через домашний аэропорт — {percent}%. База — скорее номинально.',
    },
    {
      en: 'The home airport features in {percent}% of flights. A cameo.',
      ru: 'Домашний аэропорт: {percent}%. Эпизодическая роль.',
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
  'clock:sample': [
    {
      en: 'The clock counts only flights that admit when they left.',
      ru: 'Часы учитывают только рейсы с признанным временем вылета.',
    },
    {
      en: 'Most departures kept their time to themselves. The clock copes.',
      ru: 'Большинство вылетов время не указали. Часы справляются.',
    },
    {
      en: 'Untimed flights stay off the dial. Their loss.',
      ru: 'Перелёты без времени на циферблат не попали. Сами виноваты.',
    },
  ],
  'clock:long-haul': [
    {
      en: 'Long-haul: {percent}%. Time zones are a lifestyle now.',
      ru: 'Дальнемагистральных — {percent}%. Часовые пояса стали образом жизни.',
    },
    {
      en: '{percent}% long-haul. Cruising altitude is practically a second address.',
      ru: '{percent}% — дальние рейсы. Крейсерская высота — второй адрес.',
    },
    {
      en: '{percent}% of flights are long-haul. You and the seat have history.',
      ru: 'Дальние рейсы — {percent}%. С креслом у вас общая история.',
    },
  ],
  'clock:after-noon': [
    {
      en: 'After noon: {percent}% of {timed} departures. Mornings are not negotiable.',
      ru: 'После полудня — {percent}% из {timed}. Утро не обсуждается.',
    },
    {
      en: '{percent}% of {timed} leave after noon. Early flights happen to other people.',
      ru: '{percent}% из {timed} — после полудня. Ранние рейсы — это для других.',
    },
    {
      en: "After noon: {percent}% of {timed}. Dawn departures are someone else's problem.",
      ru: 'После полудня: {percent}% из {timed}. Рассветные рейсы — чужая проблема.',
    },
  ],
  'clock:short-haul': [
    {
      en: '{percent}% short-haul. The seat-back pocket stays unexplored.',
      ru: 'Ближнемагистральных — {percent}%. Карман кресла так и не изучен до конца.',
    },
    {
      en: 'Short-haul: {percent}%. The drinks trolley rarely finishes the aisle.',
      ru: 'Ближние рейсы — {percent}%. Тележка с напитками не успевает доехать до конца салона.',
    },
    {
      en: 'Short hops: {percent}%. Ambition, measured in kilometres.',
      ru: 'Короткие перелёты — {percent}%. Амбиции в пределах региона.',
    },
  ],
  'clock:arrival-peak': [
    {
      en: 'Arrivals peak around {hour}. Punctual, at least as a habit.',
      ru: 'Пик прилётов — около {hour}. Пунктуальность на уровне привычки.',
    },
    {
      en: 'Arrival peak: around {hour}. The arrivals board could set its watch by you.',
      ru: 'Пик прилётов — около {hour}. По вам можно сверять табло.',
    },
    {
      en: 'Around {hour}: more arrivals than any other hour. Predictable; noted.',
      ru: 'Около {hour} — больше всего прилётов. Предсказуемо; принято к сведению.',
    },
  ],
  'clock:average-speed': [
    {
      en: 'Average speed: {speed} km/h. The baggage belt is considerably slower.',
      ru: 'Средняя скорость — {speed} км/ч. Багажная лента двигается заметно медленнее.',
    },
    {
      en: '{speed} km/h on average. Connections still feel tight.',
      ru: 'В среднем {speed} км/ч. На пересадку всё равно впритык.',
    },
    {
      en: '{speed} km/h, measured in a straight line. The aircraft did not fly one.',
      ru: 'Средняя скорость по прямой — {speed} км/ч. Самолёт летел не совсем по прямой.',
    },
  ],
  'rhythm:every-july': [
    {
      en: 'Flights every July from {from} through {to} in this view: {years} years. The calendar has a standing appointment.',
      ru: 'Каждый июль {from}–{to} — с перелётами. Лет подряд: {years}.',
    },
    {
      en: 'Each July in the scoped {from}–{to} span has flights: {years} years. Recurrence documented.',
      ru: '{from}–{to}: перелёты в каждом июле, лет: {years}. Традиция.',
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
  'rhythm:july-and-august-empty': [
    {
      en: 'No July or August flights, {from}–{to}. Peak fares, declined.',
      ru: '{from}–{to}: в июле и августе ни одного вылета. От пиковых тарифов отказались.',
    },
    {
      en: 'July and August stay empty, {from}–{to}. Almost on principle.',
      ru: 'Июль и август пусты: {from}–{to}. Почти из принципа.',
    },
    {
      en: '{from}–{to}: nothing in July or August. The crowds went without you.',
      ru: '{from}–{to}: июль и август пусты. Толпы обошлись без вас.',
    },
  ],
  'rhythm:archive-depth': [
    {
      en: 'Records go back to {year}. The archive has depth.',
      ru: 'Самая ранняя запись — {year}. У архива есть глубина.',
    },
    {
      en: 'Oldest entry: {year}. It has outlived several phones.',
      ru: 'Старейшая запись — {year}. Пережила несколько телефонов.',
    },
    {
      en: 'Paperwork reaches back to {year}. Memory rarely does.',
      ru: 'Документы восходят к {year}. Память обычно короче.',
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
  'rankings:new-airline-leader': [
    {
      en: '{year} has a different favourite airline. Loyalty is negotiable.',
      ru: '{year}: лидирует другая авиакомпания. Лояльность обсуждается.',
    },
    {
      en: 'The airline table reshuffled in {year}. Nobody was notified.',
      ru: '{year}: таблица авиакомпаний перетасована. Уведомлений не рассылалось.',
    },
    {
      en: '{year} crowned a new airline. The old one has not commented.',
      ru: '{year}: у авиакомпаний новый лидер. Прежний воздерживается от комментариев.',
    },
  ],
  'rankings:two-airline-split': [
    {
      en: 'Two airlines carry {percent}% of flights. A duopoly of your own making.',
      ru: 'Две авиакомпании — {percent}% перелётов. Дуополия собственного производства.',
    },
    {
      en: '{percent}% split between two airlines. The rest are occasional guests.',
      ru: '{percent}% поделили две авиакомпании. Остальные — эпизодически.',
    },
    {
      en: 'Two carriers, {percent}% of flights. Everyone else is a substitute.',
      ru: 'На двух перевозчиков приходится {percent}%. Прочие — на замене.',
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
  // Hero card: the footer reads the winning `hero` trigger; a record's takeover rotates through its own triple.
  'hero:flights': [
    {
      en: '{flights} flights. The spike has stopped taking new stubs gracefully.',
      ru: 'Перелётов: {flights}. Новые корешки штырь принимает уже без энтузиазма.',
    },
    {
      en: '{flights} boarding passes, and every one of them asked for ID.',
      ru: 'Посадочных: {flights}. Документы проверили при каждом.',
    },
    {
      en: '{flights} flights. That is a lot of safety demonstrations sat through.',
      ru: 'Перелётов: {flights}. Инструктаж по безопасности прослушан столько же раз.',
    },
  ],
  'hero:km-belt': [
    {
      en: 'A car would be due a new timing belt by now.',
      ru: 'Автомобилю с таким пробегом уже меняли бы ремень ГРМ.',
    },
    {
      en: 'On the road, this mileage would have outlived the warranty.',
      ru: 'На дороге с таким пробегом гарантия давно бы закончилась.',
    },
    {
      en: 'A car with this mileage would be advertised as one careful owner.',
      ru: 'Машину с таким пробегом продавали бы с пометкой «один владелец».',
    },
  ],
  'hero:km-equators': [
    {
      en: 'Equators, laid end to end: {laps}. The equator was not consulted.',
      ru: 'Экваторов в пересчёте: {laps}. Мнение экватора не запрашивалось.',
    },
    {
      en: 'Equators as the crow flies: {laps}. The real path was longer and less tidy.',
      ru: 'Экваторов по прямой: {laps}. Реальный путь длиннее и запутаннее.',
    },
    {
      en: 'Equators on the counter: {laps}. The drums kept up without complaint.',
      ru: 'Экваторов на счётчике: {laps}. Барабаны справились, замечаний нет.',
    },
  ],
  'hero:air-days': [
    {
      en: '{days} days aloft, and not one of them had a proper night.',
      ru: 'В воздухе — {days} сут. Ни одной полноценной ночи.',
    },
    {
      en: '{days} days in the air. Spent mostly with the shade half down.',
      ru: 'В воздухе — {days} сут. Преимущественно при полуопущенной шторке.',
    },
    {
      en: '{days} days aloft. Time well spent, by airline standards.',
      ru: 'В воздухе — {days} сут. По меркам авиакомпании время проведено с пользой.',
    },
  ],
  'hero:countries': [
    {
      en: 'Countries and territories: {countries}. The suitcase ran out of sticker room long ago.',
      ru: 'Стран и территорий: {countries}. Место для наклеек на чемодане закончилось давно.',
    },
    {
      en: 'Countries and territories: {countries}. Each with its own idea of a queue.',
      ru: 'Стран и территорий: {countries}. И в каждой свои представления об очереди.',
    },
    {
      en: 'Countries and territories: {countries}. The suitcase shows only the highlights.',
      ru: 'Стран и территорий: {countries}. На чемодане — только избранное.',
    },
  ],
  'hero:airports': [
    {
      en: 'Airports: {airports}. Each carousel had a bag that looked like yours.',
      ru: 'Аэропортов: {airports}. И на каждой ленте был чемодан, похожий на ваш.',
    },
    {
      en: 'Airports: {airports}. In every one, your gate was the furthest.',
      ru: 'Аэропортов: {airports}. И везде ваш выход оказывался самым дальним.',
    },
    {
      en: 'Airports: {airports}. Your belt has come off at security in all of them.',
      ru: 'Аэропортов: {airports}. И в каждом вы снимали ремень на досмотре.',
    },
  ],
  'heroSmall:flights': [
    {
      en: 'Flights: {flights}. The spike is still mostly spike.',
      ru: 'Перелётов: {flights}. Штырь пока в основном штырь.',
    },
    {
      en: 'Flights: {flights}. A short stack, filed neatly.',
      ru: 'Перелётов: {flights}. Стопка невысокая, подшита аккуратно.',
    },
    {
      en: 'Flights: {flights}. Not many, but every stub is accounted for.',
      ru: 'Перелётов: {flights}. Немного, но каждый корешок на учёте.',
    },
  ],
  'heroSmall:km': [
    {
      en: '{pct}% of one equator. The drums have barely warmed up.',
      ru: '{pct}% экватора. Барабаны счётчика только прогреваются.',
    },
    {
      en: '{pct}% of an equator. A modest reading for an instrument this size.',
      ru: '{pct}% экватора. Скромные показания для прибора такого размера.',
    },
    {
      en: '{pct}% of an equator. Short enough to remember every leg.',
      ru: '{pct}% экватора. Каждый отрезок пути пока можно помнить наизусть.',
    },
  ],
  'heroSmall:air': [
    {
      en: '{hours} h in the air. The window shade has hardly been touched.',
      ru: 'В воздухе — {hours} ч. Шторку почти не трогали.',
    },
    {
      en: '{hours} h aloft. The seat has not formed an opinion yet.',
      ru: 'В воздухе — {hours} ч. Кресло пока не составило мнения.',
    },
    {
      en: '{hours} h in the air. Not quite enough for a film festival.',
      ru: 'В воздухе — {hours} ч. На кинофестиваль пока не набирается.',
    },
  ],
  'heroSmall:countries': [
    {
      en: 'Countries and territories: {countries}. Plenty of sticker room left.',
      ru: 'Стран и территорий: {countries}. Место для наклеек ещё есть.',
    },
    {
      en: 'Countries and territories: {countries}. Border guards are yet to recognise you.',
      ru: 'Стран и территорий: {countries}. Пограничники вас пока не узнают.',
    },
    {
      en: 'Countries and territories: {countries}. A shortlist, not yet a collection.',
      ru: 'Стран и территорий: {countries}. Пока список, а не коллекция.',
    },
  ],
  'heroSmall:airports': [
    {
      en: 'Airports: {airports}. Few enough to remember where the toilets are.',
      ru: 'Аэропортов: {airports}. Пока можно помнить, где в каждом туалет.',
    },
    {
      en: 'Airports: {airports}. Not yet enough to get lost in.',
      ru: 'Аэропортов: {airports}. Заблудиться пока негде.',
    },
    {
      en: 'Airports: {airports}. The same bag keeps coming out on the belt.',
      ru: 'Аэропортов: {airports}. Лента выдаёт всё тот же чемодан.',
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
  'globe:few-countries': [
    {
      en: 'Countries and territories: {countries}. A compact itinerary.',
      ru: 'Стран и территорий: {countries}. Маршрут компактный.',
    },
    {
      en: 'Countries and territories: {countries}. The rest of the world is on standby.',
      ru: 'Стран и территорий: {countries}. Остальной мир в режиме ожидания.',
    },
    {
      en: 'Countries and territories so far: {countries}. Plenty left to colour in.',
      ru: 'Стран и территорий пока: {countries}. Раскрашивать есть что.',
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
