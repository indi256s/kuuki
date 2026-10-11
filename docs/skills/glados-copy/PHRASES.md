# Phrase bank

Ready lines and register samples for [SKILL.md](SKILL.md). Every line is plural-safe under its stated condition, and RU names sit in the nominative. Reuse a line as is, or write a new one in the same register; a joke used here is taken, so the next line needs a different angle.

Narrator triggers list their condition and params, then three interchangeable variants as `EN` / `RU` pairs. A trigger id here is a suggestion; `triggers.ts` owns the real ids.

## Narrator: first run and zero

### `firstRun` — no flights, no filter

- A perfectly good globe, completely unvisited. / Глобус в наличии. Перелётов не обнаружено.
- Nothing flown, nothing logged. The globe is very clean. / Журнал заведён. Записей пока нет.
- No flights yet. The statistics department is standing by. / Статистический отдел на месте и ожидает первых данных.

### `zero` — filters leave no flights

- No flights match. Either the filter is very specific, or that trip never happened. / По заданным условиям перелётов не найдено. Условия, надо признать, строгие.
- These filters cancel each other out. Remarkably thorough. / Фильтры взаимно исключили друг друга. Работа проделана тщательно.
- Nothing here. Not even a layover. / Здесь пусто. Даже пересадки нет.

## Narrator: below the section minimum

Params `{have}`, `{need}`. Minimums: Records ≥ 3 flights, Routes ≥ 5 flights, Crossings ≥ 3 with both time zones, Aircraft ≥ 5 typed, Clock ≥ 5 with a departure time, Rhythm ≥ 2 months. Locked cards now sit in the Next up band, whose rows stay factual, and `triggers.ts` has no `below:` slot yet; these lines are ready for when one exists.

### `below:routes`

- Routes need {need} flights to find a pattern. So far: {have}. / Для маршрутов нужно перелётов: {need}. Пока: {have}.
- {have} of {need}. Too few lines to call it a network. / {have} из {need}. Для маршрутной сети линий маловато.
- Patterns need repeats. {have} of {need} flights so far. / Закономерности нужны повторы. Перелётов: {have} из {need}.

### `below:records`

- Records need {need} flights. You have {have}. The trophy cabinet is ready; the trophies are not. / Для рекордов нужно перелётов: {need}. В наличии: {have}. Шкаф для наград пока пустует.
- {have} of {need}. Breaking records requires setting them first. / {have} из {need}. Чтобы бить рекорды, их сначала нужно установить.
- Too early to call anything a record: {have} of {need}. / Объявлять рекорды рано: {have} из {need}.

### `below:crossings`

- Crossings need {need} flights with known time zones. You have {have}. / Для раздела нужны перелёты с известными часовыми поясами: {need}. Есть: {have}.
- {have} of {need}. Your clocks have barely noticed. / {have} из {need}. Ваши часы пока ничего не заметили.
- The jet-lag ledger opens at {need}. Current balance: {have}. / Ведомость джетлага открывается с отметки {need}. Текущий остаток: {have}.

### `below:aircraft` (Manufacturers and Fleet merged into Aircraft)

- {have} of {need} flights have a known aircraft. The manufacturers remain anonymous. / Тип самолёта известен: {have} из {need}. Производители пока сохраняют анонимность.
- Airbus or Boeing? Insufficient evidence: {have} of {need}. / Airbus или Boeing? Доказательств недостаточно: {have} из {need}.
- The chart needs {need} typed flights and has {have}. It refuses to guess. / Для диаграммы нужно перелётов с типом: {need}. Есть: {have}. Гадать диаграмма отказывается.
- {have} of {need} flights with a known aircraft. The hangar echoes. / Тип самолёта известен: {have} из {need}. В ангаре гулко.
- Fleet stats open at {need} typed flights. Currently: {have}. / Статистика парка открывается от {need}. Сейчас: {have}. Ожидаем.
- A fleet, technically. {have} of {need} needed to say anything about it. / Формально это уже парк. Но для выводов нужно {need}, а есть {have}.

### `below:clock`

- The clock needs {need} departure times. It has {have} and no opinions yet. / Для раздела нужно рейсов со временем вылета: {need}. Известно: {have}. Выводы делать рано.
- {have} of {need} departure times known. The rest apparently left whenever. / Время вылета известно: {have} из {need}. Остальные, видимо, улетели когда-нибудь.
- Add departure times and the clock will judge your mornings. {have} of {need}. / Добавьте время вылета, и часы оценят ваши утренние рейсы. Пока {have} из {need}.

### `below:rhythm`

- Rhythm needs {need} months of flying. So far: {have}. Hard to call it a habit. / Для ритма нужно месяцев с перелётами: {need}. Пока: {have}. Привычкой это не назовёшь.
- {have} of {need}. That is an event, not a pattern. / {have} из {need}. Это пока событие, а не закономерность.
- A pattern takes {need} months. You have supplied {have}. / Закономерность требует месяцев: {need}. Предоставлено: {have}.

## Narrator: partial coverage

Aircraft and Clock open on a sample and print "Based on N of M". In prod most journals are imports with aircraft on about half the flights and some with none, so these fire often. They sit beside the sample caption and never restate it as the whole.

### Aircraft on a sample — typed below half of all flights; no params (the caption prints "Based on N of M").

- The fleet below is a sample. The rest flew on something, presumably. / Ниже — выборка. Остальные, предположительно, тоже летели на чём-то.
- Most of the aircraft never introduced themselves. Rude. / Большинство самолётов не представились. Невежливо.
- Blank fields stay blank. Nobody here is guessing. / Пустые графы остаются пустыми. Гадать здесь не принято.

### Clock on a sample — timed below half of all flights; no params.

- The clock counts only flights that admit when they left. / Часы учитывают только рейсы с признанным временем вылета.
- Most departures kept their time to themselves. The clock copes. / Большинство вылетов время не указали. Часы справляются.
- Untimed flights stay off the dial. Their loss. / Перелёты без времени на циферблат не попали. Сами виноваты.

### Full aircraft coverage — typed equals total, total ≥ 5; no params.

