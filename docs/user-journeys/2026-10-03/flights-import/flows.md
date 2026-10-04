# Полёты и импорт: карта пользовательских путей

Снято на локальном frozen fixture `http://localhost:8799`, русская локализация, светлая тема, авторизованный синтетический пользователь `b@example.test`. Desktop — `1440×1000`, mobile — `390×844`. Снимки сделаны через UI; текст рядом — accessibility snapshot. Парсер в fixture подменён и возвращает детерминированный JFK→BOS, AA100, 03.01.2026. Пароли и cookies в атласе не сохраняются.

Статусы `captured` — наблюдалось через UI; `simulated` — сеть намеренно перехвачена для воспроизведения сбоя, затем retry прошёл к локальному backend; `source-only` — состояние есть в коде, но fixture не смог его вызвать.

## Журнал: ручное добавление

**Предусловие.** Пользователь авторизован; исходный журнал пуст. Откройте `/flights`, затем `Добавить полёт`. Заполните дату, маршрут и авиакомпанию; при необходимости раскройте самолёт, номер и времена. Airport, airline и aircraft fields имеют подсказки. Если дата+маршрут уже записаны, UI предупреждает о дубле, но позволяет сохранить.

Путь: [Пустой журнал полётов · desktop](images/flights-empty-desktop.png) · [текст снимка](images/flights-empty-desktop.txt) → [Добавить полёт · форма desktop](images/flight-add-form-desktop.png) · [текст снимка](images/flight-add-form-desktop.txt) → [Добавить полёт · календарь](images/flight-date-calendar.png) · [текст снимка](images/flight-date-calendar.txt) → [Добавить полёт · подсказки аэропорта](images/flight-origin-suggestions.png) · [текст снимка](images/flight-origin-suggestions.txt) → [Добавить полёт · подсказки авиакомпании](images/flight-airline-suggestions.png) · [текст снимка](images/flight-airline-suggestions.txt) → [Добавить полёт · необязательные поля](images/flight-add-optional-fields.png) · [текст снимка](images/flight-add-optional-fields.txt) → [Добавить полёт · подсказки самолёта](images/flight-aircraft-suggestions.png) · [текст снимка](images/flight-aircraft-suggestions.txt) → [Добавить полёт · заполненная форма](images/flight-add-filled.png) · [текст снимка](images/flight-add-filled.txt) → [Добавить полёт · предупреждение о дубле](images/flight-manual-duplicate.png) · [текст снимка](images/flight-manual-duplicate.txt).

## Журнал: просмотр, фильтры и действия

Таблица desktop показывает дату, маршрут, длительность, авиакомпанию, самолёт и расстояние. Меню фильтра типа делит записи на предстоящие и прошедшие; также доступны год, авиакомпания, самолёт и маршрут. В режиме `Выбрать` у строк появляются чекбоксы и пакетное удаление с отдельным подтверждением. Нажатие редактирования открывает заполненную форму, а `Удалить полёт` — подтверждение одиночного удаления. Снимки подтверждений были отменены.

Маршрут фильтруется двумя полями кода аэропорта; снимок результата: [Журнал · маршрут JFK→BOS](images/flights-filter-route-jfk-bos.png) · [текст снимка](images/flights-filter-route-jfk-bos.txt).

Путь фильтров: [Журнал с рейсами · desktop](images/flights-populated-desktop.png) · [текст снимка](images/flights-populated-desktop.txt) → [Журнал · фильтр предстоящих/прошедших](images/flights-type-filter-open.png) · [текст снимка](images/flights-type-filter-open.txt) → [Журнал · предстоящие рейсы](images/flights-filter-upcoming.png) · [текст снимка](images/flights-filter-upcoming.txt) → [Журнал · прошедшие рейсы](images/flights-filter-past.png) · [текст снимка](images/flights-filter-past.txt) → [Журнал · список годов](images/flights-year-filter-open.png) · [текст снимка](images/flights-year-filter-open.txt) → [Журнал · год 2027](images/flights-filter-year-2027.png) · [текст снимка](images/flights-filter-year-2027.txt) → [Журнал · список авиакомпаний](images/flights-airline-filter-open.png) · [текст снимка](images/flights-airline-filter-open.txt) → [Журнал · American Airlines](images/flights-filter-airline-aa.png) · [текст снимка](images/flights-filter-airline-aa.txt) → [Журнал · список типов самолёта](images/flights-aircraft-filter-open.png) · [текст снимка](images/flights-aircraft-filter-open.txt) → [Журнал · B738](images/flights-filter-aircraft-b738.png) · [текст снимка](images/flights-filter-aircraft-b738.txt) → [Журнал · маршрут JFK→BOS](images/flights-filter-route-jfk-bos.png) · [текст снимка](images/flights-filter-route-jfk-bos.txt).

