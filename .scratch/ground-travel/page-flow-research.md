# Страницы наземных путешествий: точки интеграции

13 октября 2026. Только чтение исходников; браузер, скриншоты и проверки
нового UI не выполнялись. Это исходные варианты до последних ответов владельца;
текущий [контракт](./page-flow-contract.md) принимает одну общую страницу,
четыре направления и сортировку. Прежние /trains, /road-trips и пять вкладок
ниже сохранены как рассмотренные варианты, не требования реализации.

## Приватные страницы и прямые ссылки

Размещать будущие `/trains`, `/road-trips`, их detail/new/edit под
`apps/next/src/app/(member)/`. `layout.tsx` ждёт
`server/gates.ts:requireOnboardedMember` до вывода shell; страницы также
вызывают gate при soft navigation. Guest перенаправляется на signin,
не завершивший onboarding — на свою точку продолжения. Проверка владельца
конкретной записи должна предшествовать её чтению; общий layout этого
не заменяет. Идентичность передаётся через `client/activity.tsx:IdentitySnapshot`.

Журнал сейчас открывает detail через `/journal?flight=<id>` (также legacy
`#arrival-<id>`); review — `review=1`. Codec — `client/journal/url.ts`,
SSR initial query — `(member)/journal/page.tsx`, состояние —
`client/journal/store.tsx`. Edit имеет отдельный адрес
`(member)/journal/[id]/edit/page.tsx`, использует FlightDetailSheet.
Это существующие flight conventions, не требование query-detail для поездок.
Отдельные detail/new/edit URL технически допустимы; нужен новый контракт
ID, загрузки, отсутствующей/чужой записи и возврата на свой список.

## Back, фокус и общий shell

В Journal изменение фильтров заменяет history entry; открытие detail
создаёт entry, смена detail заменяет его; закрытие идёт Back только для
своего entry, иначе replace. Прямой deep link не должен уводить назад
на случайный внешний сайт. Для самостоятельных страниц такой же fallback
на список следует задать отдельно с сохранением фильтров.
`client/route-focus.tsx` фокусирует `main h1` при изменении pathname;
query detail/filters фокус не перемещают. На new/detail/edit нужны heading
и согласованный возврат фокуса; Sheet отвечает за modal-фокус самостоятельно.

`client/nav.tsx`: desktop NAV_ITEMS и mobile TABS сейчас имеют Overview,
Journal, Passport; mobile Plus открывает shared Menu/AddActions.
MobilePageTitle имеет отдельный список названий. Пять предложенных вкладок
Overview/Journal/Trains/Auto/Passport требуют изменения всех этих мест,
`client/shell.tsx`, `app/shell.css` и соответствующего текста DESIGN.md.
Сейчас DESIGN.md описывает три направления и Plus; решения о пяти ещё нет.
`client/route-transition-pairs.ts:TAB_ROUTES` тоже содержит явный список
маршрутов; новые пути сейчас переключались бы без разрешённой tab-анимации.
Это не блокер маршрутизации: расширять motion только после согласования.

## Незаконченный ввод и общие контролы

`client/capture/flight-form.tsx` восстанавливает unfinished input только
для новой записи, подписывается на изменения формы, сохраняет через
`client/capture/capture-preferences.ts` в `kuuki:capture:<ownerId>:<key>`.
Чтение валидирует известные поля; ошибка storage не становится успехом.
`client/activity.tsx` при смене identity очищает preferences/import drafts,
прерывает запросы и делает document navigation для сброса Next cache.
Для поездок нужны свои versioned keys/поля и включение в эту очистку;
переиспользовать flight unfinished schema нельзя. Ошибка сохранения должна
оставлять введённое; draft не является путешествием и не входит в итоги.

`client/ui/sheet.tsx`/`bottom-sheet.tsx` — modal и responsive sheet;
`ui/menu.tsx` — действия; `ui/combobox.tsx` — Choice/ChoiceOptions и keyboard
поведение. Текущий combobox фильтрует локальный массив и ограничивает его
50 результатами: серверный поиск городов требует адаптации loading/error,
устаревшего ответа и ручного варианта, не глобального массива в браузере.

## Приёмка реализации и оставшиеся решения

Нет обнаруженного архитектурного запрета для новых member routes.
Пока нет их страниц, journey payload/API, поиска городов и draft schema.
Пять вкладок, per-page Add, название Auto/Road-trips и сортировка future →
past-dated plans → undated plans → completed DESC → undated completed,
cancelled через фильтр — ожидаемые продуктовые решения, не готовый UI.
Сначала использовать существующие `client/nav.test.tsx`, route-focus,
navigation-link, route-transition-pairs, Sheet/Menu и capture-preferences
проверки. Расширить `tests/navigation.test.ts` на hard/soft member gates,
active nested routes, direct links и owner isolation; capture suite —
на восстановление своего ввода и ошибку сохранения. После реализации:
`pnpm next:build` и полный `pnpm test:next:navigation` по CODING_STANDARDS.md.
Мобильная ширина 320px, 200% текста, 44px targets и RU/EN — требования
DESIGN.md, не результаты нынешнего чтения исходников.