- Every flight has its aircraft. Suspiciously thorough. / Тип указан для всех перелётов. Подозрительно тщательно.
- No blank aircraft fields. Someone enjoys paperwork. / Пустых граф нет. Кто-то любит заполнять бланки.
- Aircraft known for every flight. The report has no complaints. / Тип известен для каждого перелёта. Претензий к отчёту нет.

## Narrator: sections

### Records

**Longest flight** — longest ≥ 8 h; `{hours}`, `{city}` (destination).

- {hours} hours to {city}, by choice. Noted. / {city}: {hours} ч в одном кресле. Добровольно. Принято к сведению.
- {city}: {hours} hours in one seat. Voluntarily. / Самый долгий перелёт — {city}, {hours} ч. Кресло это запомнило.
- {city}, {hours} hours away. The seat remembers every one of them. / {city}: {hours} ч в пути. Решение принято вами лично.

**Short hop** — shortest < 300 km; `{km}`.

- Shortest flight: {km} km. The drinks cart barely left the galley. / Самый короткий перелёт — {km} км. Тележка с напитками не успела выехать.
- {km} km by air. Some would have taken the train. / {km} км по воздуху. Кто-то поехал бы поездом.
- A {km} km flight: takeoff, one look out of the window, landing. / {km} км: взлёт, один взгляд в окно, посадка.

**Earliest departure** — earliest before 06:00; `{time}` (string).

- Earliest departure: {time}. Nobody asked how you felt about it. / Самый ранний вылет — {time}. Ваше мнение никто не спрашивал.
- A {time} departure, booked on purpose. Noted. / Рейс в {time} выбран сознательно. Зафиксировано.
- {time}. Technically still last night. / Вылет в {time}. Формально это ещё вчерашняя ночь.

**Furthest north** — latitude ≥ 60°; `{city}`, `{lat}`.

- {city}, {lat}° north. A coat was hopefully involved. / {city}, {lat}° с. ш. Шапка, предположительно, была взята.
- Furthest north: {city}, {lat}°. The sun keeps odd hours there. / Самая северная точка — {city}, {lat}° с. ш. Солнце там работает по особому графику.
- {city}, {lat}° north. Any further and the map starts to stretch. / {city}: {lat}° с. ш. Дальше карта начинает растягиваться.

**Furthest south** — southernmost latitude ≤ −30°; `{code}`, `{lat}` (absolute value).

- Furthest south: {code}, {lat}° S. The sun sits in the north there. / Самая южная точка — {code}, {lat}° ю. ш. Солнце там светит с севера.
- {code}, {lat}° south. Most maps don't bother to centre here. / {code}: {lat}° ю. ш. Большинство карт сюда не заглядывает.
- {code} at {lat}° south. The seasons run backwards there, on principle. / {code}, {lat}° ю. ш. Времена года там идут наоборот — принципиально.

**Shortest by time** — shortestDuration < 60 min; `{minutes}`.

- Shortest flight: {minutes} min. The gear barely had time to retract. / Самый короткий — {minutes} мин. Шасси можно было не убирать.
- {minutes} min in the air. The seatbelt sign barely went off. / {minutes} мин в воздухе. Табло «Пристегните ремни» почти не гасло.
- {minutes} min aloft. Climb, level off, descend. / Всего {minutes} мин: набор высоты, снижение, посадка.

**Biggest clock jump** — |biggestClockJump| ≥ 5 h; `{hours}` (abs minutes ÷ 60, one decimal).

- One flight moved the clock {hours} h. The body filed an appeal. / Один перелёт сдвинул часы на {hours} ч. Организм подал апелляцию.
- Biggest clock jump: {hours} h in one flight. The watch adjusted; sleep did not. / Сдвиг на {hours} ч за один перелёт. Часы перестроились, сон — нет.
- {hours} h in one go. Local time won on points. / {hours} ч за один рейс. Местное время победило по очкам.

**Latest departure** — latestDeparture at or after 22:00; `{time}` (string).

- Latest departure: {time}. Sensible people were asleep. / Самый поздний вылет — {time}. Здравомыслящие люди в это время спят.
- Departure at {time}. The day went into unpaid overtime. / Вылет в {time}. День ушёл в неоплачиваемую переработку.
- A {time} departure. Bedtime was negotiable. / Вылет в {time}. Отбой перенесён.

**Longest ground stop** — longestGroundStopDays ≥ 180; `{days}`. Held: it overlaps `rhythm:gap`, so wire one of the two.

- Longest stretch on the ground: {days} days. Gravity won that round. / Дольше всего на земле — дней: {days}. Этот раунд за гравитацией.
- At most {days} days between flights. The airline emails kept coming. / Максимальный перерыв между перелётами — дней: {days}. Рассылки авиакомпаний не прекращались.
- Longest gap between flights: {days} days. The boarding-pass app sulked. / Самый долгий перерыв без полётов — дней: {days}. Приложение с посадочными обиделось.

### Crossings

**Date line never crossed** — (pinned: "Never crossed the date line…").

- Never crossed the date line. Every day of your life has happened exactly once. / Линию перемены дат вы не пересекали. Каждый день вашей жизни прошёл ровно один раз.
- The date line remains theoretical. / Линия перемены дат остаётся для вас теорией.
- No date line yet. Tomorrow still arrives on schedule. / Линия перемены дат не пересечена. Завтра наступает строго по графику.

**Date line crossed** — at least one crossing.

- You have crossed the date line. Somewhere there is a day you never had. / Линия перемены дат пересечена. Где-то остался день, которого у вас не было.
- Date line: crossed. Your calendar has filed a complaint. / Линия перемены дат: пересечена. Календарь подал жалобу.
- The date line has been crossed. The calendar is still reconciling. / Линия перемены дат пройдена. Календарь до сих пор сверяет показания.

**Clock shift** — `{fwd}`, `{back}` hours, both ≥ 1.