Путь действий: [Журнал после повтора импорта · desktop](images/flights-populated-after-import.png) · [текст снимка](images/flights-populated-after-import.txt) → [Редактировать полёт · форма](images/flight-edit-form.png) · [текст снимка](images/flight-edit-form.txt) → [Редактировать полёт · подтверждение удаления](images/flight-delete-confirm.png) · [текст снимка](images/flight-delete-confirm.txt) → [Журнал · режим пакетного выбора](images/flights-bulk-select-mode.png) · [текст снимка](images/flights-bulk-select-mode.txt) → [Журнал · выбран один рейс](images/flights-bulk-selected.png) · [текст снимка](images/flights-bulk-selected.txt) → [Журнал · подтверждение пакетного удаления](images/flights-bulk-delete-confirm.png) · [текст снимка](images/flights-bulk-delete-confirm.txt).

Для mobile списка используется карточная раскладка и нижняя навигация; добавление открывает адаптивную форму. [Пустой журнал полётов · mobile](images/flights-empty-mobile.png) · [текст снимка](images/flights-empty-mobile.txt) · [Журнал с рейсами · mobile](images/flights-populated-mobile.png) · [текст снимка](images/flights-populated-mobile.txt) · [Добавить полёт · форма mobile](images/flight-add-form-mobile.png) · [текст снимка](images/flight-add-form-mobile.txt).

## Импорт: текст и проверка

На `/import` можно вставить текст бронирования или скопировать подсказку промпта. После распознавания открывается проверка: найденные поля редактируются, чекбокс исключает рейс из импорта, строку можно удалить, а при пустом выборе импорт неактивен. Присутствуют действия ручного добавления и удаления дубликатов. Сохранение показывает отдельный success screen.

Путь к сохранению выбранного рейса: [Импорт · загрузка · desktop](images/import-upload-desktop.png) · [текст снимка](images/import-upload-desktop.txt) → [Импорт · промпт раскрыт](images/import-prompt-expanded.png) · [текст снимка](images/import-prompt-expanded.txt) → [Импорт · текст готов](images/import-text-ready.png) · [текст снимка](images/import-text-ready.txt) → [Импорт · распознавание текста](images/import-parsing-text.png) · [текст снимка](images/import-parsing-text.txt) → [Импорт · проверка распознанного рейса](images/import-review-text.png) · [текст снимка](images/import-review-text.txt) → [Импорт · поля найденного рейса](images/import-review-expanded.png) · [текст снимка](images/import-review-expanded.txt) → [Импорт · результат сохранения](images/import-success.png) · [текст снимка](images/import-success.txt).

Ветка выбора: [Проверка рейса](images/import-review-text.png) → [Снять выбор](images/import-review-none-selected.png) → [Снова выбрать рейс](images/import-review-text.png). Ветка ручного добавления: [Проверка рейса](images/import-review-text.png) → [Все рейсы удалены из проверки](images/import-review-removed-all.png) · [текст снимка](images/import-review-removed-all.txt) → [Ручное добавление поверх /import](images/import-manual-add-form-desktop.png) · [текст снимка](images/import-manual-add-form-desktop.txt). Последний снимок сделан до сохранения нового рейса.