- Clocks moved {fwd} h forward and {back} h back. Your body has stopped asking. / Часы переведены вперёд на {fwd} ч и назад на {back} ч. Организм перестал задавать вопросы.
- {fwd} h forward, {back} h back. Net result: tired. / Вперёд — {fwd} ч, назад — {back} ч. Итог: усталость.
- {fwd} h gained, {back} h returned. Time is not on anyone's side here. / Получено {fwd} ч, возвращено {back} ч. Время здесь ни на чьей стороне.

**Mostly east** — forward hours > 2 × back hours; `{fwd}`.

- Mostly east: {fwd} h forward. Mornings keep arriving early. / В основном на восток: вперёд на {fwd} ч. Утро наступает раньше, чем хотелось бы.
- East, mostly. {fwd} h of mornings taken without asking. / Преимущественно восток. Изъято {fwd} ч утреннего сна.
- {fwd} h forward. The east has been charging you in sleep. / {fwd} ч вперёд. Восток берёт оплату сном.

**Equator never crossed** — every flight in one hemisphere (which one is unknown to the line).

- Never crossed the equator. The other hemisphere is taking it personally. / Экватор вы не пересекали. Другое полушарие принимает это на свой счёт.
- The equator remains uncrossed. Summer still happens in summer. / Экватор не пересечён. Лето по-прежнему наступает летом.
- One hemisphere, fully committed. The other one is still there. / Одно полушарие, полная преданность. Второе по-прежнему на месте.

**Equator crossed** — at least one crossing.

- Equator crossed. The water in the sink was not consulted. / Экватор пересечён. Мнение воды в раковине не учитывалось.
- Both hemispheres visited. The seasons have stopped making sense. / Оба полушария посещены. Времена года утратили логику.
- The equator has been crossed. No ceremony was held, presumably. / Экватор пересечён. Церемонии, по-видимому, не проводилось.

**Mostly backwards** — back hours > 2 × forward hours; `{back}`. Clock shifts do not establish geographic direction, especially across the date line.

- The clock returned {back} h. The days keep running long. / Часы вернули {back} ч. Дни получаются длиннее.
- Clock refunds: {back} h. Non-transferable. / Часы вернули {back} ч. Без права передачи.
- {back} h back. The clock gives refunds. / {back} ч назад. Часы возвращают сдачу.

**Arctic Circle crossed** — arcticCircle ≥ 1; `{count}`.

- Arctic Circle crossings: {count}. The penguins are at the other end. / Пересечений Полярного круга: {count}. Пингвины, напомним, на другом конце.
- Times past the Arctic Circle: {count}. Polar bears were not informed. / Полярный круг, пересечений: {count}. Белых медведей не уведомляли.
- Arctic Circle: {count}. The line is invisible from above. / Полярный круг, пересечений: {count}. С высоты линия не видна.

### Aircraft: makers

**Leader** — leader ≥ 2 flights ahead; `{leader}`, `{runnerUp}`, `{n}` (pinned: "Airbus has carried you 38 times. Boeing is still auditioning.").

- {leader} has carried you {n} times. {runnerUp} is still auditioning. / Перелётов на {leader}: {n}. {runnerUp} всё ещё проходит прослушивание.
- {leader} leads with {n} flights. {runnerUp} has been informed. / Лидирует {leader}: {n}. {runnerUp} уведомлён.
- {leader}: {n} flights. {runnerUp} suspects the airlines had a say. / На {leader} — перелётов: {n}. {runnerUp} подозревает, что всё решили авиакомпании.

**Near tie** — leaders within 10%; `{leader}`, `{a}`, `{runnerUp}`, `{b}`.

- {leader} {a}, {runnerUp} {b}. A rivalry settled by timetables, not by you. / {leader} — {a}, {runnerUp} — {b}. Соперничество решает расписание, а не вы.
- {leader} {a}, {runnerUp} {b}. A photo finish nobody is watching. / {leader} — {a}, {runnerUp} — {b}. Фотофиниш, за которым никто не следит.
- {leader} and {runnerUp}, neck and neck: {a} to {b}. Neither has noticed. / {leader} и {runnerUp} идут вровень: {a} против {b}. Стороны об этом не знают.

**Single maker** — one maker only; `{maker}`.

- Only {maker}. Commendable consistency, or no choice at all. / Только {maker}. Похвальная последовательность или отсутствие выбора.
- {maker}, every time. The other manufacturers exist, reportedly. / Каждый раз {maker}. Другие производители, по имеющимся данным, существуют.
- One manufacturer, total loyalty. {maker} has not sent a thank-you card. / Один производитель, полная лояльность. Благодарственного письма от {maker} не поступало.

**Many unknown** — unknown ≥ 2; `{unknown}`.

- {unknown} flights on an unknown aircraft. Could have been anything with wings. / Тип не указан: {unknown}. Это могло быть что угодно с крыльями.
- Unknown aircraft: {unknown}. The waffle has holes. / Неизвестных бортов: {unknown}. В диаграмме пробелы.
- {unknown} flights by person or persons unknown. / Перелётов на неустановленных судах: {unknown}.

### Aircraft: fleet

**Mostly narrowbody** — narrowbody ≥ 70%; no params (pinned: "Mostly narrowbodies…").

- Mostly narrowbodies. One aisle, many elbows. / В основном узкофюзеляжные. Один проход, много локтей.
- Mostly narrowbodies. The widebodies remain a rumour. / Преимущественно узкофюзеляжные. Широкофюзеляжные пока остаются слухом.
- Single-aisle, mostly. Efficient, if intimate. / Главным образом однопроходные. Эффективно, хотя и тесно.

**Mostly widebody** — widebody ≥ 50%; no params.

- Mostly widebodies. Two aisles, and you've grown used to it. / В основном широкофюзеляжные. Два прохода — вы привыкли к хорошему.
- Mostly widebodies. Narrowbodies probably feel cramped now. / Преимущественно широкофюзеляжные. Узкие теперь, надо полагать, кажутся тесными.
- Two aisles, mostly. Long haul is the default setting. / Главным образом двухпроходные. Дальние рейсы — настройка по умолчанию.

**Endangered type** — an A380 or 747 is in scope; `{type}`.

- A {type} in the log. They don't make them like that anymore. Literally. / В журнале есть {type}. Таких больше не производят. В прямом смысле.
- {type}, logged. A collector's item, flown. / {type}: зафиксирован. Коллекционный экземпляр, использован по назначению.
- You flew a {type}. Future you will be smug about this. / Вы летали на {type}. Позже это станет поводом для гордости.

**Favourite type** — top type ≥ 5 flights; `{type}`, `{n}`.

- {type}, {n} times. It probably recognises you. / Чаще всего — {type}: {n}. Вероятно, он вас уже узнаёт.
- Top type: {type}, {n} flights. You know where the bins are. / Основной тип — {type}: {n}. Где багажные полки, вы знаете.
- {type}: {n}. At this point it's a commute. / {type}: {n}. Это уже не перелёт, а маршрут до работы.

**Many types** — ≥ 10 types; `{types}`.

- {types} aircraft types. A collector, whether you meant to be or not. / Типов воздушных судов: {types}. Коллекция собралась сама.
- {types} different types. Spotters would be impressed; the airlines weren't asked. / Разных типов: {types}. Споттеры бы оценили.
- Types flown: {types}. Variety, mostly at the gate's discretion. / Освоено типов: {types}. Разнообразие обеспечено расписанием.

**Family majority** — topFamily ≥ 50% of flights with a known type; `{family}`, `{percent}`. In prod the A320 family is over half of all typed flights. `fleet:family-majority` ranks above `fleet:top-family`, which retains its broader fallback.

- {family}: {percent}% of known-type flights. Other aircraft do exist. / {family}: {percent}% рейсов с типом. Другие самолёты тоже существуют.
- {family}: {percent}% of known-type flights. You could find the lavatory blindfolded. / {family} — {percent}% рейсов с типом. Туалет вы найдёте с закрытыми глазами.
- {family} on {percent}% of known-type flights. Practically a company car. / На {family} — {percent}% рейсов с типом. Практически служебный транспорт.

**Few types** — types ≤ 2 with typed ≥ 5; `{types}`, `{typed}`.

- Aircraft types: {types}, across {typed} flights. A compact fleet. / Типов: {types}, перелётов с типом: {typed}. Парк компактный.
- Types: {types} over {typed} flights. It all fits on a sticky note. / Типов: {types}, перелётов с типом: {typed}. Умещается на стикере.
- {typed} typed flights, types: {types}. Brand loyalty, or a lack of options. / Перелётов с типом: {typed}, типов: {types}. Лояльность или отсутствие выбора.

**Widebody minority** — widebody ≥ 1 and below 20% of typed; `{wide}`, `{typed}`.

- Widebodies: {wide} of {typed}. Two aisles remain a special occasion. / Широкофюзеляжные: {wide} из {typed}. Два прохода — по особым случаям.
- {wide} of {typed} known-type flights had two aisles. A rare upgrade in floor space. / Два прохода: {wide} из {typed}. Дополнительное пространство — редкость.
- Two aisles on {wide} of {typed}. Luxury has a small market share. / Широких бортов — {wide} из {typed}. У простора скромная доля рынка.

### Clock

**Peak hour** — `{hour}` (string) (pinned: "More trips start at 7 a.m. than at any other hour…").

- More trips start at {hour} than at any other hour. The alarm clock has views. / Самый частый час вылета — {hour}. Будильник выражает обеспокоенность.
- Favourite departure time: {hour}. Not chosen, just tolerated. / Чаще всего вылет в {hour}. Не выбор, а смирение.
- {hour} is your hour. The airport café knows your order. / Основное время вылета — {hour}. Кафе в аэропорту знает ваш заказ.

**Red-eyes** — red-eyes ≥ 2; `{n}`.

- {n} red-eyes. Sleep was offered and declined. / Ночных рейсов: {n}. От сна вы отказались добровольно.
- Red-eyes: {n}. The night shift, but you paid for it. / Ночных рейсов: {n}. Ночная смена, только за ваш счёт.
- {n} overnight flights. The neck pillow has earned a pension. / Ночных перелётов: {n}. Подушка для шеи заслужила пенсию.

**Morning share** — ≥ 50% before `{cutoff}`; `{share}`, `{cutoff}` (string).

- {share}% of departures before {cutoff}. A morning person, or a cheap-fare person. / До {cutoff} — {share}% вылетов. Жаворонок или любитель дешёвых тарифов.
- Before {cutoff}: {share}%. Sunrise is mostly seen from the terminal. / До {cutoff}: {share}%. Рассвет вы обычно встречаете в терминале.
- {share}% before {cutoff}. The day starts at the gate. / {share}% вылетов до {cutoff}. День начинается у выхода на посадку.

**Late arrivals** — most arrivals after `{hour}`; `{hour}` (string).

- Most arrivals land after {hour}. Hotels love a late check-in. / Большинство прилётов — после {hour}. Отели обожают поздний заезд.
- Landing after {hour} is the norm. Taxis at that hour cost what they cost. / Прилёт после {hour} — норма. Такси в это время стоит сколько стоит.
- Most landings after {hour}. Dinner is a sandwich from the gate. / Посадка обычно после {hour}. Ужин — бутерброд у выхода.

**After-noon majority** — beforeNoonShare < 0.35; `{percent}` (after-noon share, whole number), `{timed}`.

- After noon: {percent}% of {timed} departures. Mornings are not negotiable. / После полудня — {percent}% из {timed}. Утро не обсуждается.
- {percent}% of {timed} leave after noon. Early flights happen to other people. / {percent}% из {timed} — после полудня. Ранние рейсы — это для других.
- After noon: {percent}% of {timed}. Dawn departures are someone else's problem. / После полудня: {percent}% из {timed}. Рассветные рейсы — чужая проблема.

**Arrival peak** — arrPeakHour strictly above every other arrival hour, withArrivalTime ≥ 5; `{hour}` (string). The busiest hour, not "most" arrivals.