Текстовый маркер `FAKE_PROVIDER_QUOTA` даёт HTTP 503, а `FAKE_MODEL_MISSING` — HTTP 502. Для обоих видимый alert одинаков: «Не удалось прочитать документ. Попробуйте другой формат». Это fixture-проверка fallback-обработки. [Импорт · ошибка лимита провайдера](images/import-error-provider-quota.png) · [текст снимка](images/import-error-provider-quota.txt) · [Импорт · модель недоступна](images/import-error-model-missing.png) · [текст снимка](images/import-error-model-missing.txt).

## Импорт: файлы и повтор сохранения

Загружены локальные синтетические `itinerary.pdf` и `ticket.png`; оба доходят до фазы анализа, а fake parser возвращает тот же тестовый рейс. Когда он совпадает по дате и маршруту с существующей записью, строка автоматически снята с выбора; её можно выбрать вручную.

Путь: [Импорт · PDF выбран](images/import-file-pdf.png) · [текст снимка](images/import-file-pdf.txt) → [Импорт · найден дубль](images/import-review-duplicate.png) · [текст снимка](images/import-review-duplicate.txt) → [Импорт · дубль выбран вручную](images/import-review-duplicate-selected.png) · [текст снимка](images/import-review-duplicate-selected.txt) → [Импорт · изображение выбрано](images/import-file-image.png) · [текст снимка](images/import-file-image.txt) → [Импорт · распознавание изображения](images/import-parsing-image.png) · [текст снимка](images/import-parsing-image.txt).

Для retry тестовый перехват браузера намеренно прервал POST `/api/flights`: экран показал Failed to fetch и действие повторить сохранение. После снятия перехвата retry завершился успехом на локальном fixture. Эта ошибка помечена simulated. [Импорт · ошибка сохранения с повтором](images/import-save-error-retry.png) · [текст снимка](images/import-save-error-retry.txt) → [Импорт · повторное сохранение](images/import-save-retried.png) · [текст снимка](images/import-save-retried.txt).

**Наблюдаемая ошибка:** оба success screen показывали «0 flights added to your log», хотя API создал полёт и toast сказал «Flight added to your log»; после перехода на `/flights` запись была видна. Подробность: gap `import-success` в [manifest.json](manifest.json).

Мобильные upload и review при ширине `390×844`: [Импорт · загрузка · mobile](images/import-upload-mobile.png) · [текст снимка](images/import-upload-mobile.txt) · [Импорт · проверка · mobile](images/import-review-mobile.png) · [текст снимка](images/import-review-mobile.txt).

## Обогащение самолётов

Кнопка `Найти самолёт (3)` вызвала локальный `/api/enrich/aircraft`, fixture ответил 502 fake-provider ошибкой; наблюдался toast «Не удалось найти самолёты. Попробуйте ещё раз». Ручной `Добавить самолёт` открывает локальный каталог; поиск `737` показывает типы B37M/B38M/B39M и B732–B738.

[Журнал · ошибка поиска самолётов](images/flights-aircraft-enrich-error.png) · [текст снимка](images/flights-aircraft-enrich-error.txt) · [Указать самолёт · подсказки каталога](images/flights-aircraft-picker-suggestions.png) · [текст снимка](images/flights-aircraft-picker-suggestions.txt).

Успешный кандидат и пустой ответ повторены через сетевой перехват с контрактом `EnrichmentResponse`; сохранение кандидата сначала прервали, затем успешно применили PATCH. Эти состояния simulated, а ошибка реального fake-provider остаётся отдельной captured веткой. [Обогащение самолётов · пустой результат](images/flights-aircraft-enrichment-empty.png) · [текст снимка](images/flights-aircraft-enrichment-empty.txt) → [Обогащение самолётов · кандидат B738](images/flights-aircraft-enrichment-results.png) · [текст снимка](images/flights-aircraft-enrichment-results.txt) → [Обогащение самолётов · ошибка сохранения](images/flights-aircraft-enrichment-apply-error.png) · [текст снимка](images/flights-aircraft-enrichment-apply-error.txt) → [Обогащение самолётов · результат применён](images/flights-aircraft-enrichment-applied.png) · [текст снимка](images/flights-aircraft-enrichment-applied.txt). Отдельного экрана подробностей рейса в маршрутах не обнаружено: используются строка/карточка и редактирование.