- Arrivals peak around {hour}. Punctual, at least as a habit. / Пик прилётов — около {hour}. Пунктуальность на уровне привычки.
- Arrival peak: around {hour}. The arrivals board could set its watch by you. / Пик прилётов — около {hour}. По вам можно сверять табло.
- Around {hour}: more arrivals than any other hour. Predictable; noted. / Около {hour} — больше всего прилётов. Предсказуемо; принято к сведению.

**Average speed** — averageSpeedKmh not null; `{speed}`. Distance is great-circle, so the true path was longer.

- Average speed: {speed} km/h. The baggage belt is considerably slower. / Средняя скорость — {speed} км/ч. Багажная лента двигается заметно медленнее.
- {speed} km/h on average. Connections still feel tight. / В среднем {speed} км/ч. На пересадку всё равно впритык.
- {speed} km/h, measured in a straight line. The aircraft did not fly one. / Средняя скорость по прямой — {speed} км/ч. Самолёт летел не совсем по прямой.

**Mostly short-haul** — short (< 1,500 km) ≥ 60%; `{percent}`. Prod: about half of all flights are short-haul.

- {percent}% short-haul. The seat-back pocket stays unexplored. / Ближнемагистральных — {percent}%. Карман кресла так и не изучен до конца.
- Short-haul: {percent}%. The drinks trolley rarely finishes the aisle. / Ближние рейсы — {percent}%. Тележка с напитками не успевает доехать до конца салона.
- Short hops: {percent}%. Ambition, measured in kilometres. / Короткие перелёты — {percent}%. Амбиции в пределах региона.

**Long-haul share** — long (≥ 4,000 km) ≥ 25%; `{percent}`.

- Long-haul: {percent}%. Time zones are a lifestyle now. / Дальнемагистральных — {percent}%. Часовые пояса стали образом жизни.
- {percent}% long-haul. Cruising altitude is practically a second address. / {percent}% — дальние рейсы. Крейсерская высота — второй адрес.
- {percent}% of flights are long-haul. You and the seat have history. / Дальние рейсы — {percent}%. С креслом у вас общая история.

### Rhythm

**Annual habit** — the same month ≥ 3 years running; `{month}` (lowercase RU nominative), `{year}` (string) (pinned: "Every July since 2021…").

- Every {month} since {year}. Tradition, or the only free week. / Каждый {month} начиная с {year}: традиция или единственная свободная неделя.
- {month}, every year since {year}. The calendar has noticed. / С {year} — каждый {month}. Календарь это заметил.
- Since {year}, every {month} has a flight in it. Predictable, in a good way. / С {year} года каждый {month} — с перелётом. Предсказуемо, и это комплимент.

**Long gap** — gap ≥ 6 months; `{months}`.

- {months} months without flying. The suitcase had questions. / Перерыв в полётах — {months} мес. У чемодана были вопросы.
- A {months}-month pause. The passport went into hibernation. / Пауза — {months} мес. Паспорт впал в спячку.
- Longest gap: {months} months. The globe kept spinning regardless. / Самый долгий перерыв — {months} мес. Глобус всё это время вращался.

**Busy month** — busiest month ≥ 6 flights; `{monthYear}` (string), `{count}`.

- {monthYear}: {count} flights. Did you go home at all? / {monthYear}: перелётов — {count}. Дома вы, видимо, не были.
- {count} flights in {monthYear}. The boarding pass was basically ID. / {monthYear}: {count}. Посадочный талон фактически заменил паспорт.
- Busiest month: {monthYear}, {count} flights. Unpacking was optional. / Самый загруженный месяц — {monthYear}: {count}. Чемодан не распаковывался.

**Streak** — ≥ 6 consecutive months; `{months}`.

- {months} months in a row with a flight. Staying put would feel strange now. / Месяцев подряд с перелётами: {months}. Без полёта теперь было бы странно.
- A {months}-month streak. Ground time is the exception. / Серия — {months} мес. подряд. Время на земле стало исключением.
- {months} consecutive months airborne at least once. Consistency, noted. / {months} мес. подряд хотя бы один перелёт. Стабильность зафиксирована.

**July and August empty** — unfiltered journal only: no July or August flights across `{from}`–`{to}` (≥ 2 years), other months active; `{from}`, `{to}` (strings). Name the months, not the season: the southern hemisphere disagrees.

- No July or August flights, {from}–{to}. Peak fares, declined. / {from}–{to}: в июле и августе ни одного вылета. От пиковых тарифов отказались.
- July and August stay empty, {from}–{to}. Almost on principle. / Июль и август пусты: {from}–{to}. Почти из принципа.
- {from}–{to}: nothing in July or August. The crowds went without you. / {from}–{to}: июль и август пусты. Толпы обошлись без вас.

**Archive depth** — firstDate at least 3 calendar years before the latest observed scoped flight date; `{year}` (string). Exact flight dates are required; aggregate month labels do not establish the span. An old entry proves reach, not a complete record: most prod journals are imported history.

- Records go back to {year}. The archive has depth. / Самая ранняя запись — {year}. У архива есть глубина.
- Oldest entry: {year}. It has outlived several phones. / Старейшая запись — {year}. Пережила несколько телефонов.
- Paperwork reaches back to {year}. Memory rarely does. / Документы восходят к {year}. Память обычно короче.

### Routes

The Routes card is new: repeat share, commuter/explorer/mixed profile, top route, home share, new routes per year. `triggers.ts` already covers commuter, explorer, top repeat and home ≥ 50%.

**Repeat share** — repeatShare ≥ 0.6; `{percent}`. `repeatShare` counts every flight on a route flown at least twice, including its first flight, so never call them "repeats" or "flown before".

- Repeat routes: {percent}%. Novelty is rationed. / Повторяющиеся маршруты — {percent}%. Новизна выдаётся по талонам.
- {percent}% on routes flown more than once. The map draws over its own lines. / {percent}% — на маршрутах-повторах. Карта обводит собственные линии.
- Routes used more than once carry {percent}%. Familiar airports, familiar queues. / Знакомые маршруты — {percent}% перелётов. Знакомые аэропорты, знакомые очереди.

**Mixed profile** — profile `mixed`; `{flights}`, `{distinct}`.

- {flights} flights, {distinct} routes. Habit, with lapses into curiosity. / Перелётов: {flights}, маршрутов: {distinct}. Привычка с редкими приступами любопытства.
- {distinct} routes over {flights} flights. Some returns, some firsts. / Маршрутов: {distinct}, перелётов: {flights}. Повторы чередуются с новинками.
- {flights} flights on {distinct} routes. Neither a rut nor a grand tour. / Перелётов: {flights}, маршрутов: {distinct}. Ни колея, ни кругосветка.

**All new in a year** — latest byYear row with flights ≥ 2 and newRoutes = flights; `{year}` (string), `{flights}`.

- Every route in {year} was a first. {flights} flights, no reruns. / {year}: все маршруты новые. Перелётов: {flights}, повторов нет.
- {year}: {flights} flights, each on a new route. Remarkably unrepetitive. / {year}: ни одного повтора. Перелётов: {flights}.
- No route repeated in {year}. The map gained {flights} new lines. / {year} прошёл без повторов. Новых линий на карте: {flights}.

**Nothing new in a year** — latest byYear row with flights ≥ 2 and newRoutes 0; `{year}` (string), `{flights}`.

- {year}: {flights} flights, all on routes you knew. / {year}: перелётов: {flights}, все по знакомым маршрутам.
- No new routes in {year}, across {flights} flights. The old ones coped. / {year}: новых маршрутов нет, перелётов: {flights}. Старые справлялись.
- {year} repeated itself: {flights} flights, no premieres. / {year} прошёл в повторе. Перелётов: {flights}, премьер нет.

**Home on the margin** — home set, homeShare < 0.25; `{percent}`.

- Home airport: {percent}% of flights. It hears about the trips afterwards. / Домашний аэропорт — в {percent}% перелётов. О поездках он узнаёт постфактум.
- {percent}% touch the home airport. Home base, in name only. / Через домашний аэропорт — {percent}%. База — скорее номинально.
- The home airport features in {percent}% of flights. A cameo. / Домашний аэропорт: {percent}%. Эпизодическая роль.

### Rankings

Keep the leader's name and count out of the line: the leader tile already prints them.

**Home airport** — one airport in ≥ 40% of flights; `{airport}`, `{share}` (pinned: "Tbilisi is half your flights…").

- {airport} is in {share}% of your flights. Less an airport, more an address. / {airport} — в {share}% ваших перелётов. Это уже не аэропорт, а адрес.
- {share}% of flights touch {airport}. The duty-free staff are on first-name terms. / {airport}: {share}% перелётов. В дьюти-фри вас знают по имени.
- {airport}: {share}%. Every trip, roughly, begins and ends with the same coffee. / {airport} — {share}% перелётов. Почти каждая поездка начинается с одного и того же кофе.

**Loyal airline** — one airline ≥ 50%; `{airline}`, `{share}`.

- {share}% with {airline}. They should send a card. / {airline}: {share}% ваших перелётов. Открытку к празднику они вам должны.
- {airline} flies {share}% of your trips. The other airlines have stopped calling. / {airline} — {share}% перелётов. Остальные авиакомпании перестали звонить.
- {airline}, {share}%. Loyalty, or the only airline at your airport. / {airline}: {share}%. Верность или единственная авиакомпания в вашем аэропорту.

**Airline tourist** — ≥ 10 airlines, none above 20%; `{count}`.

- {count} airlines, no favourite. Loyalty programmes weep. / Авиакомпаний: {count}, любимой нет. Программы лояльности в печали.
- {count} airlines and not a single status tier. / Авиакомпаний: {count}. Статуса нет ни в одной.
- Airlines flown: {count}. You shop by price, and it shows. / Авиакомпаний: {count}. Выбор, очевидно, по цене.

**Repeat route** — top route ≥ 5 times; `{route}`, `{n}`.

- {route}, {n} times. You have a preferred seat and opinions about the meal. / {route} — перелётов: {n}. У вас наверняка есть любимое место и мнение о бортпитании.
- {route}: {n}. The crew could brief you. / {route}: {n}. Инструктаж по безопасности вы можете проводить сами.
- {n} times on {route}. A commute with a safety demonstration. / {route}: {n}. Поездка на работу, но с демонстрацией спасательного жилета.

**New airline leader** — the latest year (≥ 2 flights) has a top airline (rankByYear) different from the all-time leader; `{year}` (string). No names: the bump chart shows them.

- {year} has a different favourite airline. Loyalty is negotiable. / {year}: лидирует другая авиакомпания. Лояльность обсуждается.
- The airline table reshuffled in {year}. Nobody was notified. / {year}: таблица авиакомпаний перетасована. Уведомлений не рассылалось.
- {year} crowned a new airline. The old one has not commented. / {year}: у авиакомпаний новый лидер. Прежний воздерживается от комментариев.

**Two-airline split** — top two airlines ≥ 80% of all scoped flights, neither above 60%; `{percent}` (combined, over all flights so "of flights" stays true).

- Two airlines carry {percent}% of flights. A duopoly of your own making. / Две авиакомпании — {percent}% перелётов. Дуополия собственного производства.
- {percent}% split between two airlines. The rest are occasional guests. / {percent}% поделили две авиакомпании. Остальные — эпизодически.
- Two carriers, {percent}% of flights. Everyone else is a substitute. / На двух перевозчиков приходится {percent}%. Прочие — на замене.

### Globe

**Distance in equators** — total ≥ 1 equator; `{laps}`.

- {laps} times round the equator, mostly facing forward. / Пройдено экваторов: {laps}. В основном лицом по ходу движения.
- Equators flown: {laps}. The scenery was mostly clouds. / Экваторов по длине: {laps}. Пейзаж — в основном облака.
- {laps} equators of distance. That is a lot of recycled cabin air. / Длина пути в экваторах: {laps}. Воздух в салоне в основном вторичный.

**Under one equator** — `{pct}`.