## Источники

- `apps/web/src/routes/FlightsPage.tsx`, `apps/web/src/routes/ImportPage.tsx`
- `apps/web/src/components/flights/FlightForm.tsx`, `FlightFilters.tsx`, `FlightTable.tsx`, `FlightCard.tsx`, `FlightCardActions.tsx`, `AircraftPicker.tsx`, `AircraftEnrichButton.tsx`, `AircraftEnrichDialog.tsx`
- `apps/web/src/components/import/ImportUpload.tsx`, `ImportReview.tsx`, `FlightEditRow.tsx`, `FlightProgressModal.tsx`
- `apps/web/src/hooks/useFlights.ts`, `useImport.ts`, `useAircraftEnrichment.ts`

<!-- audit:start -->
## Аудит интерфейса (2026-10-04)

Находки `$impeccable audit`, видимые на экранах этого раздела: 29. Общая оценка 11/20, системные находки без снимков и подробности — в [отчёте](../audit/AUDIT.md). Блок генерируется `build-atlas.py`.

| P | Находка | Экраны раздела |
| --- | --- | --- |
| P1 | [Текстовые цвета ниже 4.5:1: destructive, success, warning и muted-foreground с opacity /40–/80](../audit/AUDIT.md#contrast-text-tokens-below-aa) | `flight-add-form-mobile`, `import-upload-mobile`, `flights-populated-desktop`, `import-upload-desktop`, `import-review-expanded`, `flights-aircraft-enrichment-results`, `import-save-error-retry` |
| P1 | [Границы полей, select и чекбоксов 1.2–1.4:1 вместо 3:1](../audit/AUDIT.md#control-borders-below-3-to-1) | `flight-add-form-mobile`, `import-upload-mobile` |
| P1 | [Автокомплиты (аэропорт, авиакомпания, самолёт) — не combobox: нет role/aria-expanded/activedescendant, li с onClick](../audit/AUDIT.md#flight-form-combobox-aria-missing) | `flight-origin-suggestions`, `flight-add-form-mobile` |
| P1 | [Кольцо фокуса ring-ring/50 у Button/Input/Select/Checkbox даёт 1.2-2.0:1 на светлом фоне](../audit/AUDIT.md#focus-ring-half-opacity-below-3-to-1) | `flight-add-form-mobile` |
| P1 | [Смена маршрута и режима не меняет document.title и не переносит фокус](../audit/AUDIT.md#spa-route-change-no-title-no-focus) | `flights-populated-mobile`, `import-upload-mobile` |
| P1 | [В русском интерфейсе остаются английские строки: зашитые литералы, отсутствующие ключи, ошибки валидации и сервера](../audit/AUDIT.md#i18n-hardcoded-english-and-missing-keys) | `import-parsing-text`, `flights-bulk-selected` |
| P1 | [В ru.json нет plural-форм `_many`: 0, 5–20, 25–30… показываются по-английски](../audit/AUDIT.md#i18n-ru-plural-many-missing) | `flights-bulk-selected`, `import-success` |
| P1 | [На mobile нет пути в рейтинг, а ссылки на собственный публичный профиль нет нигде](../audit/AUDIT.md#mobile-nav-missing-leaderboard-and-own-profile) | `flights-populated-mobile` |
| P1 | [Акцент перекрывает OKLCH-токены одним hex для обеих тем; дефолтный red не проходит AA](../audit/AUDIT.md#accent-picker-overrides-tokens-fails-contrast) | `flights-populated-mobile`, `import-upload-mobile` |
| P1 | [В таблице рейсов кнопка редактирования без имени, сортировка по заголовкам недоступна с клавиатуры](../audit/AUDIT.md#flight-table-edit-and-sort-keyboard) | `flights-populated-desktop`, `flights-bulk-selected` |
| P1 | [Дропзона загрузки — Card с onClick: недоступна с клавиатуры, input скрыт, поле текста без метки](../audit/AUDIT.md#import-dropzone-keyboard-inaccessible) | `import-upload-desktop`, `import-upload-mobile` |
| P1 | [FlightProgressModal — самописная «модалка» без role=dialog, фокус-ловушки и aria-live](../audit/AUDIT.md#import-progress-modal-not-a-dialog) | `import-parsing-text` |
| P1 | [В строках ревью импорта чекбокс, раскрытие и удаление не имеют доступных имён](../audit/AUDIT.md#import-row-checkbox-and-icon-buttons-unlabeled) | `import-review-mobile`, `import-review-expanded` |
| P1 | [Свернутая форма редактирования строки остаётся в порядке Tab и дереве доступности](../audit/AUDIT.md#import-row-collapsed-form-focusable) | `import-review-mobile`, `import-review-expanded` |
| P1 | [Ошибки парсинга (квота ИИ, модель недоступна, таймаут сервера) сводятся к одному общему сообщению](../audit/AUDIT.md#import-error-quota-vs-model-indistinguishable) | `import-error-provider-quota` |
| P1 | [После ошибки парсинга показывается «Рейсов не найдено» вместе с алертом об ошибке](../audit/AUDIT.md#import-parse-error-shows-empty-state) | `import-error-provider-quota` |
| P1 | [Строка ревью импорта на 390px: фиксированная ширина колонок (~580px) переполняет контейнер ~310px](../audit/AUDIT.md#import-row-mobile-overflow) | `import-review-mobile` |
| P2 | [Сбой загрузки выглядит как пустые данные: журнал «нет рейсов», рейтинг «Станьте первым!»](../audit/AUDIT.md#fetch-errors-shown-as-empty-state) | `flights-populated-desktop` |
| P2 | [Экран успеха импорта начинается с «0 flights added to your log» на английском](../audit/AUDIT.md#import-success-counter-starts-at-zero) | `import-success`, `import-save-retried` |
| P2 | [Касательные цели меньше 44×44: свотчи, вкладки, крестики, чекбоксы, слои карты, точки шоукейса, текстовые ссылки](../audit/AUDIT.md#touch-targets-below-44px) | `import-review-mobile`, `flight-add-form-mobile`, `import-upload-mobile` |
| P2 | [Цвета вне токенов: 36 hex, 27 классов палитры Tailwind (blue-500, amber-500…), rgba/white в карте и журнале](../audit/AUDIT.md#hardcoded-color-literals) | `import-review-mobile` |
| P2 | [Обязательность и ошибки формы рейса не связаны с полями: звёздочка без sr-текста, DatePicker и автокомплиты вне FormControl](../audit/AUDIT.md#flight-form-required-validation-wiring) | `flight-add-form-mobile` |
| P2 | [Навигация без aria-current и aria-label, кнопка пользователя подписана инициалами](../audit/AUDIT.md#nav-landmarks-missing-aria-current-and-labels) | `flights-populated-mobile`, `import-upload-mobile` |
| P2 | [Даты рейсов парсятся как UTC и форматируются локальными геттерами — для UTC− сдвиг на день](../audit/AUDIT.md#flight-date-utc-shift) | `flights-populated-mobile`, `flights-populated-desktop` |
| P2 | [Список рейсов рендерит все загруженные карточки/строки без виртуализации, подгрузка кнопкой](../audit/AUDIT.md#flights-list-no-virtualization) | `flights-populated-desktop` |
| P2 | [Искусственные задержки (300мс на рейс + 500 + 400) и backdrop-blur-lg вопреки DESIGN.md](../audit/AUDIT.md#import-progress-modal-forced-delay-blur) | `import-parsing-text` |
| P2 | [Выбранная опция автокомплита: primary-foreground при opacity 60–75 даёт 2.8–3.6:1 в светлой теме](../audit/AUDIT.md#selected-option-contrast-light) | `flight-origin-suggestions` |
| P3 | [Анимации max-height / bottom / height при раскрытии строк, карты Passport и шторки](../audit/AUDIT.md#layout-property-animations) | `import-review-expanded`, `flight-add-form-mobile` |
| P3 | [Строки ревью используют key={index}; состояние раскрытия/годов привязано к позиции](../audit/AUDIT.md#import-review-index-keys-and-dup-actions) | `import-review-expanded` |
<!-- audit:end -->