- {pct}% of the way round the equator. The rest is mostly ocean. / Пройдено {pct}% экватора. Дальше в основном океан.
- {pct}% of an equator so far. A respectable start. / {pct}% экватора. Начало положено.
- The equator is {pct}% done. No rush. / Экватор пройден на {pct}%. Спешить некуда.

**Moon** — total distance as `{pct}` of 384,400 km.

- {pct}% of the way to the Moon. No checked bags on that route. / Пройдено {pct}% пути до Луны. Багаж на этом направлении не принимают.
- Moon progress: {pct}%. The return leg is not included. / До Луны — {pct}% пути. Обратный билет не предусмотрен.
- {pct}% of a lunar trip. Same legroom, though. / {pct}% пути до Луны. Пространство для ног, впрочем, то же.

**Countries** — `{countries}` ≥ 10.

- {countries} countries and territories. The passport no longer closes flat. / Стран и территорий: {countries}. Паспорт перестал закрываться.
- Countries and territories: {countries}. Border control knows the routine. / Стран и территорий: {countries}. На паспортном контроле вас уже не удивить.
- {countries} countries and territories. Each one had a different plug socket. / Стран и территорий: {countries}. И в каждой своя розетка.

**Domestic only** — every flight is domestic.

- Domestic only. The rest of the globe is decorative for now. / Только внутренние рейсы. Остальной глобус пока для красоты.
- No borders crossed. The passport is purely ceremonial. / Границы не пересекались. Загранпаспорт носит церемониальный характер.
- One country, thoroughly covered. The others can wait. / Одна страна, изученная досконально. Остальные подождут.

**Few countries** — 2–4 countries; `{countries}`.

- Countries and territories: {countries}. A compact itinerary. / Стран и территорий: {countries}. Маршрут компактный.
- Countries and territories: {countries}. The rest of the world is on standby. / Стран и территорий: {countries}. Остальной мир в режиме ожидания.
- Countries and territories so far: {countries}. Plenty left to colour in. / Стран и территорий пока: {countries}. Раскрашивать есть что.

## Next up band

The band holds locked cards, milestones and upcoming flights; its rows stay factual. Held: `NarratorSlot` has no band slot yet. These are candidates for one secondary line beside it, under the same one-witty-line rule. Upcoming-flight lines joke about the countdown and the timetable, never about why the trip is happening.

**Next flight today** — daysAway 0; `{destination}` (IATA code).

- {destination} today. Too late to change your mind. / Сегодня — {destination}. Передумывать поздно.
- Today: {destination}. The countdown has run out of days. / Сегодня: {destination}. Дни в отсчёте закончились.
- {destination}, today. The schedule waits for no one. / {destination}, сегодня. Расписание никого не ждёт.

**Next flight tomorrow** — daysAway 1; `{destination}`.

- {destination} tomorrow. The countdown is down to hours. / Завтра — {destination}. Обратный отсчёт перешёл на часы.
- Tomorrow: {destination}. One more night on the ground. / Завтра: {destination}. Ещё одна ночь на земле.
- {destination} tomorrow. The timetable is set; the packing, presumably, isn't. / Завтра — {destination}. Расписание утверждено, сборы — предположительно нет.

**Next flight later** — daysAway ≥ 2; `{destination}`, `{days}`.

- {destination} in {days} days. Plenty of time to overpack. / {destination} — через {days} дн. Времени собрать лишнее предостаточно.
- {days} days to {destination}. The calendar is already smug about it. / До вылета в {destination}: {days} дн. Календарь уже доволен собой.
- {destination}, {days} days out. Refreshing the booking won't speed it up. / {destination}: через {days} дн. Обновление брони процесс не ускорит.

**Flight milestone close** — have ≥ 90% of a flight rung; `{need}` (≥ 10), `{left}`.

- {left} to go until {need} flights. Practically there. / До отметки {need} осталось {left}. Почти у цели.
- {left} to go before {need}. Practically a formality. / До {need} осталось {left}. Практически формальность.
- {need} flights is {left} away. The counter is leaning forward. / До {need} осталось {left}. Счётчик в нетерпении.

**Equator close** — under 3,000 km left to the equator rung; `{left}` (km). Say "the equator's length": the rung is distance, not a place.

- {left} km short of the equator's length. One decent trip, really. / До длины экватора — {left} км. Одна приличная поездка.
- {left} km from an equator's worth of flying. The planet is unimpressed so far. / До длины экватора — {left} км. Планета пока не впечатлена.
- {left} km to the equator's length. So close it's almost awkward. / До длины экватора — {left} км. Так близко, что даже неловко.

## Empty states

Normal, then Sarcastic; each EN / RU.

**Journal empty**

- Normal: No flights yet. Add your first flight or import your history. / Перелётов пока нет. Добавьте первый или импортируйте историю.
- Sarcastic: Not a single flight. The passport is very well rested. / Ни одного перелёта. Паспорт отлично отдохнул.

**No upcoming flights**

- Normal: No upcoming flights. / Предстоящих перелётов нет.
- Sarcastic: Nothing booked. The suitcase is starting to worry. / Ничего не забронировано. Чемодан начинает волноваться.

**Search with no results** — `{query}`.

- Normal: No flights match “{query}”. / По запросу «{query}» ничего не найдено.
- Sarcastic: Nothing for “{query}”. Possibly somewhere you haven't been yet. / По запросу «{query}» пусто. Возможно, вы там ещё не были.

**No photos or notes on a flight**

- Normal: No notes for this flight. / Заметок к этому перелёту нет.
- Sarcastic: No notes. What happens at the gate stays at the gate. / Заметок нет. Что было у выхода на посадку, остаётся там.

**Leaderboard empty**

- Normal: The leaderboard is empty. / Таблица лидеров пуста.
- Sarcastic: Nobody on the leaderboard yet. First place is unattended. / В таблице лидеров никого. Первое место без присмотра.

**Public profile with no flights** (`/fly/[username]`)

- Normal: No flights to show yet. / Перелётов пока нет.
- Sarcastic: This journal is still on the ground. / Этот журнал пока на земле.

**Passport with no countries**

- Normal: No countries yet. / Стран пока нет.
- Sarcastic: No countries recorded. Geography is on hold. / Стран не зафиксировано. География отложена.

## Achievements and milestones

Normal, then Sarcastic; each EN / RU.

**First flight**

- Normal: Your first flight is in the journal. / Первый перелёт в журнале.
- Sarcastic: First flight logged. The journal was beginning to wonder. / Первый перелёт внесён. Журнал уже начинал беспокоиться.

**Flight count** — `{n}` at 10, 50, 100, 250, 500.

- Normal: Flights logged: {n}. / Перелётов в журнале: {n}.
- Sarcastic: {n} flights. The cabin crew would recognise you if they compared notes. / Перелётов: {n}. Бортпроводники узнали бы вас, если бы сверили записи.

**Countries** — `{n}` at 5, 10, 25, 50.

- Normal: Countries and territories visited: {n}. / Стран и территорий: {n}.
- Sarcastic: {n} countries and territories. The passport is filling up faster than planned. / Стран и территорий: {n}. Паспорт заполняется быстрее плана.

**Distance of the equator**

- Normal: You've flown the length of the equator. / Вы пролетели расстояние, равное длине экватора.
- Sarcastic: One equator's worth of flying. A lot of recycled cabin air. / Пролетено расстояние длиной в экватор. Воздух — в основном вторичный.

**First widebody**

- Normal: First widebody flight. / Первый перелёт на широкофюзеляжном самолёте.
- Sarcastic: First widebody. Two aisles. Try not to get used to it. / Первый широкофюзеляжный. Два прохода. Не привыкайте.

**First red-eye**

- Normal: First overnight flight. / Первый ночной рейс.
- Sarcastic: First red-eye. Sleep was scheduled, then cancelled. / Первый ночной рейс. Сон был запланирован и отменён.

**First date-line crossing**

- Normal: First date-line crossing. / Первое пересечение линии перемены дат.
- Sarcastic: Date line crossed. One day of your life is now under review. / Линия перемены дат пересечена. Один день вашей жизни направлен на проверку.

**Ultra-long-haul** — `{hours}` ≥ 12.

- Normal: First flight over {hours} hours. / Первый перелёт дольше {hours} ч.
- Sarcastic: {hours} hours in one seat. That is a commitment. / {hours} ч в одном кресле. Серьёзное решение.

**New country**

- Normal: New country: {country}. / Новая страна: {country}.
- Sarcastic: {country}, added. The map has one less blank. / {country}: добавлена. На карте одним белым пятном меньше.

**Moon distance**

- Normal: You've flown the distance to the Moon. / Пролетено расстояние до Луны.
- Sarcastic: Moon distance reached. Horizontally. / Расстояние до Луны набрано. По горизонтали.

**Moon and back**

- Normal: You've flown to the Moon and back, by distance. / Пролетено расстояние до Луны и обратно.
- Sarcastic: To the Moon and back. Sentimental, but measured. / До Луны и обратно. Сентиментально, но измерено.

**First Arctic Circle crossing**

- Normal: First Arctic Circle crossing. / Первое пересечение Северного полярного круга.
- Sarcastic: Arctic Circle crossed. No frostbite reported. / Полярный круг пересечён. Обморожений не зафиксировано.

**Every section unlocked** — the Next up band has no locked cards left.

- Normal: All sections are open. / Все разделы открыты.
- Sarcastic: Every section unlocked. Only more flights left to earn. / Все разделы открыты. Дальше — только новые перелёты.

## Profile insights

Witty line under a factual figure.

- **Average flight** (`{km}`): Not short enough for the train, not long enough for a film. / Для поезда далеко, для фильма коротко.
- **Favourite weekday** (`{weekday}`, Friday): Most flights leave on {weekday}. The weekend starts at the gate. / Самый частый день вылета — {weekday}. Выходные начинаются у выхода на посадку.
- **Total time aloft** (`{days}` ≥ 1): {days} days in the air, all of it seated. / В воздухе — {days} сут., и всё это время сидя.
- **Airports** (`{airports}` ≥ 20): Airports visited: {airports}. You have opinions about security queues. / Аэропортов: {airports}. О досмотре у вас сложилось мнение.

## Loading flavour

One line, one at a time, under a factual spinner label.

- Counting kilometres. / Считаем километры.
- Working out where you've been. / Выясняем, где вы побывали.
- Asking the globe to hold still. / Просим глобус не вертеться.
- Reconciling time zones. They disagree. / Сверяем часовые пояса. Они не согласны друг с другом.
- Measuring great circles. / Измеряем дуги большого круга.
- Sorting airlines by how often they turn up. / Сортируем авиакомпании по частоте появлений.
- Looking up aircraft types. Some are shy. / Уточняем типы самолётов. Некоторые стесняются.
- Counting time zones underneath. / Считаем часовые пояса под крылом.
- Lining up departures by the hour. / Раскладываем вылеты по часам.
- Checking which routes repeat. / Проверяем, какие маршруты повторяются.
- Folding the calendar into months. / Сворачиваем календарь в месяцы.

## Landing

- Normal: A flight journal that keeps the details. / Журнал перелётов, который помнит подробности.
- Sarcastic: Every flight you've taken, minus the security queue. / Все ваши перелёты. Без очереди на досмотр.
- Sarcastic: Remembers the gate number so you don't have to. / Помнит номер выхода, чтобы не пришлось вам.

## Sober reference

One version each; no Sarcastic variant exists for these.

- Save failed: Couldn't save the flight. Check your connection and try again. / Не удалось сохранить перелёт. Проверьте подключение и попробуйте ещё раз.
- Delete confirm: Delete this flight? It will be removed from your journal and stats. / Удалить этот перелёт? Он пропадёт из журнала и статистики.
- Import row error (`{row}`): Row {row} couldn't be read: the date is missing. / Не удалось прочитать строку {row}: нет даты.
- Validation: Enter an airport code or city. / Введите код аэропорта или город.
- Review queue empty: Nothing awaiting review. / Перелётов, ожидающих проверки, нет.
