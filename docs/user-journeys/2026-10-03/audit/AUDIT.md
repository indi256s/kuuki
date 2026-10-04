# Аудит интерфейса Kuuki — 2026-10-04

$impeccable audit (Impeccable v4.4.0): 5 параллельных срезов на Sonnet 5.5, детектор impeccable detect, сведение и выборочная проверка ключевых находок в основном потоке. Исходники: `1303485`; снимки атласа: `3156841`. Источник истины — исходники на git_head. Скриншоты атласа сняты на atlas_capture_head (dirty tree) и служат визуальным подтверждением; находки только по снимку помечены confidence=likely.

[Карта экранов](../MAP.md) · [JSON находок](findings.json) · [Галерея](../gallery.html). Этот файл собирается `docs/user-journeys/tools/build-atlas.py` из `findings.json`; правь JSON, а не Markdown.

## Оценка

| # | Измерение | Оценка | Главное |
| --- | --- | --- | --- |
| 1 | Доступность | 2/4 | Есть skip-link, landmarks, Radix-диалоги и связанные метки, но контраст текста и границ ниже AA системно, combobox/дропзона/карта без клавиатуры, lang и title статичны. |
| 2 | Производительность | 3/4 | Ленивые маршруты, ручные чанки, IntersectionObserver в Passport; минусы — topojson со стороннего CDN, немемоизированная карта, бесконечные left-анимации, dev-инструмент в прод-чанке. |
| 3 | Адаптивность | 2/4 | Мобильные раскладки и таб-бар есть, но Dashboard (442px) и строка ревью импорта (~580px) переполняют 390px, нет пути в рейтинг, цели <44px. |
| 4 | Темы и токены | 2/4 | OKLCH-токены покрывают ~98% цветов, но акцент перекрывает их hex-ом, .aura-* и белые литералы карты ломают светлую тему, легенда тепловой карты невалидна. |
| 5 | Целостность реализации | 2/4 | Целостная система токенов и тон, но русская локаль системно смешана с английским, обещан несуществующий URL профиля, ошибки маскируются под пустые данные, мёртвые контролы Journey. |
| | **Итого** | **11/20** | **Acceptable** |

## Вердикт целостности реализации

**FAIL.** Не пройден, хотя основа сильная. Система OKLCH-токенов, AppPageShell, Radix-примитивы и тон продукта последовательны и узнаваемы. Но на самых заметных поверхностях реализация расходится с DESIGN.md: дефолтный акцент перекрывает терракоту inline-hex'ом (accent-picker-overrides-tokens-fails-contrast), первый экран собран на стеклянных .aura-* с rgba-литералами (aura-auth-inputs-broken-light-theme), карта рисует белые литералы на светлом фоне (map-overlays-white-on-light-theme), а русская локаль системно смешана с английским (три i18n-находки). Детектор нашёл всего 3 механических совпадения, из них 2 ложных: проблемы лежат не в шаблонных анти-паттернах, а в токенах, локализации и доступности.

## Кратко

- Оценка **11/20** (Acceptable). Находок: 113 — P0: 0, P1: 34, P2: 68, P3: 11.
- P0 нет: ни одна находка не блокирует основной путь полностью. P1 — в основном нарушения WCAG AA и системные пробелы локализации.
- Главное:
  - [`contrast-text-tokens-below-aa`](#contrast-text-tokens-below-aa) — Текстовые цвета ниже 4.5:1: destructive, success, warning и muted-foreground с opacity /40–/80
  - [`accent-picker-overrides-tokens-fails-contrast`](#accent-picker-overrides-tokens-fails-contrast) — Акцент перекрывает OKLCH-токены одним hex для обеих тем; дефолтный red не проходит AA
  - [`i18n-ru-plural-many-missing`](#i18n-ru-plural-many-missing) — В ru.json нет plural-форм `_many`: 0, 5–20, 25–30… показываются по-английски
  - [`i18n-hardcoded-english-and-missing-keys`](#i18n-hardcoded-english-and-missing-keys) — В русском интерфейсе остаются английские строки: зашитые литералы, отсутствующие ключи, ошибки валидации и сервера
  - [`map-geographies-177-tab-stops-no-keyboard-action`](#map-geographies-177-tab-stops-no-keyboard-action) — Каждая страна на карте — безымянная tab-остановка (177 шт.), а Enter ничего не делает
  - [`flight-form-combobox-aria-missing`](#flight-form-combobox-aria-missing) — Автокомплиты (аэропорт, авиакомпания, самолёт) — не combobox: нет role/aria-expanded/activedescendant, li с onClick
  - [`dashboard-mobile-horizontal-overflow-442px`](#dashboard-mobile-horizontal-overflow-442px) — Мобильный Dashboard шире экрана: карточки статистики выпирают за правый край (442px при viewport 390)
  - [`import-row-mobile-overflow`](#import-row-mobile-overflow) — Строка ревью импорта на 390px: фиксированная ширина колонок (~580px) переполняет контейнер ~310px
  - [`authpage-no-redirect-for-signed-in-user`](#authpage-no-redirect-for-signed-in-user) — Авторизованный пользователь на «/» видит форму регистрации (в том числе при старте PWA)

## Системные проблемы

- Контраст решается на уровне токенов, а не экранов: статус-цвета и `text-muted-foreground/NN` используются как текст на всех разделах; один набор текстовых токенов закроет больше 25 состояний атласа.
- Русская локаль — вторичный путь: нет форм `_many`, литералы в JSX, первый кадр на английском, `lang="en"`, DM Sans без кириллицы. Нужен lint и тест полноты ключей.
- Самописные интерактивные виджеты (автокомплиты, дропзона, карта, прогресс-модалка, попап штампа) не используют готовые Radix/ARIA-паттерны и выпадают из клавиатуры; примитивы shadcn при этом в порядке.
- Белые и палитровые литералы появляются там, где компонент изначально рисовался под тёмную тему (карта, Journey, ранги): светлая тема — основная по DESIGN.md, но проверена хуже.
- Ошибки сети маскируются под пустые состояния (журнал, рейтинг, парсинг), а ошибки провайдера сводятся к одному сообщению — пользователь не отличает «нет данных» от «сбой».
- 44px обеспечены глобальным патчем `@media (pointer: coarse)` вместо размеров в примитивах, поэтому всё с `p-0` или кастомным размером выпадает.

## Рекомендуемый порядок

| # | P | Команда | Что сделать |
| --- | --- | --- | --- |
| 1 | P1 | `$impeccable colorize` | Пересобрать текстовые статус-токены, границы контролов и кольцо фокуса до AA; акценты — OKLCH-пары light/dark с терракотой по умолчанию; карта и тепловая легенда на --map-* токенах. |
| 2 | P1 | `$impeccable harden` | Локализация: `_many`, `document.documentElement.lang`, синхронная загрузка ru при старте, lint литералов; title и фокус при смене маршрута; ошибки отдельно от пустых состояний; редирект авторизованного с «/» и разблокировка формы при сбое /api/auth/me. |
| 3 | P1 | `$impeccable harden` | Клавиатура и ARIA: combobox-паттерн для автокомплитов, кнопочная дропзона, карта без 177 безымянных tab-остановок (список стран как альтернатива), FlightProgressModal на Radix Dialog с aria-live, имена у icon-кнопок, меню внешнего вида на DropdownMenuRadioItem. |
| 4 | P1 | `$impeccable adapt` | Mobile: убрать переполнение Dashboard (442px) и строки ревью импорта, добавить рейтинг и свой профиль в мобильную навигацию, цели 44px в примитивах, диалоги с max-height. |
| 5 | P1 | `$impeccable clarify` | Тексты: различимые ошибки парсинга (квота, модель, таймаут), правильный URL профиля в онбординге (/fly/:username), голос «Ваше место» на чужом профиле, понятные причины disabled-состояний. |
| 6 | P2 | `$impeccable polish` | Заменить .aura-* стандартными Input/Button, выстроить заголовки h1→h2→h3, убрать пары рамка+тень и backdrop-blur вне тостов. |
| 7 | P2 | `$impeccable optimize` | Топоджсон локально вместо стороннего CDN, мемоизация карты, WindLoader на transform, убрать agentation из прод-чанка, ленивый LandingPage. |
| 8 | P3 | `$impeccable distill` | Решить судьбу /journey и /landing, удалить осиротевшие compare/legacy-компоненты и мёртвый CSS. |
| 9 | — | `$impeccable polish` | Финальный проход после исправлений, затем повторный `$impeccable audit` и пересъёмка изменённых состояний атласа. |

## Находки

### P1 — 34

<a id="amber-literal-rank-text-fails-contrast-light"></a>

#### [P1] Номера мест в «Вашем месте» окрашены Tailwind amber-500: 1.99:1 в светлой теме

`amber-literal-rank-text-fails-contrast-light` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/components/profile/ProfileRankings.tsx:85`, `apps/web/src/components/profile/ProfileRankings.tsx:80`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:29`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:118`, `apps/web/src/components/leaderboard/UserRankCard.tsx:169`, `apps/web/src/components/leaderboard/UserRankCard.tsx:177`
- **Экраны:** [`profile-sections-expanded-mobile`](../public-social/images/profile-sections-expanded-mobile.png)
- **Влияние:** `text-amber-500` для «#N» топ-10 на bg-amber-500/6 даёт 1.99:1 (light), текст text-lg font-semibold не «крупный». В dark всё нормально (5.75:1) — тема-зависимый дефект. Палитра amber/yellow/slate (hex-подобные литералы, bg-amber-50/50, ring-amber-400/50, rgba(234,179,8,.3)) обходит токены OKLCH: DESIGN.md «tokens over literals».
- **Стандарт:** WCAG 2.1 SC 1.4.3 (AA); DESIGN.md: tokens over literals
- **Рекомендация:** Ввести токен --rank-gold (светлый: L≈0.50, тёмный: L≈0.78) или использовать text-primary/foreground с иконкой Trophy; фон топ-10 — bg-primary/5.
- **Команда:** `$impeccable colorize`
- **Доказательства:** ss_contrast.py: amber-500 на amber/6 over bg = 1.99 (light), 5.75 (dark). Код прочитан. Конкретно ранги видны только когда cache не пуст (в fixture пусты — состояние не снято, поэтому источник).
- **Источник:** `social-settings:amber-literal-rank-text-fails-contrast-light`

<a id="contrast-text-tokens-below-aa"></a>

#### [P1] Текстовые цвета ниже 4.5:1: destructive, success, warning и muted-foreground с opacity /40–/80

`contrast-text-tokens-below-aa` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/index.css:75-90`, `apps/web/src/components/ui/form.tsx:150`, `apps/web/src/components/ui/alert.tsx:13`, `apps/web/src/components/ui/button.tsx:14`, `apps/web/src/components/ui/badge.tsx:16`, `apps/web/src/components/error/ToastProvider.tsx:43-48`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:619`, `apps/web/src/components/flights/FlightForm.tsx:289`, `apps/web/src/components/import/ImportUpload.tsx:251`, `apps/web/src/components/passport/EmptyPassport.tsx:66`, `apps/web/src/components/onboarding/UsernamePicker.tsx:140`, `apps/web/src/components/auth/ActivationRequestForm.tsx:33`, `apps/web/src/index.css:76`, `apps/web/src/index.css:146`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:128`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:150`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:250`, `apps/web/src/components/settings/DeleteAccountSection.tsx:16`, `apps/web/src/components/settings/DataExportSection.tsx:135`, `apps/web/src/components/settings/ProfileSection.tsx:195`, `apps/web/src/components/dashboard/MicroBadgeStatCard.tsx:104`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:560`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:841`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:860`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:949`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:1048`, `apps/web/src/routes/PassportPage.tsx:177`, `apps/web/src/components/passport/EmptyPassport.tsx:40`, `apps/web/src/components/passport/CountryStamp.tsx:148`, `apps/web/src/components/passport/CountryStamp.tsx:259`, `apps/web/src/components/flights/FlightForm.tsx:353`, `apps/web/src/components/flights/FlightForm.tsx:414`, `apps/web/src/components/flights/FlightTable.tsx:291`, `apps/web/src/components/import/FlightEditRow.tsx:261`, `apps/web/src/components/flights/FlightCard.tsx:70`, `apps/web/src/components/flights/FlightTable.tsx:274`, `apps/web/src/components/flights/FlightForm.tsx:276`, `apps/web/src/components/flights/FlightForm.tsx:279`, `apps/web/src/components/flights/AirportAutocomplete.tsx:178`, `apps/web/src/components/import/FlightEditRow.tsx:462`, `apps/web/src/components/flights/AircraftEnrichDialog.tsx:115`, `apps/web/src/components/flights/FlightForm.tsx:307`, `apps/web/src/routes/ImportPage.tsx:413`, `apps/web/src/components/profile/ProfileStats.tsx:113`, `apps/web/src/components/profile/ProfileSection.tsx:73`
- **Экраны:** [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`flight-add-form-mobile`](../flights-import/images/flight-add-form-mobile.png), [`import-upload-mobile`](../flights-import/images/import-upload-mobile.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`auth-signin-validation-desktop`](../public-social/images/auth-signin-validation-desktop.png), [`auth-register-validation-desktop`](../public-social/images/auth-register-validation-desktop.png), [`auth-signin-invalid-credentials-desktop`](../public-social/images/auth-signin-invalid-credentials-desktop.png), [`onboarding-username-validation-desktop`](../public-social/images/onboarding-username-validation-desktop.png), [`settings-delete-preview-desktop`](../public-social/images/settings-delete-preview-desktop.png), [`settings-delete-wrong-password-desktop`](../public-social/images/settings-delete-wrong-password-desktop.png), [`settings-main-desktop`](../public-social/images/settings-main-desktop.png), [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`dashboard-filtered-2025-desktop`](../dashboard-passport-journey/images/dashboard-filtered-2025-desktop.png), [`dashboard-synthetic-fleet-manufacturer-desktop`](../dashboard-passport-journey/images/dashboard-synthetic-fleet-manufacturer-desktop.png), [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-empty-mobile`](../dashboard-passport-journey/images/passport-empty-mobile.png), [`passport-empty-desktop`](../dashboard-passport-journey/images/passport-empty-desktop.png), [`flights-populated-desktop`](../flights-import/images/flights-populated-desktop.png), [`import-upload-desktop`](../flights-import/images/import-upload-desktop.png), [`import-review-expanded`](../flights-import/images/import-review-expanded.png), [`flights-aircraft-enrichment-results`](../flights-import/images/flights-aircraft-enrichment-results.png), [`import-save-error-retry`](../flights-import/images/import-save-error-retry.png), [`profile-public-test-traveler-mobile`](../public-social/images/profile-public-test-traveler-mobile.png), [`profile-sections-expanded-mobile`](../public-social/images/profile-sections-expanded-mobile.png)
- **Влияние:** Ошибки форм, предупреждения удаления, статусы импорта, подписи статистики и вспомогательный текст плохо читаются на солнце и для слабовидящих. Это систематика токенов: проблема на всех разделах.
- **Стандарт:** WCAG 2.1 SC 1.4.3 (AA); PRODUCT.md: 4.5:1 body
- **Рекомендация:** Ввести текстовые варианты статус-токенов (`--destructive-text`, `--success-text`, `--warning-text`) с L ≈ 0.45–0.5 в light и ≈ 0.75 в dark; запретить `text-muted-foreground/NN` ниже /100 для текста (оставить для декоративных иконок с aria-hidden).
- **Команда:** `$impeccable colorize`
- **Доказательства:** Контраст посчитан скриптами OKLCH→sRGB в трёх срезах независимо, результаты совпали: destructive 3.37–3.42:1 (light) и 3.67:1 (dark), success 2.1–2.3:1, warning 1.6–1.7:1, muted/40–70 1.5–2.7:1.
- **Источник:** `foundations:text-tokens-and-opacity-below-aa`, `entry:destructive-text-contrast-form-errors`, `social-settings:destructive-text-contrast-fails-aa-in-delete-flow`, `dashboard-passport-journey:muted-foreground-opacity-contrast`, `flights-import:contrast-muted-alpha-text`, `flights-import:contrast-warning-text-light`, `flights-import:contrast-success-destructive-light`, `social-settings:muted-foreground-low-opacity-text-and-icons`

<details><summary>Доказательства срезов</summary>

- [foundations:text-tokens-and-opacity-below-aa] Контраст посчитан скриптом (OKLCH токены index.css:44-187, композитинг alpha над --background/--card). Количество использований: rg по text-destructive/success/warning/info и text-muted-foreground/N (44 вхождения в 22 файлах). Строки проверены чтением кода.
- [entry:destructive-text-contrast-form-errors] Посчитал: --destructive oklch(.65 .18 25) на card = 3.42:1 (светлая); oklch(.6 .2 25) на card = 3.67:1 (тёмная); Alert description (destructive/90) на card = 3.05:1 в светлой. Все четыре места используют text-destructive text-sm. Токены системные: проблема не ограничена entry.
- [social-settings:destructive-text-contrast-fails-aa-in-delete-flow] Токены из index.css:76/146 переведены OKLCH→sRGB→WCAG скриптом ss_contrast.py (композитинг alpha над фоном). Скриншоты dark проверены глазом (красный текст на тёмно-красном тусклый).
- [dashboard-passport-journey:muted-foreground-opacity-contrast] Посчитано (python, OKLCH→sRGB→WCAG) поверх --card в светлой теме: muted-foreground 4.72:1; /80 2.71; /70 2.23; /60 1.90; /50 1.65; primary/80 2.78; opacity .7 → 2.23. Тёмная тема: /60 3.37, /50 2.97. Визуально подтверждено на dashboard-populated-desktop (бледные курсивные строки в карточках) и passport-empty-mobile (серая подсказка).
- [flights-import:contrast-muted-alpha-text] Посчитано скриптом contrast_fi.py (OKLCH→sRGB, композитинг alpha): light: muted/60 на bg 2.28, /50 1.95, /70 на Note-tint 2.62, /40 на card 1.69, info/70 на info/3% 2.69; dark: 2.80/2.33/3.18/1.90/2.34. Базовый muted-foreground: 4.65 light, 5.48 dark.
- [flights-import:contrast-warning-text-light] Рассчитано contrast_fi.py: light warning on bg 1.68, on warning/10 1.60, warning/80 1.45; warning-foreground on warning/10 6.81. Токены прочитаны в index.css:48–89,131–152.
- [flights-import:contrast-success-destructive-light] Рассчитано contrast_fi.py: light success/success10 2.10, success/card 2.27, destructive/bg 3.37; dark destructive/bg 4.07, /card 3.67.
- [social-settings:muted-foreground-low-opacity-text-and-icons] Контраст посчитан ss_contrast.py (muted-fg/70 on bg = 2.22 light). Скриншот mobile: подпись к дистанции бледная.

</details>

<a id="control-borders-below-3-to-1"></a>

#### [P1] Границы полей, select и чекбоксов 1.2–1.4:1 вместо 3:1

`control-borders-below-3-to-1` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/index.css:80-81`, `apps/web/src/index.css:154-155`, `apps/web/src/components/ui/input.tsx:11`, `apps/web/src/components/ui/textarea.tsx:10`, `apps/web/src/components/ui/select.tsx:40`, `apps/web/src/components/ui/checkbox.tsx:15`, `apps/web/src/components/settings/ProfileSection.tsx:138`, `apps/web/src/components/settings/ProfileSection.tsx:160`, `apps/web/src/components/settings/DataExportSection.tsx:76`
- **Экраны:** [`flight-add-form-mobile`](../flights-import/images/flight-add-form-mobile.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`import-upload-mobile`](../flights-import/images/import-upload-mobile.png), [`settings-dark-theme-desktop`](../public-social/images/settings-dark-theme-desktop.png), [`settings-public-profile-enabled-desktop`](../public-social/images/settings-public-profile-enabled-desktop.png), [`settings-data-export-success-desktop`](../public-social/images/settings-data-export-success-desktop.png), [`settings-main-desktop`](../public-social/images/settings-main-desktop.png)
- **Влияние:** Невыбранный чекбокс приватности или экспорта почти не виден, границы полей пропадают на ярком экране; пользователь не понимает, где кликать и что выключено.
- **Стандарт:** WCAG 2.1 SC 1.4.11 Non-text Contrast (AA)
- **Рекомендация:** Поднять `--input`/`--border` для контролов до ≥3:1 к фону (отдельный токен `--control-border`, карточки могут остаться мягкими).
- **Команда:** `$impeccable colorize`
- **Доказательства:** index.css:80-81, 154-155; checkbox.tsx:15; контраст посчитан скриптом в двух срезах.
- **Источник:** `foundations:control-borders-below-3-to-1`, `social-settings:checkbox-unchecked-border-fails-non-text-contrast`

<details><summary>Доказательства срезов</summary>

- [foundations:control-borders-below-3-to-1] Посчитано: light input 1.29, border 1.37; dark input 1.21/1.10. Просмотрены flight-add-form-mobile, import-upload-mobile, settings-dark-theme-desktop. Код Input/Textarea/Select/Checkbox прочитан.
- [social-settings:checkbox-unchecked-border-fails-non-text-contrast] Контраст посчитан (input vs background light 1.29, dark 1.21; ss_contrast.py). Dark-снимки settings-public-profile-enabled и settings-data-export-success просмотрены: невыбранные боксы не различимы.

</details>

<a id="flight-form-combobox-aria-missing"></a>

#### [P1] Автокомплиты (аэропорт, авиакомпания, самолёт) — не combobox: нет role/aria-expanded/activedescendant, li с onClick

`flight-form-combobox-aria-missing` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/components/flights/AirportAutocomplete.tsx:150`, `apps/web/src/components/flights/AirportAutocomplete.tsx:207`, `apps/web/src/components/flights/AirportAutocomplete.tsx:212`, `apps/web/src/components/flights/FlightForm.tsx:298`, `apps/web/src/components/flights/FlightForm.tsx:382`, `apps/web/src/components/flights/FlightForm.tsx:435`
- **Экраны:** [`flight-origin-suggestions`](../flights-import/images/flight-origin-suggestions.png), [`flight-add-form-mobile`](../flights-import/images/flight-add-form-mobile.png)
- **Влияние:** Input без role=combobox, aria-autocomplete, aria-expanded, aria-controls, aria-activedescendant; список ul/li без role=listbox/option и с onClick; выбранная стрелками опция не объявляется, количество результатов не озвучивается. То же в AirlineAutocomplete/AircraftAutocomplete/AircraftPicker (копии паттерна). FormMessage не связана с полем (aria-describedby), т.к. компонент игнорирует FormControl.
- **Стандарт:** WCAG 2.1 SC 4.1.2 (A), 1.3.1, 3.3.1, ARIA APG Combobox
- **Рекомендация:** Выделить единый Combobox (Radix Popover + cmdk или ручной ARIA 1.2 pattern): role=combobox + listbox/option + aria-activedescendant + live-область «Найдено N»; пробросить id/aria-describedby/aria-invalid из useFormField.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан AirportAutocomplete.tsx (Input 150–164, ul/li 207–216, handleKeyDown), FlightForm.tsx 293–392 (FormItem без FormControl вокруг автокомплитов). grep по aria-/role= в файле: только Label htmlFor. Скриншот flight-origin-suggestions.
- **Источник:** `flights-import:flight-form-combobox-aria-missing`

<a id="focus-ring-half-opacity-below-3-to-1"></a>

#### [P1] Кольцо фокуса ring-ring/50 у Button/Input/Select/Checkbox даёт 1.2-2.0:1 на светлом фоне

`focus-ring-half-opacity-below-3-to-1` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/components/ui/button.tsx:8`, `apps/web/src/components/ui/input.tsx:12`, `apps/web/src/components/ui/select.tsx:40`, `apps/web/src/components/ui/checkbox.tsx:15`, `apps/web/src/components/ui/accordion.tsx:38`, `apps/web/src/index.css:266-269`
- **Экраны:** [`flight-add-form-mobile`](../flights-import/images/flight-add-form-mobile.png), [`passport-country-picker-mobile`](../dashboard-passport-journey/images/passport-country-picker-mobile.png)
- **Влияние:** focus-visible:ring-ring/50 focus-visible:ring-[3px] — полупрозрачное кольцо. У Button default нет бордера, поэтому border-ring не помогает: единственный индикатор фокуса — кольцо 50% акцента над фоном. Контраст кольца к фону (светлая): red 1.91, blue 1.55, cyan 1.54, teal 1.55, yellow 1.24, orange 1.49, coral 1.67, purple 1.65; тёмная 2.0-3.7. Глобальный :focus-visible (2px solid var(--ring), index.css:266) полноценный, но перебивается utility outline-none на компонентах (layer utilities выше base). У полей border-ring при фокусе даёт 3.63 только для red, у остальных акцентов <3.
- **Стандарт:** WCAG 2.1 SC 1.4.11 (AA) для индикатора фокуса; SC 2.4.7
- **Рекомендация:** Перейти на сплошное кольцо: focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background (как уже сделано в MobileTabBar/FAB/CollapsibleCard), либо оставить глобальный outline и убрать outline-none из base-вариантов кнопки/триггеров. Проверять >=3:1 для каждого акцента.
- **Команда:** `$impeccable colorize`
- **Доказательства:** Контраст кольца посчитан для 8 акцентов (mix 50% над --background). Код button/input/select/checkbox/accordion прочитан; скриншоты показывают красное кольцо на первом поле flight-add-form-mobile и поле поиска passport-country-picker-mobile (дефолтный red, наиболее благоприятный случай).
- **Источник:** `foundations:focus-ring-half-opacity-below-3-to-1`

<a id="html-lang-static-en"></a>

#### [P1] `<html lang>` всегда «en», даже когда интерфейс русский

`html-lang-static-en` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/index.html:2`, `apps/web/src/lib/i18n.ts:63-70`, `apps/web/src/lib/i18n.ts:10-13`, `apps/web/src/hooks/useLanguage.ts:5-20`
- **Экраны:** [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`landing-desktop`](../public-social/images/landing-desktop.png), [`onboarding-username-desktop`](../public-social/images/onboarding-username-desktop.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`app-header-user-menu-desktop`](../public-social/images/app-header-user-menu-desktop.png)
- **Влияние:** Скринридеры читают русский текст английским синтезатором, браузер предлагает перевод «с английского», переносы и проверка орфографии работают неверно.
- **Стандарт:** WCAG 2.1 SC 3.1.1 (A)
- **Рекомендация:** В i18n.ts на событие `languageChanged` (и при инициализации) ставить `document.documentElement.lang = lng`; в /activate — по сохранённому языку.
- **Команда:** `$impeccable harden`
- **Доказательства:** apps/web/index.html:2 — `<html lang="en">`; в i18n.ts нет записи в documentElement.lang (проверено grep).
- **Источник:** `entry:html-lang-static-en`, `foundations:html-lang-static-en-ru-ui`

<details><summary>Доказательства срезов</summary>

- [entry:html-lang-static-en] grep по src на documentElement.lang / setAttribute("lang") пуст; index.html:2 жёстко <html lang="en">. i18n.ts changeLanguage только пишет в localStorage. Атлас: ru-снимки при этом не содержат смены языка документа.
- [foundations:html-lang-static-en-ru-ui] Прочитаны index.html, lib/i18n.ts, hooks/useLanguage.ts; rg "documentElement.lang|\.lang =" по apps/web/src — нет совпадений. Локаль скриншотов ru (environment.json), a11y-снимки показывают русские имена при lang=en.

</details>

<a id="map-geographies-177-tab-stops-no-keyboard-action"></a>

#### [P1] Каждая страна на карте — безымянная tab-остановка (177 шт.), а Enter ничего не делает

`map-geographies-177-tab-stops-no-keyboard-action` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/components/map/RouteMapWithCountries.tsx:273-323`, `apps/web/src/components/map/RouteMapWithCountries.tsx:318`, `apps/web/src/components/journey/JourneyMap.tsx:72-89`, `apps/web/src/routes/PassportPage.tsx:130`, `apps/web/src/components/map/MapCard.tsx:86-98`
- **Экраны:** [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`dashboard-filtered-2025-desktop`](../dashboard-passport-journey/images/dashboard-filtered-2025-desktop.png), [`dashboard-map-expanded-desktop`](../dashboard-passport-journey/images/dashboard-map-expanded-desktop.png), [`dashboard-map-routes-off-desktop`](../dashboard-passport-journey/images/dashboard-map-routes-off-desktop.png), [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-populated-mobile`](../dashboard-passport-journey/images/passport-populated-mobile.png), [`passport-map-expanded-desktop`](../dashboard-passport-journey/images/passport-map-expanded-desktop.png), [`passport-map-heatmap-desktop`](../dashboard-passport-journey/images/passport-map-heatmap-desktop.png), [`passport-map-routes-off-desktop`](../dashboard-passport-journey/images/passport-map-routes-off-desktop.png), [`passport-map-countries-off-desktop`](../dashboard-passport-journey/images/passport-map-countries-off-desktop.png), [`journey-initial-desktop`](../dashboard-passport-journey/images/journey-initial-desktop.png)
- **Влияние:** react-simple-maps v3 рендерит каждый <path> Geography с tabIndex="0". Клавиатурному пользователю до статистики на Dashboard и до штампов на Passport нужно пройти ~177 tab-остановок без имён (в a11y-снимке: "graphics-symbol [focusable]"). Клик по стране на Passport (onCountryClick → ClaimDialog) обрабатывается только onClick на <path>; Enter/Space не вызывают click у SVG-пути, то есть выбор страны на карте доступен только мышью (альтернатива — кнопка «Добавить страну», она есть).
- **Стандарт:** WCAG 2.1 SC 2.1.1 (A), SC 2.4.3 (A), SC 4.1.2 (A)
- **Рекомендация:** Передать в Geography tabIndex={-1} (или обернуть ComposableMap в aria-hidden и дать текстовую альтернативу), а для интерактивного режима Passport — сделать роль button + onKeyDown (Enter/Space) только у выбранных/кликабельных стран с aria-label=название страны, либо убрать интерактивность карты в пользу списка стран.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код: node_modules/react-simple-maps/dist/index.js содержит tabIndex: "0" у rsm-geography; в RouteMapWithCountries.tsx только onClick. Подсчитано grep по accessibility-снимкам: dashboard-populated-desktop 177 graphics-symbol + 178 tabindex, passport-populated-desktop 177/177, journey-initial-desktop 177/177, passport-map-expanded-desktop 177/177. Реальную работу клавиатуры/скринридера не запускал.
- **Источник:** `dashboard-passport-journey:map-geographies-177-tab-stops-no-keyboard-action`

<a id="map-overlays-white-on-light-theme"></a>

#### [P1] Маркеры аэропортов, подписи, счётчики и кнопка «развернуть» на карте захардкожены белым и невидимы в светлой теме

`map-overlays-white-on-light-theme` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/components/map/RouteMapWithCountries.tsx:341`, `apps/web/src/components/map/RouteMapWithCountries.tsx:351`, `apps/web/src/components/map/RouteMapWithCountries.tsx:364-374`, `apps/web/src/components/map/MapCard.tsx:151-155`
- **Экраны:** [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`dashboard-filtered-2025-desktop`](../dashboard-passport-journey/images/dashboard-filtered-2025-desktop.png), [`dashboard-map-expanded-desktop`](../dashboard-passport-journey/images/dashboard-map-expanded-desktop.png), [`dashboard-map-routes-off-desktop`](../dashboard-passport-journey/images/dashboard-map-routes-off-desktop.png), [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-populated-mobile`](../dashboard-passport-journey/images/passport-populated-mobile.png), [`passport-map-expanded-desktop`](../dashboard-passport-journey/images/passport-map-expanded-desktop.png), [`passport-map-heatmap-desktop`](../dashboard-passport-journey/images/passport-map-heatmap-desktop.png), [`passport-map-routes-off-desktop`](../dashboard-passport-journey/images/passport-map-routes-off-desktop.png), [`passport-map-countries-off-desktop`](../dashboard-passport-journey/images/passport-map-countries-off-desktop.png)
- **Влияние:** В светлой теме (по умолчанию) фон карты --map-background светлый, а белые маркеры/IATA-подписи, строка «N маршрутов · N аэропортов · N стран» (text-white/70) и иконка Maximize2 (bg-white/10 text-white/70) сливаются с ним. Пользователь не видит, какие аэропорты на карте, не видит сводку и может не найти кнопку разворота карты. Сводка при этом остаётся в a11y-дереве, т.е. скринридер читает то, чего не видно зрячим.
- **Стандарт:** WCAG 2.1 SC 1.4.3 (AA), SC 1.4.11 (AA); DESIGN.md: «Maps: fills reference --map-* CSS variables», «Tokens over literals»
- **Рекомендация:** Заменить white/white-70 на токены: маркеры fill=var(--card) + stroke=var(--map-stroke), подписи fill=var(--map-marker-label) (как уже сделано в JourneyMap.tsx:105-113), сводку вынести в HTML-оверлей с bg-card/80 text-foreground/muted-foreground, кнопку «развернуть» сделать как соседние toggle-кнопки (bg-card/80, text-muted-foreground). Строки «routes/airports/countries» брать через t('map.routes') (ключи уже есть).
- **Команда:** `$impeccable colorize`
- **Доказательства:** Прочитан код; посчитан контраст по токенам OKLCH: белый на --map-background (oklch 0.97) = 1.09:1, white/70 на нём = 1.06:1, white/70 поверх bg-white/10 на --card = 1.02:1. Просмотрены dashboard-populated-desktop, passport-populated-desktop, passport-map-expanded-desktop, dashboard-populated-full-mobile: сводка внизу слева еле различима, иконка разворота в правом верхнем углу почти не видна, маркеры — белые точки на светло-сером. Тёмная тема: белое на oklch 0.16 = 19.4:1, там нормально.
- **Источник:** `dashboard-passport-journey:map-overlays-white-on-light-theme`

<a id="spa-route-change-no-title-no-focus"></a>

#### [P1] Смена маршрута и режима не меняет document.title и не переносит фокус

`spa-route-change-no-title-no-focus` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/index.html:11`, `apps/web/src/App.tsx:62-132`, `apps/web/src/components/layout/AppPageShell.tsx:46-52`, `apps/web/src/components/common/SkipLink.tsx:7-12`, `apps/web/index.html:10`, `apps/web/src/routes/AuthPage.tsx:24-154`, `apps/web/src/routes/OnboardingPage.tsx:55-134`, `apps/web/src/routes/LandingPage.tsx:60-157`
- **Экраны:** [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`flights-populated-mobile`](../flights-import/images/flights-populated-mobile.png), [`import-upload-mobile`](../flights-import/images/import-upload-mobile.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-register-desktop`](../public-social/images/auth-register-desktop.png), [`landing-desktop`](../public-social/images/landing-desktop.png), [`onboarding-username-desktop`](../public-social/images/onboarding-username-desktop.png)
- **Влияние:** Вкладка всегда называется одинаково; пользователь скринридера после перехода не слышит, что экран сменился, фокус остаётся на нажатой ссылке.
- **Стандарт:** WCAG 2.1 SC 2.4.2 Page Titled (A), SC 2.4.3 Focus Order (A)
- **Рекомендация:** Хук useDocumentTitle на каждый маршрут/режим (вход, регистрация, онбординг-шаг) и перенос фокуса на `<main>`/h1 после навигации.
- **Команда:** `$impeccable harden`
- **Доказательства:** index.html:10-11 — один статичный title; в App.tsx и AppPageShell нет управления title/фокусом (код).
- **Источник:** `foundations:spa-route-change-no-title-no-focus`, `entry:page-title-static-across-entry-screens`

<details><summary>Доказательства срезов</summary>

- [foundations:spa-route-change-no-title-no-focus] Прочитаны App.tsx, AppPageShell.tsx, SkipLink.tsx, index.html; rg по title/focus-management без совпадений. Реальное поведение SR не проверялось.
- [entry:page-title-static-across-entry-screens] grep document.title в src пуст; единственный <title> в index.html:10 (на английском). В atlas все состояния auth/landing/onboarding живут на одном URL «/» или без смены title.

</details>

<a id="i18n-first-paint-english-until-rerender"></a>

#### [P1] При первой загрузке в RU части экрана остаются на английском до случайного ре-рендера

`i18n-first-paint-english-until-rerender` · Целостность реализации · уверенность: verified · системная

- **Где:** `apps/web/src/lib/i18n.ts:10-12`, `apps/web/src/lib/i18n.ts:55-58`, `apps/web/src/lib/i18n.ts:63-70`, `apps/web/src/main.tsx:18-23`, `apps/web/src/components/common/SkipLink.tsx:11`, `apps/web/src/routes/AuthPage.tsx:38`, `apps/web/src/routes/AuthPage.tsx:134-136`
- **Экраны:** [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`auth-signin-invalid-credentials-desktop`](../public-social/images/auth-signin-invalid-credentials-desktop.png), [`auth-register-validation-desktop`](../public-social/images/auth-register-validation-desktop.png), [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`landing-mobile`](../public-social/images/landing-mobile.png), [`landing-showcase-step1-desktop`](../public-social/images/landing-showcase-step1-desktop.png), [`landing-showcase-step2-desktop`](../public-social/images/landing-showcase-step2-desktop.png), [`landing-showcase-step3-desktop`](../public-social/images/landing-showcase-step3-desktop.png)
- **Влияние:** Пользователь с русской локалью видит смесь языков: «Skip to main content», «Activate an existing account», английские слоганы и вся лендинговая страница на английском, пока какой-нибудь стейт не вызовет ре-рендер. Скринридер читает skip-ссылку по-английски. Кнопка языка при этом уже показывает «EN», то есть интерфейс «думает», что он русский.
- **Стандарт:** DESIGN.md / PRODUCT.md: i18n EN/RU для интерактивных подписей; WCAG 2.1 SC 3.1.1 (A) по смыслу (язык контента)
- **Рекомендация:** Дождаться загрузки RU-бандла до createRoot (await в main.tsx или resources для стартового языка в i18n.init), либо включить react: { bindI18nStore: "added" } в i18n.init, чтобы компоненты перерисовывались при addResourceBundle. Добавить тест: холодный старт с localStorage kuuki-language=ru не содержит английских строк в первом рендере.
- **Команда:** `$impeccable harden`
- **Доказательства:** i18n.ts инициализирует lng=ru, но в resources только en (стр. 14-27); RU подгружается динамическим import (стр. 45-52, 55-58), react-i18next по умолчанию не подписан на событие store «added» (в проекте bindI18n* не настраивается, grep). В dist RU лежит в отдельном чанке assets/index-BrcZAkM1.js (подтверждает реальный сетевой запрос после старта). Atlas: в snapshot auth-signin-mobile.txt skip-ссылка и «Activate an existing account» английские, а «Пароль»/«Войти» русские (форма перерисовалась при вводе); ключи a11y.skipToContent, auth.activateExisting и auth.taglines в ru.json есть. i18n.ts не менялся после съёмки (git diff 3156841..HEAD). Смотрел landing-mobile.png и showcase-step2: фон лендинга английский под русской модалкой. Механизм (отсутствие ре-рендера) выведен из кода, симптом подтверждён снимками.
- **Источник:** `entry:i18n-first-paint-english-until-rerender`

<a id="i18n-hardcoded-english-and-missing-keys"></a>

#### [P1] В русском интерфейсе остаются английские строки: зашитые литералы, отсутствующие ключи, ошибки валидации и сервера

`i18n-hardcoded-english-and-missing-keys` · Целостность реализации · уверенность: verified · системная

- **Где:** `apps/web/src/routes/AuthPage.tsx:104`, `apps/web/src/components/auth/WhatIsKuukiDialog.tsx:47`, `apps/web/src/components/ui/dialog.tsx:94`, `apps/web/src/components/onboarding/ShowcaseModal.tsx:88`, `apps/web/src/routes/AuthPage.tsx:113`, `apps/web/src/routes/LandingPage.tsx:75-83`, `apps/web/src/routes/OnboardingPage.tsx:67-75`, `apps/web/src/routes/OnboardingPage.tsx:116`, `apps/web/src/components/onboarding/UsernamePicker.tsx:163`, `apps/web/src/components/auth/SignInForm.tsx:19-22`, `apps/web/src/components/auth/RegisterForm.tsx:19-22`, `apps/web/src/lib/auth.ts:30`, `apps/web/src/lib/auth.ts:36`, `apps/web/src/lib/auth.ts:50`, `apps/web/src/lib/auth.ts:56`, `apps/web/src/lib/auth.ts:76`, `apps/web/src/lib/apiClient.ts:241`, `apps/web/src/stores/authStore.ts:33`, `apps/web/src/components/auth/SignInForm.tsx:51-53`, `apps/web/src/components/auth/SignInForm.tsx:52`, `apps/web/src/components/auth/RegisterForm.tsx:56`, `apps/web/src/components/onboarding/UsernamePicker.tsx:89`, `apps/web/src/routes/OnboardingPage.tsx:28`, `apps/web/src/routes/DashboardPage.tsx:223`, `apps/web/src/routes/DashboardPage.tsx:301`, `apps/web/src/components/flights/FlightFilters.tsx:199`, `apps/web/src/components/dashboard/UpcomingFlightsBanner.tsx:36-39`, `apps/web/src/components/dashboard/UpcomingFlightsBanner.tsx:90`, `apps/web/src/components/map/MapCard.tsx:157`, `apps/web/src/components/map/MapCard.tsx:176`, `apps/web/src/components/map/RouteMapWithCountries.tsx:365-371`, `apps/web/src/components/passport/CountryStamp.tsx:13-32`, `apps/web/src/components/passport/PassportStamps.tsx:188-197`, `apps/web/src/components/passport/CountryClaimMap.tsx:130-136`, `apps/web/src/routes/PassportPage.tsx:198`, `apps/web/src/components/passport/StampPopup.tsx:17-24`, `apps/web/src/components/passport/StampPopup.tsx:185`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:711`, `apps/web/src/hooks/usePassport.ts:170-230`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:889-893`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:993`, `apps/web/src/components/profile/ProfileRankings.tsx:112`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:163`, `apps/web/src/components/leaderboard/UserRankCard.tsx:204`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:110`, `apps/web/src/components/profile/ProfileHeader.tsx:29`, `apps/web/src/components/profile/ProfileStats.tsx:125`, `apps/web/src/components/settings/AppearanceSection.tsx:93`, `apps/web/src/components/profile/ProfileBadges.tsx:113`, `apps/web/src/components/settings/DataExportSection.tsx:38`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:72`, `apps/web/src/components/ui/dialog.tsx:98`, `apps/web/src/components/import/FlightProgressModal.tsx:305`, `apps/web/src/hooks/useFlights.ts:90`, `apps/web/src/hooks/useFlights.ts:94`, `apps/web/src/hooks/useFlights.ts:113`, `apps/web/src/hooks/useFlights.ts:137`, `apps/web/src/hooks/useFlights.ts:160`, `apps/web/src/hooks/useFlights.ts:164`, `apps/web/src/routes/FlightsPage.tsx:86`, `apps/web/src/components/ui/dialog.tsx:136`, `apps/web/src/components/ui/sheet.tsx:115`, `apps/web/src/components/ui/command.tsx:33-34`, `apps/web/src/components/ui/LoadingScreen.tsx:12`, `apps/web/src/components/common/AppearanceToggle.tsx:104`, `apps/web/src/components/error/CrashScreen.tsx:62`
- **Экраны:** [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-register-mobile`](../public-social/images/auth-register-mobile.png), [`auth-about-dialog-desktop`](../public-social/images/auth-about-dialog-desktop.png), [`landing-showcase-step1-desktop`](../public-social/images/landing-showcase-step1-desktop.png), [`onboarding-username-validation-desktop`](../public-social/images/onboarding-username-validation-desktop.png), [`landing-desktop`](../public-social/images/landing-desktop.png), [`auth-signin-validation-desktop`](../public-social/images/auth-signin-validation-desktop.png), [`auth-register-validation-desktop`](../public-social/images/auth-register-validation-desktop.png), [`auth-signin-invalid-credentials-desktop`](../public-social/images/auth-signin-invalid-credentials-desktop.png), [`auth-activation-unavailable-desktop`](../public-social/images/auth-activation-unavailable-desktop.png), [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`dashboard-upcoming-banner-desktop`](../dashboard-passport-journey/images/dashboard-upcoming-banner-desktop.png), [`dashboard-filtered-2025-desktop`](../dashboard-passport-journey/images/dashboard-filtered-2025-desktop.png), [`dashboard-filters-expanded-mobile`](../dashboard-passport-journey/images/dashboard-filters-expanded-mobile.png), [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-populated-mobile`](../dashboard-passport-journey/images/passport-populated-mobile.png), [`passport-country-picker-desktop`](../dashboard-passport-journey/images/passport-country-picker-desktop.png), [`passport-claim-new-mobile`](../dashboard-passport-journey/images/passport-claim-new-mobile.png), [`passport-delete-visit-confirm-desktop`](../dashboard-passport-journey/images/passport-delete-visit-confirm-desktop.png), [`passport-stamp-popup-mobile`](../dashboard-passport-journey/images/passport-stamp-popup-mobile.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`profile-own-private-desktop`](../public-social/images/profile-own-private-desktop.png), [`settings-delete-wrong-password-desktop`](../public-social/images/settings-delete-wrong-password-desktop.png), [`import-parsing-text`](../flights-import/images/import-parsing-text.png), [`flights-bulk-selected`](../flights-import/images/flights-bulk-selected.png), [`settings-dark-theme-desktop`](../public-social/images/settings-dark-theme-desktop.png), [`settings-system-theme-desktop`](../public-social/images/settings-system-theme-desktop.png)
- **Влияние:** Русскоязычный пользователь видит смесь языков на каждом разделе: ошибки zod и сервера в формах входа («Invalid email»), подписи и aria-label (Share, Anonymous, Top N%, Close), тосты и прогресс импорта, диалоги удаления, ~29 ключей Dashboard/Passport без перевода, строки в UI-примитивах. Скринридер к тому же читает английские имена русским голосом.
- **Стандарт:** WCAG 2.1 SC 3.1.2 (AA); PRODUCT.md: i18n EN/RU
- **Рекомендация:** Прогнать проверку ключей: каждый `t('x', 'Default')` должен иметь ключ в ru.json; запретить литеральные строки в JSX через eslint (i18next/no-literal-string) для components/ и routes/; перевести zod-сообщения через errorMap и мапить коды серверных ошибок на ключи.
- **Команда:** `$impeccable clarify`
- **Доказательства:** Объединены находки четырёх срезов; каждая подтверждена по коду с file:line. Пример: auth-формы используют строки zod без перевода (SignInForm.tsx:19-22), dialog.tsx:98 содержит литерал «Close».
- **Источник:** `entry:ru-a11y-labels-hardcoded-english`, `entry:auth-validation-and-server-errors-english`, `entry:error-fallback-key-object-and-missing-keys`, `dashboard-passport-journey:i18n-missing-keys-and-hardcoded-english`, `social-settings:i18n-hardcoded-english-and-missing-keys-in-social-settings`, `flights-import:import-progress-modal-english-strings`, `flights-import:flights-delete-flow-dialog-english`, `foundations:primitives-and-loader-hardcoded-english`

<details><summary>Доказательства срезов</summary>

- [entry:ru-a11y-labels-hardcoded-english] Проверил парсингом JSON: settings.toggleLanguage, onboarding.progress, errors.unauthorized отсутствуют в обеих локалях, поэтому вызовы t(key, default) всегда отдают английский default. about.title и common.close в ru.json существуют, но не используются. Atlas snapshots: «What is Kuuki?», «Toggle language», «Step 1 of 2» на русских экранах; смотрел onboarding-username-normalized-desktop.png («Will be saved as:»).
- [entry:auth-validation-and-server-errors-english] Читал SignInForm/RegisterForm: zod-сообщения литералами (стр. 20-21). grep показал passwordHint/passwordTooShort/passwordMismatch нигде не используются. auth.ts пробрасывает error.message сервера (стр. 30, 50, 76), apiClient.ts:241 берёт errObj.error || errObj.message. Atlas snapshot auth-register-validation-desktop: «Invalid email address», «Password must be at l…» рядом с «Пароль»; auth-signin-invalid-credentials: alert «Invalid email or password»; auth-activation-unavailable: alert «Account activation is temporarily unavailable». Серверные тексты Better Auth после снимка не менялись по смыслу, но auth-слой переехал; поведение пассthrough подтверждено текущим кодом.
- [entry:error-fallback-key-object-and-missing-keys] packages/shared/src/i18n/{en,ru}.json: errors.generic — объект {1,2,3}, errors.unauthorized отсутствует (проверил парсингом JSON). В коде три вызова t("errors.generic") без суффикса; useToast.ts:64 использует корректный errors.generic.1. Поведение i18next 25 при returnObjects=false — известное, в браузере не воспроизводил.
- [dashboard-passport-journey:i18n-missing-keys-and-hardcoded-english] Скрипт сопоставил все t('…') в scope с ru.json (29 пропусков; список в locations). Скриншоты подтверждают английские строки на ru-локали (dashboard-populated-desktop, dashboard-upcoming-banner-desktop, passport-populated-desktop, passport-country-picker-desktop).
- [social-settings:i18n-hardcoded-english-and-missing-keys-in-social-settings] Скрипт сверки ключей по файлам области; снимки settings-main-mobile.txt, profile-own-private-desktop.txt, settings-delete-wrong-password-desktop.txt.
- [flights-import:import-progress-modal-english-strings] grep по файлам: строки literal в useFlights.ts (90–164) и FlightProgressModal.tsx:305 без t().
- [flights-import:flights-delete-flow-dialog-english] Прочитан FlightsPage.tsx:83–90; полный паритет ключей не проверялся автоматически.
- [foundations:primitives-and-loader-hardcoded-english] Код перечисленных файлов прочитан; в snapshot settings-dark-theme-desktop.txt есть «Skip to main content» при ru-локали.

</details>

<a id="i18n-ru-plural-many-missing"></a>

#### [P1] В ru.json нет plural-форм `_many`: 0, 5–20, 25–30… показываются по-английски

`i18n-ru-plural-many-missing` · Целостность реализации · уверенность: verified · системная

- **Где:** `packages/shared/src/i18n/ru.json:730`, `packages/shared/src/i18n/ru.json:644`, `packages/shared/src/i18n/ru.json:640`, `packages/shared/src/i18n/ru.json:402`, `apps/web/src/lib/i18n.ts:30`, `packages/shared/src/i18n/ru.json:401`, `packages/shared/src/i18n/ru.json:415`, `packages/shared/src/i18n/ru.json:419`, `packages/shared/src/i18n/ru.json:422`
- **Экраны:** [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`settings-delete-wrong-password-desktop`](../public-social/images/settings-delete-wrong-password-desktop.png), [`leaderboard-flights-authenticated-desktop`](../public-social/images/leaderboard-flights-authenticated-desktop.png), [`flights-bulk-selected`](../flights-import/images/flights-bulk-selected.png), [`import-success`](../flights-import/images/import-success.png)
- **Влияние:** Для русского i18next выбирает категорию many для 0 и 5–20 (11–14, 25–30 и т. д.). Ни у одного из 36 счётных ключей её нет, поэтому строка падает на английский fallback: «5 flights», «Выбрано» без числа, счётчики рейтинга и импорта. Это затрагивает все экраны со счётчиками.
- **Стандарт:** WCAG 2.1 SC 3.1.2 (AA); PRODUCT.md: i18n EN/RU
- **Рекомендация:** Добавить `_many` для всех 36 ключей с `_few` в packages/shared/src/i18n/ru.json и тест, который проверяет, что каждому `_few` соответствует `_many`.
- **Команда:** `$impeccable harden`
- **Доказательства:** В ru.json 36 ключей `_few`, 36 `_other` и 0 `_many` (grep). Срез flights-import проверил это прогоном i18next приложения: count=0/5/11/25 дают английскую строку.
- **Источник:** `social-settings:ru-plural-many-category-missing-english-fallback`, `flights-import:plural-many-missing-ru`

<details><summary>Доказательства срезов</summary>

- [social-settings:ru-plural-many-category-missing-english-fallback] Скрипт: ru.json → 36 `_few`, 36 `_one`, 0 `_many`; node Intl.PluralRules(ru): 5→many, 11→many. Снимок settings-main-mobile.txt: «5 exports remaining today» при русском UI; скриншот leaderboard-authenticated: «Log 5 more flights…».
- [flights-import:plural-many-missing-ru] В ru.json найдены только _one/_few/_other (строки 170, 332, 401–424, 459). plural.mjs подтвердил падение на английский для count=0 и 5. Затронуты пакетные действия и итоги импорта.

</details>

<a id="mobile-nav-missing-leaderboard-and-own-profile"></a>

#### [P1] На mobile нет пути в рейтинг, а ссылки на собственный публичный профиль нет нигде

`mobile-nav-missing-leaderboard-and-own-profile` · Целостность реализации · уверенность: verified · системная

- **Где:** `apps/web/src/components/settings/ProfileSection.tsx:133`, `apps/web/src/components/common/AppHeader.tsx:122`, `apps/web/src/components/layout/MobileTabBar.tsx:32`, `apps/web/src/components/profile/ProfileSettingsDialog.tsx:61`, `apps/web/src/components/layout/MobileTabBar.tsx:32-39`, `apps/web/src/components/common/AppHeader.tsx:35-42`, `apps/web/src/App.tsx:126`
- **Экраны:** [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`profile-own-private-desktop`](../public-social/images/profile-own-private-desktop.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`flights-populated-mobile`](../flights-import/images/flights-populated-mobile.png), [`leaderboard-guest-mobile`](../public-social/images/leaderboard-guest-mobile.png)
- **Влияние:** Социальная часть продукта (рейтинг, публичный профиль) на телефоне недостижима из навигации; владелец не может посмотреть свой /fly/:username, кроме как набрать URL.
- **Стандарт:** PRODUCT.md: users browse on desktop or phone, optionally share a public profile
- **Рекомендация:** Добавить «Рейтинг» в мобильную навигацию (или в меню профиля в MobileHeader) и ссылку «Открыть мой профиль» в настройках и меню пользователя.
- **Команда:** `$impeccable adapt`
- **Доказательства:** MobileTabBar.tsx:32-39 содержит только dashboard/flights/import/passport/settings (проверено в основном потоке); ProfileSection.tsx:133 не ссылается на /fly/:username.
- **Источник:** `social-settings:own-public-profile-and-mobile-leaderboard-unreachable`, `foundations:leaderboard-missing-from-mobile-navigation`

<details><summary>Доказательства срезов</summary>

- [social-settings:own-public-profile-and-mobile-leaderboard-unreachable] grep по `fly/` и `/leaderboard`: ссылки только в App.tsx, LeaderboardTable (на чужие профили), ProfileHeader (share), orphan-компонентах; AppHeader.tsx:53 hidden на <sm; MobileTabBar.tsx:32-38 пять вкладок. Подтверждено отсутствие usage `profile.viewPublic`.
- [foundations:leaderboard-missing-from-mobile-navigation] rg "/leaderboard" по src: ссылка только в AppHeader.tsx:40; MobileTabBar.tsx прочитан; в трёх мобильных скриншотах таб-бар из 5 пунктов без Рейтинга.

</details>

<a id="accent-picker-overrides-tokens-fails-contrast"></a>

#### [P1] Акцент перекрывает OKLCH-токены одним hex для обеих тем; дефолтный red не проходит AA

`accent-picker-overrides-tokens-fails-contrast` · Темы и токены · уверенность: verified · системная

- **Где:** `apps/web/src/hooks/useAccentColor.ts:5`, `apps/web/src/hooks/useAccentColor.ts:23`, `apps/web/src/hooks/useAccentColor.ts:29-36`, `apps/web/src/index.css:60-61`, `apps/web/src/index.css:138-139`, `apps/web/src/components/ui/button.tsx:12`, `apps/web/src/components/common/FloatingActionButton.tsx:43`, `apps/web/src/components/common/AppHeader.tsx:73`, `apps/web/src/components/layout/MobileTabBar.tsx:64`, `apps/web/src/hooks/useAccentColor.ts:6-35`, `apps/web/src/hooks/useAccentColor.ts:39`, `apps/web/src/components/auth/SignInForm.tsx:115`, `apps/web/src/components/auth/RegisterForm.tsx:119-125`, `apps/web/src/components/auth/SignInForm.tsx:122-128`, `apps/web/src/components/auth/RegisterForm.tsx:130-136`, `apps/web/src/routes/AuthPage.tsx:134-136`, `apps/web/src/components/auth/ActivationRequestForm.tsx:37`, `apps/web/src/routes/LandingPage.tsx:104-109`, `apps/web/src/components/onboarding/ShowcaseModal.tsx:103-108`, `apps/web/src/index.css:345-352`
- **Экраны:** [`app-header-appearance-menu-desktop`](../public-social/images/app-header-appearance-menu-desktop.png), [`settings-dark-theme-desktop`](../public-social/images/settings-dark-theme-desktop.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`flights-populated-mobile`](../flights-import/images/flights-populated-mobile.png), [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`import-upload-mobile`](../flights-import/images/import-upload-mobile.png), [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-register-mobile`](../public-social/images/auth-register-mobile.png), [`landing-desktop`](../public-social/images/landing-desktop.png), [`landing-mobile`](../public-social/images/landing-mobile.png), [`landing-showcase-step2-desktop`](../public-social/images/landing-showcase-step2-desktop.png), [`onboarding-username-normalized-desktop`](../public-social/images/onboarding-username-normalized-desktop.png)
- **Влияние:** Терракота из DESIGN.md фактически никогда не показывается: useAccentColor по умолчанию ставит `--primary: #E54D5A` inline. Белый текст на основных кнопках — 3.79:1, `text-primary` ссылки — 3.63:1; у 5 из 8 акцентов кнопки ниже 4.5:1 (yellow 1.53:1). Один hex не адаптируется к тёмной теме.
- **Стандарт:** WCAG 2.1 SC 1.4.3 (AA); DESIGN.md: terracotta primary (light) / amber (dark)
- **Рекомендация:** Задать акценты как пары OKLCH-токенов для light и dark (через `[data-accent]` в index.css), подобрать L так, чтобы foreground давал ≥4.5:1; сделать терракоту дефолтом; убрать inline setProperty.
- **Команда:** `$impeccable colorize`
- **Доказательства:** useAccentColor.ts:6-13 и :23 (DEFAULT_COLOR='red'), applyAccentColor пишет inline `--primary`. Контраст пересчитан в основном потоке: белый на #E54D5A = 3.79:1, #E54D5A на фоне = 3.63:1.
- **Источник:** `foundations:accent-picker-overrides-tokens-fails-contrast`, `entry:accent-colors-fail-contrast-on-primary-surfaces`

<details><summary>Доказательства срезов</summary>

- [foundations:accent-picker-overrides-tokens-fails-contrast] Прочитан useAccentColor.ts и index.css; пересчитан WCAG-контраст через OKLCH→sRGB скрипт (scratchpad foundations_work/contrast.py) для всех 8 акцентов x light/dark. Пиксели скриншотов подтверждают дефолт: кнопка auth-signin-mobile #e5515d→#e96c78, белый текст 3.71→3.05:1; settings-main-mobile и flights-populated-mobile показывают красный акцент как активный.
- [entry:accent-colors-fail-contrast-on-primary-surfaces] Посчитал OKLCH/sRGB-скриптом (scratchpad/entry/c.py). Белый на #E54D5A (акцент red по умолчанию, DEFAULT_COLOR) = 3.79:1; blue 2.57, orange 2.36, coral 2.88, purple 3.05 (cyan/teal/yellow проходят). Текст --primary на card: red 3.68 (светлая) / 4.22 (тёмная), остальные акценты в светлой теме 1.55-2.96. Токен terracotta oklch(.55 .12 25) даёт 5.0:1, но applyAccentColor пишет hex в documentElement.style и initializeAccentColor вызывается в main.tsx до рендера. Кнопка aura-button к тому же имеет градиент к primary с 0.8 alpha: конец градиента белый текст 2.97:1 (светлая) на красном. Смотрел auth-signin-mobile.png и landing-mobile.png: кнопки красные со светлым текстом. Скоуп акцентной системы шире entry, но все entry-экраны затронуты.

</details>

<a id="aura-auth-inputs-broken-light-theme"></a>

#### [P1] `.aura-input` / `.aura-button` на входе и регистрации ломаются в светлой теме: rgba-литералы, стекло, градиент

`aura-auth-inputs-broken-light-theme` · Темы и токены · уверенность: verified · системная

- **Где:** `apps/web/src/index.css:332-343`, `apps/web/src/index.css:345-371`, `apps/web/src/components/auth/SignInForm.tsx:82`, `apps/web/src/components/auth/SignInForm.tsx:106`, `apps/web/src/components/auth/SignInForm.tsx:115`, `apps/web/src/components/auth/RegisterForm.tsx:86`, `apps/web/src/components/auth/RegisterForm.tsx:110`, `apps/web/src/components/auth/RegisterForm.tsx:122`, `apps/web/src/index.css:313-371`, `apps/web/src/routes/AuthPage.tsx:44-45`, `apps/web/src/routes/AuthPage.tsx:63`
- **Экраны:** [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`auth-register-mobile`](../public-social/images/auth-register-mobile.png), [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-register-desktop`](../public-social/images/auth-register-desktop.png)
- **Влияние:** Первый экран продукта в светлой теме: поля — серые плашки без видимой границы (1.6:1), placeholder 2.94:1, кнопка 3.05–3.71:1, на каждом поле backdrop-blur. Нарушает «Tokens over literals» и запрет стекла по умолчанию.
- **Стандарт:** WCAG 2.1 SC 1.4.3 / 1.4.11 (AA); DESIGN.md: glass only for toasts, tokens over literals
- **Рекомендация:** Заменить .aura-* на стандартные Input/Button с токенами `--input`, `--border`, `--primary`; убрать градиент и backdrop-blur; проверить placeholder ≥4.5:1.
- **Команда:** `$impeccable polish`
- **Доказательства:** index.css:313-371 (rgba(0,0,0,.2), rgba(255,255,255,.1), gradient, backdrop-filter); контраст посчитан в двух срезах; скриншот auth-signin-desktop.
- **Источник:** `foundations:aura-input-aura-button-light-theme-broken`, `entry:auth-input-light-theme-placeholder-and-boundary-contrast`, `entry:aura-button-gradient-literals-and-glass`

<details><summary>Доказательства срезов</summary>

- [foundations:aura-input-aura-button-light-theme-broken] Просмотрен auth-signin-mobile.png; измерены пиксели: фон поля #c8cacb, текст плейсхолдера #6e7278 (2.94:1), кнопка #e5515d/#e96c78. Классы найдены в SignInForm.tsx и RegisterForm.tsx (rg). Скриншот сделан на 3156841; формы входа менялись в 1303485, но .aura-* и их вызовы остаются в текущем коде.
- [entry:auth-input-light-theme-placeholder-and-boundary-contrast] index.css:332-337: background rgba(0,0,0,.2), border rgba(255,255,255,.1), backdrop-filter blur(10px). Посчитал: светлая тема — поле 1.60:1 к card, placeholder (muted-foreground) на этой плашке 2.94:1; тёмная — поле 1.08:1 к card. Смотрел auth-register-mobile.png и auth-signin-mobile.png: серые плашки #cbcbcc с блёклым placeholder и «••••••••», похожим на введённое значение. Класс border-0 в className (SignInForm:82, RegisterForm:86) убирает любую рамку.
- [entry:aura-button-gradient-literals-and-glass] index.css:345-371: linear-gradient(135deg, var(--primary), oklch(from var(--primary) l c h / 0.8)), ::after-блик, hover translateY(-1px), box-shadow rgba(var(--primary),.5). Смотрел auth-signin-desktop (тёмная) и auth-signin-mobile (светлая): градиент заметен справа, поле — серая плашка. Детектор (detector.json) этих строк не отметил. Невалидность box-shadow выведена из синтаксиса, в devtools не проверял.

</details>

<a id="badge-toast-no-live-region-unnamed-dismiss"></a>

#### [P1] Toast нового достижения не озвучивается, кнопка закрытия без имени, автозакрытие 6 с

`badge-toast-no-live-region-unnamed-dismiss` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/badges/BadgeNotificationToast.tsx:56`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:118`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:40`
- **Экраны:** в атласе не снято
- **Влияние:** Контейнер без role="status"/aria-live — скринридер не узнает о награде; кнопка X (h-8 w-8, svg) не имеет aria-label/текста; пауза таймера при hover/focus отсутствует, через 6 с уведомление исчезает (в фокус никто не попадает). Заголовок содержит эмодзи 🎉 в тексте перевода.
- **Стандарт:** WCAG 2.1 SC 4.1.3 (AA); SC 4.1.2 (A); SC 2.2.1 Timing Adjustable (A)
- **Рекомендация:** role="status" aria-live="polite" на обёртку (смонтировать её постоянно, менять содержимое), aria-label={t("common.close")} на X, пауза таймера на hover/focus-within, min 44×44; эмодзи вынести в aria-hidden.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан BadgeNotificationToast.tsx целиком: ни role, ни aria-*; Button size="icon" с className h-8 w-8 перекрывает 44px. Состояние в атласе отсутствует (триггерится локальным кэшем).
- **Источник:** `social-settings:badge-toast-no-live-region-unnamed-dismiss`

<a id="delete-flow-error-and-progress-not-announced"></a>

#### [P1] В диалоге удаления аккаунта ошибка пароля и шаг «Удаляем…» не озвучиваются

`delete-flow-error-and-progress-not-announced` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/settings/DeleteAccountDialog.tsx:235`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:248`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:273`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:117`
- **Экраны:** [`settings-delete-wrong-password-desktop`](../public-social/images/settings-delete-wrong-password-desktop.png), [`settings-delete-password-desktop`](../public-social/images/settings-delete-password-desktop.png), [`settings-delete-success-disposable-desktop`](../public-social/images/settings-delete-success-disposable-desktop.png)
- **Влияние:** Сообщение «Неверный пароль» — обычный <p> без role="alert"/aria-live, у input нет aria-invalid и aria-describedby (в снимке нет alert-узла). Шаг deleting — только спиннер Loader2 без текста статуса и без role=status; при ошибке контент перемонтируется (deleting→error) и фокус сбрасывается на контейнер диалога. Успех удаления — короткий toast, после редиректа на регистрацию постоянного подтверждения нет (снимок сделан уже после исчезновения toast). Пользователь скринридера не узнаёт, что пароль неверен или что удаление идёт/завершилось.
- **Стандарт:** WCAG 2.1 SC 4.1.3 Status Messages (AA); SC 3.3.1 Error Identification (A); SC 1.3.1
- **Рекомендация:** role="alert" на блок ошибки + aria-invalid/aria-describedby на input, возврат фокуса в поле при ошибке; в шаге deleting — `role="status"` с текстом «Удаляем…» и aria-busy на диалоге; после успеха показать persistent-страницу/баннер на «/» с подтверждением (или `?deleted=1`).
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан DeleteAccountDialog.tsx; снимок settings-delete-wrong-password-desktop.txt: `paragraph "Неверный пароль…"` без роли, `textbox` без invalid/describedby; manifest notes: toast исчез к моменту PNG.
- **Источник:** `social-settings:delete-flow-error-and-progress-not-announced`

<a id="flight-table-edit-and-sort-keyboard"></a>

#### [P1] В таблице рейсов кнопка редактирования без имени, сортировка по заголовкам недоступна с клавиатуры

`flight-table-edit-and-sort-keyboard` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/flights/FlightTable.tsx:54`, `apps/web/src/components/flights/FlightTable.tsx:62`, `apps/web/src/components/flights/FlightTable.tsx:350`, `apps/web/src/components/flights/FlightTable.tsx:258`
- **Экраны:** [`flights-populated-desktop`](../flights-import/images/flights-populated-desktop.png), [`flights-bulk-selected`](../flights-import/images/flights-bulk-selected.png)
- **Влияние:** TableHead с onClick не имеет role=button/tabIndex/aria-sort (хотя есть focus-visible ring, он никогда не сработает); Pencil-кнопка без aria-label (в отличие от FlightCardActions); все чекбоксы строк имеют одинаковую метку «Select flight» без маршрута.
- **Стандарт:** WCAG 2.1 SC 2.1.1, 4.1.2, 1.3.1 (A), 2.4.6
- **Рекомендация:** Вложить кнопку внутрь th (<button> с aria-sort на th), добавить aria-label «Изменить рейс {origin}–{destination}» и «Выбрать рейс {origin}–{destination}, {date}».
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан FlightTable.tsx:54–70 (onClick на TableHead, без tabIndex), 258 (generic aria-label), 350–358 (Button size=icon без label). Снапшот flights-populated-desktop.txt.
- **Источник:** `flights-import:flight-table-edit-and-sort-keyboard`

<a id="ground-visit-delete-hidden-until-hover"></a>

#### [P1] Кнопка удаления наземного визита видна только при hover; подтверждающие кнопки без имён

`ground-visit-delete-hidden-until-hover` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/passport/StampPopup.tsx:74-82`, `apps/web/src/components/passport/StampPopup.tsx:56-71`, `apps/web/src/components/passport/StampPopup.tsx:31`
- **Экраны:** [`passport-delete-visit-confirm-desktop`](../dashboard-passport-journey/images/passport-delete-visit-confirm-desktop.png), [`passport-stamp-popup-atlas-account-desktop`](../dashboard-passport-journey/images/passport-stamp-popup-atlas-account-desktop.png), [`passport-stamp-popup-mobile`](../dashboard-passport-journey/images/passport-stamp-popup-mobile.png), [`passport-stamp-details-test-traveler`](../dashboard-passport-journey/images/passport-stamp-details-test-traveler.png)
- **Влияние:** Кнопка-корзина имеет opacity-0 group-hover:opacity-100 и нет focus-visible/focus-within вариантов: на сенсорных устройствах hover не существует (кнопка невидима, нажать можно только «вслепую»), при навигации с клавиатуры фокус попадает на невидимый элемент. После нажатия появляются две иконочные кнопки (X и корзина, h-6 w-6) без aria-label/sr-only — скринридер называет их «button». Удаление записи — необратимое действие.
- **Стандарт:** WCAG 2.1 SC 2.4.7 (AA), SC 4.1.2 (A), SC 1.3.1; DESIGN.md: 44×44 touch targets
- **Рекомендация:** Сделать корзину всегда видимой (muted) либо группу `group-focus-within:opacity-100 [@media(hover:none)]:opacity-100`; добавить aria-label «Отмена» / «Удалить визит» подтверждающим кнопкам и текстовые подписи вместо одних иконок; увеличить до 44px (глобальное правило index.css:1038 уже поднимает button до 44px на touch, но видимости это не решает).
- **Команда:** `$impeccable harden`
- **Доказательства:** Код StampPopup.tsx:53-84 прочитан (в «confirm»-режиме у обеих кнопок нет текста; в обычном — только sr-only у первой). Снимки passport-delete-visit-confirm-desktop показывают состояние уже с наведением. Реальный сенсорный ввод не проверялся.
- **Источник:** `dashboard-passport-journey:ground-visit-delete-hidden-until-hover`

<a id="import-dropzone-keyboard-inaccessible"></a>

#### [P1] Дропзона загрузки — Card с onClick: недоступна с клавиатуры, input скрыт, поле текста без метки

`import-dropzone-keyboard-inaccessible` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/import/ImportUpload.tsx:355`, `apps/web/src/components/import/ImportUpload.tsx:358`, `apps/web/src/components/import/ImportUpload.tsx:360`, `apps/web/src/components/import/ImportUpload.tsx:365`, `apps/web/src/components/import/ImportUpload.tsx:328`
- **Экраны:** [`import-upload-desktop`](../flights-import/images/import-upload-desktop.png), [`import-upload-mobile`](../flights-import/images/import-upload-mobile.png)
- **Влияние:** Выбрать файл можно только кликом по div (нет role=button, tabIndex, Enter/Space); <input type=file class=hidden> (display:none) недостижим для Tab. Textarea без label/aria-label, подсказка — только placeholder; крестики очистки имеют только title. Клавиатурный/скринридер-пользователь не может загрузить файл.
- **Стандарт:** WCAG 2.1 SC 2.1.1 (A), 4.1.2, 3.3.2 (A), 1.3.1
- **Рекомендация:** Сделать дропзону <label htmlFor> + визуально скрытый (sr-only) input либо <button> с вызовом click(); добавить aria-label для textarea и крестиков (aria-label вместо title), объявлять выбранный файл через aria-live.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан ImportUpload.tsx:328–404: Card onClick без role/tabIndex, input className="hidden", Textarea без Label, X-кнопки с title. Снапшоты import-upload-desktop.txt/mobile.
- **Источник:** `flights-import:import-dropzone-keyboard-inaccessible`

<a id="import-progress-modal-not-a-dialog"></a>

#### [P1] FlightProgressModal — самописная «модалка» без role=dialog, фокус-ловушки и aria-live

`import-progress-modal-not-a-dialog` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/import/FlightProgressModal.tsx:204`, `apps/web/src/components/import/FlightProgressModal.tsx:207`, `apps/web/src/components/import/FlightProgressModal.tsx:214`
- **Экраны:** [`import-parsing-text`](../flights-import/images/import-parsing-text.png)
- **Влияние:** fixed inset-0 div без role=dialog/aria-modal/aria-labelledby; фокус остаётся на форме за оверлеем, Tab уходит под модалку, Escape ничего не делает, смена стадий («Reading document», «Flights found») не объявляется скринридеру. Парсинг идёт десятки секунд — слепой пользователь не знает, что происходит.
- **Стандарт:** WCAG 2.1 SC 4.1.2, 4.1.3 (AA), 2.4.3, 2.1.2
- **Рекомендация:** Перевести на Radix Dialog (как остальные диалоги) или добавить role=dialog, aria-modal, focus trap; добавить role=status/aria-live=polite для текущей стадии и итога («Найдено N рейсов»).
- **Команда:** `$impeccable harden`
- **Доказательства:** grep по FlightProgressModal.tsx и ImportPage.tsx: нет role=, aria-live, aria-modal. Прочитан разметка 204–214 (fixed + backdrop-blur-sm/-lg).
- **Источник:** `flights-import:import-progress-modal-not-a-dialog`

<a id="import-row-checkbox-and-icon-buttons-unlabeled"></a>

#### [P1] В строках ревью импорта чекбокс, раскрытие и удаление не имеют доступных имён

`import-row-checkbox-and-icon-buttons-unlabeled` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/import/FlightEditRow.tsx:171`, `apps/web/src/components/import/FlightEditRow.tsx:283`, `apps/web/src/components/import/FlightEditRow.tsx:295`
- **Экраны:** [`import-review-mobile`](../flights-import/images/import-review-mobile.png), [`import-review-expanded`](../flights-import/images/import-review-expanded.png)
- **Влияние:** Скринридер объявляет «checkbox», «button», «button» без имени и без контекста рейса; при 10+ рейсах пользователь не отличит строки. Кнопка удаления (Trash2) не имеет aria-label и title вообще; кнопка раскрытия не сообщает aria-expanded.
- **Стандарт:** WCAG 2.1 SC 4.1.2 (A), SC 1.3.1 (A), SC 2.5.3
- **Рекомендация:** Добавить aria-label с номером/маршрутом рейса («Выбрать рейс SVO–LED, 12 мая», «Удалить рейс …», «Изменить рейс …»), aria-expanded и aria-controls для раскрытия, связать с id панели.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан FlightEditRow.tsx: Checkbox без aria-label (171–176), Button size=icon с иконками без текста (283–302). Акссесибилити-снапшот import-review-mobile показывает безымянные checkbox/button.
- **Источник:** `flights-import:import-row-checkbox-and-icon-buttons-unlabeled`

<a id="import-row-collapsed-form-focusable"></a>

#### [P1] Свернутая форма редактирования строки остаётся в порядке Tab и дереве доступности

`import-row-collapsed-form-focusable` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/import/FlightEditRow.tsx:306`
- **Экраны:** [`import-review-mobile`](../flights-import/images/import-review-mobile.png), [`import-review-expanded`](../flights-import/images/import-review-expanded.png)
- **Влияние:** Панель скрыта только max-h-0 + opacity-0 + overflow-hidden; поля внутри остаются фокусируемыми и читаются скринридером. Клавиатурный пользователь «теряет» фокус в невидимых полях на каждой строке (по 6–8 полей × N рейсов).
- **Стандарт:** WCAG 2.1 SC 2.4.3 (A), SC 2.4.7 (AA), SC 1.3.1
- **Рекомендация:** Добавить inert (или hidden / visibility:hidden с задержкой) пока expanded=false, id + aria-controls на кнопке; анимировать через grid-template-rows 0fr→1fr вместо max-height.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан FlightEditRow.tsx:306–312: нет inert/hidden/aria-hidden. Снапшот import-review-expanded содержит поля формы.
- **Источник:** `flights-import:import-row-collapsed-form-focusable`

<a id="leaderboard-category-tabs-icon-only-unnamed-on-mobile"></a>

#### [P1] Вкладки категорий рейтинга на mobile — безымянные кнопки без состояния

`leaderboard-category-tabs-icon-only-unnamed-on-mobile` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/leaderboard/CategoryTabs.tsx:29`, `apps/web/src/components/leaderboard/CategoryTabs.tsx:40`
- **Экраны:** [`leaderboard-guest-mobile`](../public-social/images/leaderboard-guest-mobile.png), [`leaderboard-flights-authenticated-desktop`](../public-social/images/leaderboard-flights-authenticated-desktop.png)
- **Влияние:** На ширине <640px подпись категории скрыта (`hidden sm:inline` = display:none), у svg нет aria-label: пять кнопок читаются скринридером как просто «button». Зрячий пользователь на mobile тоже угадывает категории по иконкам. Выбранная категория передаётся только фоном (нет aria-pressed/aria-current/role=tab), высота кнопки ~36px.
- **Стандарт:** WCAG 2.1 SC 4.1.2 Name, Role, Value (A); SC 1.1.1 (A); SC 2.5.5 (AAA)/DESIGN.md: 44×44 touch targets
- **Рекомендация:** Сделать сегмент настоящими tabs (role=tablist/tab, aria-selected, roving tabindex, стрелки) либо кнопками с aria-pressed; подпись оставить в DOM (`sr-only` вместо `hidden`) или выводить короткие подписи под иконками; min-h-11; связать с таблицей через aria-controls/tabpanel.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Прочитан CategoryTabs.tsx целиком; в снимке leaderboard-guest-mobile.txt пять узлов `button [ref=e263..e267]` без имени; скриншот mobile — только иконки. Стрелочной навигации в коде нет.
- **Источник:** `social-settings:leaderboard-category-tabs-icon-only-unnamed-on-mobile`

<a id="leaderboard-top3-rank-icon-only-no-text"></a>

#### [P1] Места 1–3 в таблице рейтинга выражены только иконкой без текста

`leaderboard-top3-rank-icon-only-no-text` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/leaderboard/LeaderboardTable.tsx:27`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:121`
- **Экраны:** [`leaderboard-flights-populated-simulated-desktop`](../public-social/images/leaderboard-flights-populated-simulated-desktop.png)
- **Влияние:** В ячейке «Rank» для первых трёх строк рендерится только Crown/Medal (lucide, aria-hidden) — число места не выводится в DOM. Скринридер читает пустую ячейку; цвет медалей (yellow-500 / slate-400 на светлом фоне 1.83:1 / 2.52:1) не проходит 3:1 для значимой графики. Уникальный смысл «1/2/3» теряется.
- **Стандарт:** WCAG 2.1 SC 1.1.1 (A), SC 1.3.1 (A), SC 1.4.11 Non-text Contrast (AA)
- **Рекомендация:** Выводить число во всех строках (`<span class="sr-only">1</span>` или видимое число рядом с иконкой); иконки декоративные + токен вместо палитры; scope="col" для th.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан RankBadge (return без текста для rank 1–3). Контраст посчитан скриптом ss_contrast.py: yellow-500 1.83, slate-400 2.52, amber-600 3.06 к фону light. Скриншот simulated (данные синтетические, структура реальная).
- **Источник:** `social-settings:leaderboard-top3-rank-icon-only-no-text`

<a id="mobile-filters-toggle-not-disclosure"></a>

#### [P1] Мобильный переключатель фильтров без aria-expanded, нельзя свернуть при активных фильтрах, а скрытые контролы остаются в tab-порядке

`mobile-filters-toggle-not-disclosure` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/flights/FlightFilters.tsx:380-393`, `apps/web/src/components/flights/FlightFilters.tsx:191`, `apps/web/src/components/flights/FlightFilters.tsx:397-433`
- **Экраны:** [`dashboard-filters-expanded-mobile`](../dashboard-passport-journey/images/dashboard-filters-expanded-mobile.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`dashboard-filtered-2025-desktop`](../dashboard-passport-journey/images/dashboard-filtered-2025-desktop.png)
- **Влияние:** Кнопка «Фильтры» (h-8, 32px) не имеет aria-expanded/aria-controls — скринридер не знает состояние. effectiveOpen = filtersOpen || hasActiveFilters, а onClick делает setFiltersOpen(!effectiveOpen): при любом активном фильтре панель принудительно открыта и кнопка «не работает». В свёрнутом виде панель — grid-rows-[0fr] + overflow-hidden без hidden/inert, поэтому 2 поля и 4 select остаются доступными для Tab и скринридера, а фокус уходит на невидимые элементы.
- **Стандарт:** WCAG 2.1 SC 4.1.2 (A), SC 2.4.7 (AA), SC 2.4.3 (A)
- **Рекомендация:** Добавить aria-expanded={effectiveOpen} и aria-controls, id на панель; использовать hidden/inert (visibility:hidden с transition на grid-rows) для свёрнутого состояния; отделить «автооткрытие» от ручного сворачивания (например, показывать счётчик активных фильтров на кнопке и не блокировать закрытие). Высоту кнопки поднять до 44px.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код FlightFilters.tsx:180-191, 371-436 прочитан. Скриншот dashboard-filters-expanded-mobile подтверждает визуальный размер кнопки (~32px по высоте). Поведение при Tab не запускалось.
- **Источник:** `dashboard-passport-journey:mobile-filters-toggle-not-disclosure`

<a id="auth-form-disabled-during-session-bootstrap"></a>

#### [P1] Поля и кнопка входа блокируются на время проверки сессии; при недоступном API форма заблокирована бессрочно

`auth-form-disabled-during-session-bootstrap` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/auth/SignInForm.tsx:81`, `apps/web/src/components/auth/SignInForm.tsx:105`, `apps/web/src/components/auth/SignInForm.tsx:115-116`, `apps/web/src/components/auth/RegisterForm.tsx:85`, `apps/web/src/components/auth/RegisterForm.tsx:109`, `apps/web/src/components/auth/RegisterForm.tsx:121-124`, `apps/web/src/stores/authStore.ts:143`, `apps/web/src/stores/authStore.ts:146-171`
- **Экраны:** [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-register-desktop`](../public-social/images/auth-register-desktop.png), [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png)
- **Влияние:** Initial isLoading=true из authStore подставляется в disabled и в подпись кнопки: до ответа /api/auth/me пользователь не может печатать, автозаполнение менеджера паролей промахивается, а кнопка на экране входа уже подписана «Входим…» (на регистрации «Загрузка…»), хотя ничего не отправлялось. Если /api/auth/me падает по сети, isLoading остаётся true, повтор идёт с backoff до 15 с, сообщения об ошибке нет. Кроме того, disabled на самом поле при сабмите сбрасывает фокус на body, и после ошибки клавиатурный пользователь начинает обход заново.
- **Стандарт:** WCAG 2.1 SC 2.4.3 Focus Order (A), 3.3.1 (A); устойчивость формы без сети
- **Рекомендация:** Развести isLoading (bootstrap) и isSubmitting (локальный стейт формы); блокировать только кнопку по isSubmitting и оставлять поля editable (readOnly/aria-disabled), не трогать фокус; при провале bootstrap показывать Alert «Нет связи, повторяем…» вместо молчаливой блокировки.
- **Команда:** `$impeccable harden`
- **Доказательства:** authStore.ts:143 isLoading: true; initialize() (146-171) в catch снова ставит isLoading:true и retryIdentityLookup. useAuth() отдаёт store.isLoading напрямую; обе формы кладут его в disabled и в t("auth.signingIn")/t("common.loading"). Состояние появилось после перехода на Better Auth (в снимках /me уже ответил, форма активна), поэтому в atlas не видно; в браузере не воспроизводил.
- **Источник:** `entry:auth-form-disabled-during-session-bootstrap`

<a id="authpage-no-redirect-for-signed-in-user"></a>

#### [P1] Авторизованный пользователь на «/» видит форму регистрации (в том числе при старте PWA)

`authpage-no-redirect-for-signed-in-user` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/routes/AuthPage.tsx:24-38`, `apps/web/src/App.tsx:67`, `apps/web/public/manifest.webmanifest:5`
- **Экраны:** [`auth-register-desktop`](../public-social/images/auth-register-desktop.png), `auth-signin-success-source-only`
- **Влияние:** start_url PWA = «/», а AuthPage не проверяет сессию: человек, который уже вошёл, при каждом запуске установленного приложения или заходе на корень сайта видит «Создать аккаунт» и должен вручную идти в /dashboard. ProtectedRoute перенаправляет только неавторизованных на «/».
- **Стандарт:** Целостность навигации; PRODUCT.md (журнал, а не повторная регистрация)
- **Рекомендация:** В AuthPage читать useAuth(): при isAuthenticated делать <Navigate to="/dashboard" replace /> (после isInitialized), до этого показывать LoadingScreen или каркас без полей.
- **Команда:** `$impeccable harden`
- **Доказательства:** AuthPage.tsx не обращается к useAuth/store и не содержит Navigate; единственный navigate("/dashboard") в handleSuccess. grep по src: isAuthenticated используется только в ProtectedRoute. manifest.webmanifest:5 start_url "/" display standalone. В браузере не воспроизводил.
- **Источник:** `entry:authpage-no-redirect-for-signed-in-user`

<a id="import-error-quota-vs-model-indistinguishable"></a>

#### [P1] Ошибки парсинга (квота ИИ, модель недоступна, таймаут сервера) сводятся к одному общему сообщению

`import-error-quota-vs-model-indistinguishable` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/routes/ImportPage.tsx:179`, `apps/web/src/routes/ImportPage.tsx:187`, `apps/web/src/routes/ImportPage.tsx:189`, `functions/api/import/parse.ts`, `functions/api/import/_provider.ts`
- **Экраны:** [`import-error-provider-quota`](../flights-import/images/import-error-provider-quota.png)
- **Влияние:** Клиент анализирует строку message («timed out», «format», «Invalid»), игнорируя ApiError.code/status, хотя сервер отдаёт разные коды 502/503/504 и тексты. Пользователь при исчерпанной квоте и при ненайденной модели видит одно и то же «не удалось разобрать», не понимает, ждать, повторить или писать в поддержку. Сопоставление по подстроке ломается при локализации сообщений.
- **Стандарт:** WCAG 2.1 SC 3.3.1 (A) — идентификация ошибки; DESIGN.md: честные сообщения об ошибках
- **Рекомендация:** Использовать error instanceof ApiError и switch по code/status → ключи errors.import.quota / providerUnavailable / timeout / invalidFormat; для квоты показывать время повтора и убрать кнопку «Повторить».
- **Команда:** `$impeccable clarify`
- **Доказательства:** Прочитан ImportPage.tsx:179–198 (проверка includes) и серверные parse.ts/_provider.ts (разные коды). Скриншот import-error-provider-quota. Реальные ответы провайдера не воспроизводились.
- **Источник:** `flights-import:import-error-quota-vs-model-indistinguishable`

<a id="import-parse-error-shows-empty-state"></a>

#### [P1] После ошибки парсинга показывается «Рейсов не найдено» вместе с алертом об ошибке

`import-parse-error-shows-empty-state` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/routes/ImportPage.tsx:193`, `apps/web/src/routes/ImportPage.tsx:197`, `apps/web/src/routes/ImportPage.tsx:410`, `apps/web/src/components/import/ImportReview.tsx:183`, `apps/web/src/components/import/ImportReview.tsx:195`
- **Экраны:** [`import-error-provider-quota`](../flights-import/images/import-error-provider-quota.png)
- **Влияние:** При ошибке setStep('review') с пустым списком ImportReview рендерит empty state «No flights found / We couldn't extract flights from this document» под красным Alert. Противоречие: сервис упал, а UI утверждает, что в документе нет рейсов — пользователь выбросит нормальный файл.
- **Стандарт:** WCAG 2.1 SC 3.3.1, 3.3.3; DESIGN.md: honest error state
- **Рекомендация:** При parseError оставаться на шаге upload (с сохранением файла/текста и кнопкой «Повторить») либо передавать в ImportReview флаг error и не показывать empty state.
- **Команда:** `$impeccable clarify`
- **Доказательства:** Прочитаны ImportPage.tsx:193–198 и ImportReview.tsx:183–199; скриншот import-error-provider-quota показывает оба блока.
- **Источник:** `flights-import:import-parse-error-shows-empty-state`

<a id="onboarding-profile-url-preview-wrong"></a>

#### [P1] Шаг имени пользователя обещает адрес kuuki.app/@имя, которого в приложении нет

`onboarding-profile-url-preview-wrong` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/onboarding/UsernamePicker.tsx:150-155`, `apps/web/src/App.tsx:127`, `apps/web/src/components/profile/ProfileHeader.tsx:39`, `apps/web/src/components/profile/ProfileSettingsDialog.tsx:61`
- **Экраны:** [`onboarding-username-normalized-desktop`](../public-social/images/onboarding-username-normalized-desktop.png), [`onboarding-username-desktop`](../public-social/images/onboarding-username-desktop.png)
- **Влияние:** Пользователь запоминает и делится ссылкой «kuuki.app/@journey-demo», а реальный публичный профиль живёт по /fly/journey-demo (на актуальном origin). Обещанная ссылка не откроет профиль.
- **Стандарт:** Целостность контента (PRODUCT.md: «точные данные»)
- **Рекомендация:** Строить превью от window.location.origin и реального маршрута: `${origin}/fly/${username}` (общая функция profileUrl(username), которую используют ProfileHeader, ProfileSettingsDialog и UsernamePicker).
- **Команда:** `$impeccable clarify`
- **Доказательства:** UsernamePicker.tsx:154 литерал kuuki.app/@{normalizedUsername}. Маршрут профиля App.tsx:127 /fly/:username; ProfileHeader.tsx:39 и ProfileSettingsDialog.tsx:61 собирают `${origin}/fly/${username}`. public/_redirects содержит только SPA-fallback, правила для /@ нет. Смотрел onboarding-username-normalized-desktop.png: карточка «kuuki.app/@journey-demo». Факт принадлежности домена kuuki.app не проверял.
- **Источник:** `entry:onboarding-profile-url-preview-wrong`

<a id="dashboard-mobile-horizontal-overflow-442px"></a>

#### [P1] Мобильный Dashboard шире экрана: карточки статистики выпирают за правый край (442px при viewport 390)

`dashboard-mobile-horizontal-overflow-442px` · Адаптивность · уверенность: verified

- **Где:** `apps/web/src/components/dashboard/MicroBadgeStatCard.tsx:91-98`, `apps/web/src/routes/DashboardPage.tsx:266`, `apps/web/src/routes/DashboardPage.tsx:278`
- **Экраны:** [`dashboard-populated-full-mobile`](../dashboard-passport-journey/images/dashboard-populated-full-mobile.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png)
- **Влияние:** В карточке значение (font-mono text-2xl, «141,255 km») и подпись («Расстояние», «Авиакомпании») стоят в одной строке flex items-baseline без wrap/min-w-0 на подписи. На 390px в сетке grid-cols-2 они не помещаются: подпись вылезает за карточку и создаёт горизонтальный скролл страницы (полный скриншот 442×2399). Эффект сильнее для русских подписей и длинных значений.
- **Стандарт:** WCAG 2.1 SC 1.4.10 Reflow (AA); DESIGN.md: responsive, 44px targets
- **Рекомендация:** В MicroBadgeStatCard перейти на flex-wrap gap-x-1.5 (подпись под значением на узком экране) или контейнерные запросы, добавить min-w-0/truncate; на <sm сделать hero-сетку 1 колонкой. Проверить на 320px и с увеличенным шрифтом.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Просмотрен dashboard-populated-full-mobile (442×2399; «Расстояние» и «Авиакомпании» обрезаны/выходят за карточку) и dashboard-populated-mobile; код MicroBadgeStatCard.tsx и DashboardPage.tsx:266 прочитан. Скриншот сделан при коммите 3156841 — но файлы в scope изменились мало (подтверждено чтением текущего кода).
- **Источник:** `dashboard-passport-journey:dashboard-mobile-horizontal-overflow-442px`

<a id="import-row-mobile-overflow"></a>

#### [P1] Строка ревью импорта на 390px: фиксированная ширина колонок (~580px) переполняет контейнер ~310px

`import-row-mobile-overflow` · Адаптивность · уверенность: verified

- **Где:** `apps/web/src/components/import/FlightEditRow.tsx:168`, `apps/web/src/components/import/FlightEditRow.tsx:178`, `apps/web/src/components/import/FlightEditRow.tsx:184`, `apps/web/src/components/import/FlightEditRow.tsx:258`, `apps/web/src/components/import/FlightEditRow.tsx:266`
- **Экраны:** [`import-review-mobile`](../flights-import/images/import-review-mobile.png)
- **Влияние:** Основная строка — один flex-ряд с w-16 + w-32 + flex-1(min-w-0, с двумя w-8 линиями) + w-24 + w-28 + две кнопки и gap-4; содержимое не сворачивается и обрезается/вытесняет кнопки раскрытия и удаления за правый край. На телефоне нельзя нормально проверить маршрут, дату и удалить строку.
- **Стандарт:** WCAG 2.1 SC 1.4.10 Reflow (AA); DESIGN.md: mobile 390px
- **Рекомендация:** Перевести строку в сетку: на <sm — две строки (маршрут/дата сверху, метаданные и действия снизу), убрать фиксированные w-*, скрывать второстепенные колонки (airline name, confidence) на мобильном.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Расчёт по классам: ≈64+128+(min-w-0 flex)+96+112+2×32+gaps(16×6) ≈ 580px против ~310px доступных (390 − отступы). Скриншот import-review-mobile подтверждает обрезание. Вывод по скриншоту, код подтверждён.
- **Источник:** `flights-import:import-row-mobile-overflow`

<a id="heatmap-legend-invisible-and-scale-mismatch"></a>

#### [P1] Легенда тепловой карты не рисуется, а сама тепловая карта кодирует частоту прозрачностью флагового цвета каждой страны

`heatmap-legend-invisible-and-scale-mismatch` · Темы и токены · уверенность: verified

- **Где:** `apps/web/src/components/map/MapCard.tsx:168-187`, `apps/web/src/components/map/RouteMapWithCountries.tsx:203-227`, `apps/web/src/components/map/RouteMapWithCountries.tsx:208`
- **Экраны:** [`passport-map-heatmap-desktop`](../dashboard-passport-journey/images/passport-map-heatmap-desktop.png), [`passport-map-expanded-desktop`](../dashboard-passport-journey/images/passport-map-expanded-desktop.png)
- **Влияние:** Градиент легенды задан как hsl(var(--primary) / 0.2) → hsl(var(--primary)), но --primary — это oklch(...): hsl(oklch(...)) невалидно, фон не применяется, видны только цифры «1» и «61». При этом на карте интенсивность задаётся opacity (0.3…0.9) поверх dominantColor страны (синий, красный, жёлтый — у каждой свой оттенок), поэтому светло-красная Турция с 12 визитами выглядит «слабее» тёмно-синей России с 61 и по цвету нельзя сравнить частоту; легенда (даже если бы рисовалась) показывает шкалу primary, которой на карте нет. Легенда при выключенном режиме имеет только opacity-0, но не aria-hidden: скринридер читает «Visit frequency scale from 1 to N» (английский текст) всегда.
- **Стандарт:** WCAG 2.1 SC 1.4.1 (A), SC 1.4.11 (AA), SC 1.3.1; DESIGN.md: Maps/Colors tokens
- **Рекомендация:** Один одноцветный последовательный градиент из токена (например color-mix(in oklch, var(--primary) 20%, var(--card)) → var(--primary)) и для заливки стран, и для легенды; убрать hsl() вокруг oklch-переменных; при heatmapMode=false ставить hidden/aria-hidden на легенду; продублировать число визитов в aria-label/подсказке страны; локализовать подпись.
- **Команда:** `$impeccable colorize`
- **Доказательства:** Просмотрен passport-map-heatmap-desktop: у легенды внизу справа только «1» и «61» без цветной полосы; Россия тёмно-синяя, Турция/Китай/Япония розовые. В index.css --primary:60 и dark:138 заданы oklch. Код MapCard.tsx:181-183 и RouteMapWithCountries.tsx:213-219 прочитан.
- **Источник:** `dashboard-passport-journey:heatmap-legend-invisible-and-scale-mismatch`

### P2 — 68

<a id="heading-structure-gaps"></a>

#### [P2] Иерархия заголовков: h4 без h2/h3 на Dashboard, нет h1 у пустого Passport, одинаковый h1 «Kuuki» у всех режимов входа

`heading-structure-gaps` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/components/dashboard/AdvancedStatCards.tsx:160`, `apps/web/src/routes/PassportPage.tsx:145`, `apps/web/src/components/passport/EmptyPassport.tsx:43`, `apps/web/src/routes/PassportPage.tsx:218-229`, `apps/web/src/components/ui/card.tsx:1`, `apps/web/src/components/profile/ProfileHeader.tsx:63`, `apps/web/src/components/common/UserAvatar.tsx:32`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:127`, `apps/web/src/routes/LeaderboardPage.tsx:88`, `apps/web/src/routes/AuthPage.tsx:89-92`, `apps/web/src/components/auth/ActivationRequestForm.tsx:26`
- **Экраны:** [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`passport-empty-desktop`](../dashboard-passport-journey/images/passport-empty-desktop.png), [`passport-empty-mobile`](../dashboard-passport-journey/images/passport-empty-mobile.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`leaderboard-flights-populated-simulated-desktop`](../public-social/images/leaderboard-flights-populated-simulated-desktop.png), [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-register-desktop`](../public-social/images/auth-register-desktop.png), [`auth-activation-request-desktop`](../public-social/images/auth-activation-request-desktop.png)
- **Влияние:** Навигация по заголовкам в скринридере не отражает структуру; режим входа/регистрации/активации нигде не назван.
- **Стандарт:** WCAG 2.1 SC 1.3.1 (A), 2.4.6 (AA); DESIGN.md: h1 once per page
- **Рекомендация:** Выстроить h1→h2→h3 на каждом маршруте; h1 auth-экрана должен называть режим («Вход», «Создание аккаунта»).
- **Команда:** `$impeccable polish`
- **Доказательства:** AdvancedStatCards.tsx:160 (h4), PassportPage empty/loading без h1, AuthPage.tsx:89-92.
- **Источник:** `dashboard-passport-journey:heading-structure-h4-and-missing-h1`, `social-settings:minor-semantics-heading-levels-avatar-alt-th-scope`, `entry:auth-h1-identical-for-all-modes`

<details><summary>Доказательства срезов</summary>

- [dashboard-passport-journey:heading-structure-h4-and-missing-h1] Accessibility-снимок dashboard-populated-desktop: heading level 4 ×4 после level 1; код PassportPage.tsx:114-215 показывает h1 только в блоке hasCountries; passport-empty-* снимки без h1.
- [social-settings:minor-semantics-heading-levels-avatar-alt-th-scope] Снимок settings-main-mobile.txt: heading 1 → 3; код UserAvatar.tsx:30-34.
- [entry:auth-h1-identical-for-all-modes] AuthPage.tsx:90-92 h1 с BrandMark; SignInForm/RegisterForm заголовков не содержат; snapshot auth-signin-desktop.txt: heading «Kuuki» [level=1] и далее сразу form. Положительно: h1 ровно один, левый бренд в aria-hidden.

</details>

<a id="micro-text-9-10px-and-stamp-svg-text"></a>

#### [P2] Слишком мелкий текст: 9–10px в карточках статистики и 5.5–7px в SVG штампов на мобильном

`micro-text-9-10px-and-stamp-svg-text` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/components/dashboard/AdvancedStatCards.tsx:378`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:428`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:560`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:787`, `apps/web/src/components/dashboard/UpcomingFlightsBanner.tsx:61`, `apps/web/src/components/map/MapCard.tsx:178`, `apps/web/src/components/passport/CountryStamp.tsx:106-153`, `apps/web/src/components/passport/CountryStamp.tsx:244-262`
- **Экраны:** [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`dashboard-synthetic-fleet-manufacturer-desktop`](../dashboard-passport-journey/images/dashboard-synthetic-fleet-manufacturer-desktop.png), [`passport-populated-mobile`](../dashboard-passport-journey/images/passport-populated-mobile.png), [`passport-populated-full-mobile`](../dashboard-passport-journey/images/passport-populated-full-mobile.png), [`dashboard-upcoming-banner-desktop`](../dashboard-passport-journey/images/dashboard-upcoming-banner-desktop.png)
- **Влияние:** В AdvancedStatCards 19 мест text-[10px]/[9px] (легенды, подписи осей ридж-графика, тултипы, значки), бейдж «Завтра» 10px uppercase, легенда карты 10px. В штампах SVG-текст масштабируется вместе с вьюбоксом: на 3-колоночной мобильной сетке (ячейка ≈111px) круглый штамп даёт дату ≈5.5px, счётчик ×N ≈6.5px, английское название ≈7px; прямоугольный (viewBox 160) — 5.5–7px. Низкий размер плюс alpha (см. muted-foreground-opacity-contrast) делает дату и количество визитов нечитаемыми, зум текста браузера не помогает.
- **Стандарт:** WCAG 2.1 SC 1.4.4 (AA), SC 1.4.12; PRODUCT.md Accessible by default
- **Рекомендация:** Минимум 11–12px для текста интерфейса; дату/счётчик штампа вывести HTML-подписью под штампом, а в SVG оставить только название; на мобильном перейти на 2 колонки или увеличить viewBox-шрифты пропорционально.
- **Команда:** `$impeccable typeset`
- **Доказательства:** Подсчёт grep: AdvancedStatCards 19, UpcomingFlightsCard 3, MapCard 2, Banner 1 вхождений 9/10px. Размеры штампов рассчитаны из viewBox (120→≈111px: ×0.925; 160→×0.69) и fontSize 6/7/8/10 в CountryStamp.tsx. На passport-populated-mobile штамп не попал в кадр, полагаюсь на расчёт.
- **Источник:** `dashboard-passport-journey:micro-text-9-10px-and-stamp-svg-text`

<a id="reduced-motion-global-kill-no-loader-alternative"></a>

#### [P2] Глобальный reduced-motion «0.01ms !important» продублирован и стирает индикаторы загрузки без замены

`reduced-motion-global-kill-no-loader-alternative` · Доступность · уверенность: verified · системная

- **Где:** `apps/web/src/index.css:271-281`, `apps/web/src/index.css:1069-1117`, `apps/web/src/components/ui/status-button.tsx:30`, `apps/web/src/components/error/CrashScreen.tsx:36`, `apps/web/src/components/common/WindLoader.tsx:147-159`, `apps/web/src/index.css:781-796`
- **Экраны:** в атласе не снято
- **Влияние:** Один и тот же блок prefers-reduced-motion объявлен дважды (index.css:272 в @layer base и 1069 в конце файла). animation-iteration-count:1 + duration 0.01ms превращает все бесконечные анимации в статичные: 14 мест animate-spin (StatusButton «loading», Loader2), точки pulse-dot в LoadingScreen/WindLoader, shimmer/skeleton — у пользователя нет никакого признака «идёт загрузка» кроме текста. Блок частично осмысленный (planes → opacity .03, KuukiIcon показывает первый символ), но для спиннеров/точек замены нет. На экране ошибки CrashScreen крутится спиннер (animate-spin) — семантически «загрузка», при reduce-motion превращается в статичное кольцо. status-pop (scale 1.15 overshoot) нарушает «no bounce» из DESIGN.md. Только 7 использований motion-reduce: в src.
- **Стандарт:** WCAG 2.1 SC 2.3.3 (AAA) / playbook: reduced-motion alternative; DESIGN.md: no bounce
- **Рекомендация:** Оставить один блок; для статусов загрузки при reduce дать не-анимационную замену (например, opacity-pulse 1.6s или статичный текст «Загрузка…» с role=status); убрать спиннер с CrashScreen (иконка AlertCircle); заменить status-pop на ease-out fade/scale 0.9→1 без overshoot.
- **Команда:** `$impeccable animate`
- **Доказательства:** Прочитан index.css (оба блока) и места использования animate-spin/pulse-dot; rg motion-reduce = 7 вхождений.
- **Источник:** `foundations:reduced-motion-global-kill-no-loader-alternative`

<a id="dm-sans-has-no-cyrillic-fallback-system-font"></a>

#### [P2] DM Sans не содержит кириллицы: весь русский интерфейс рисуется системным шрифтом, а не брендовым

`dm-sans-has-no-cyrillic-fallback-system-font` · Целостность реализации · уверенность: verified · системная

- **Где:** `apps/web/index.html:26-28`, `apps/web/src/index.css:21-23`, `apps/web/src/index.css:243-254`
- **Экраны:** [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`profile-public-dark-theme-desktop`](../public-social/images/profile-public-dark-theme-desktop.png)
- **Влияние:** Запрос Google Fonts для DM Sans возвращает только подмножества latin и latin-ext (проверено curl; у JetBrains Mono есть cyrillic). Для кириллицы работает fallback ui-sans-serif/system-ui, при этом применены letter-spacing -0.01/-0.025em и font-feature-settings "cv02,cv03,cv04,cv11", рассчитанные на DM Sans. Заголовки «Настройки», «Рейтинг», «Тестовый путешественник» на скриншотах отрисованы SF/Inter-подобным шрифтом, цифры и латиница (Kuuki, 141,255 km) — DM Sans: на экране смешаны два шрифта, метрика зависит от ОС. Для ru (основная локаль атласа) грузится ~2 CSS subset-а DM Sans, которые для кириллицы бесполезны.
- **Стандарт:** DESIGN.md Typography; PRODUCT.md: EN/RU i18n
- **Рекомендация:** Выбрать шрифт с кириллицей (например Onest, Manrope, Inter, Golos Text) для --font-sans или самохостить DM Sans-совместимую пару; подобрать tracking под кириллицу; самохост WOFF2 с preload убирает ещё два сторонних origin.
- **Команда:** `$impeccable typeset`
- **Доказательства:** Выполнен curl к fonts.googleapis.com/css2 с теми же параметрами: перечислены только latin/latin-ext для DM Sans. Просмотрены скриншоты (заголовки на русском визуально не DM Sans).
- **Источник:** `foundations:dm-sans-has-no-cyrillic-fallback-system-font`

<a id="fetch-errors-shown-as-empty-state"></a>

#### [P2] Сбой загрузки выглядит как пустые данные: журнал «нет рейсов», рейтинг «Станьте первым!»

`fetch-errors-shown-as-empty-state` · Целостность реализации · уверенность: verified · системная

- **Где:** `apps/web/src/routes/LeaderboardPage.tsx:23`, `apps/web/src/routes/LeaderboardPage.tsx:76`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:78`, `apps/web/src/lib/flights.ts:134`, `apps/web/src/lib/flights.ts:136`
- **Экраны:** [`leaderboard-flights-guest-desktop`](../public-social/images/leaderboard-flights-guest-desktop.png), [`leaderboard-flights-authenticated-desktop`](../public-social/images/leaderboard-flights-authenticated-desktop.png), [`flights-populated-desktop`](../flights-import/images/flights-populated-desktop.png)
- **Влияние:** При сетевой ошибке пользователь думает, что его данные пропали, и может начать повторный импорт.
- **Рекомендация:** getFlights и рейтинг должны пробрасывать ошибку; показывать состояние ошибки с повтором, отличное от empty state.
- **Команда:** `$impeccable harden`
- **Доказательства:** flights.ts:134-136 (catch → []), LeaderboardPage.tsx:23.
- **Источник:** `social-settings:leaderboard-fetch-error-shown-as-empty-ranking`, `flights-import:flights-fetch-error-swallowed`

<details><summary>Доказательства срезов</summary>

- [social-settings:leaderboard-fetch-error-shown-as-empty-ranking] Код LeaderboardPage.tsx:23,76-81 и useLeaderboard; скриншоты пустого рейтинга; atlas gaps «Пустые leaderboard таблицы».
- [flights-import:flights-fetch-error-swallowed] Прочитан lib/flights.ts:109–138: catch возвращает пустой результат. Состояние ошибки на атласе не снималось.

</details>

<a id="import-success-counter-starts-at-zero"></a>

#### [P2] Экран успеха импорта начинается с «0 flights added to your log» на английском

`import-success-counter-starts-at-zero` · Целостность реализации · уверенность: likely · системная

- **Где:** `apps/web/src/routes/ImportPage.tsx:110`, `apps/web/src/routes/ImportPage.tsx:486`, `apps/web/src/routes/ImportPage.tsx:223`, `packages/shared/src/i18n/ru.json:401`
- **Экраны:** [`import-success`](../flights-import/images/import-success.png), [`import-save-retried`](../flights-import/images/import-save-retried.png)
- **Влияние:** useCountUp стартует с 0, а 0 в ru попадает в отсутствующую форму many, поэтому первый кадр — английское «0 flights added», затем число дорастает. Снимок атласа, вероятно, застал первый кадр (requestAnimationFrame в фоновой вкладке не тикает); данные сохраняются верно. Для 5+ рейсов финальная строка тоже английская — см. i18n-ru-plural-many-missing.
- **Стандарт:** WCAG 2.1 SC 3.1.1/3.1.2 (A/AA) и целостность данных (DESIGN.md: EN/RU i18n)
- **Рекомендация:** Показывать финальное savedCount текстом сразу (анимированную копию — aria-hidden) или убрать count-up из итоговой фразы; закрыть вместе с i18n-ru-plural-many-missing.
- **Команда:** `$impeccable harden`
- **Доказательства:** useCountUp.ts: useState(0) + rAF-анимация (прочитано в основном потоке); ImportPage.tsx:110/486. Объяснение «0» на снимке как первого кадра — вывод, не воспроизводился.
- **Источник:** `flights-import:import-success-counter-zero-english`

<a id="dialog-no-max-height-no-scroll"></a>

#### [P2] DialogContent без max-height и прокрутки: высокие диалоги («Что такое Kuuki?», удаление аккаунта) обрезаются на телефоне

`dialog-no-max-height-no-scroll` · Адаптивность · уверенность: likely · системная

- **Где:** `apps/web/src/components/ui/dialog.tsx:11`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:293`, `apps/web/src/components/profile/ProfileSettingsDialog.tsx:113`, `apps/web/src/components/passport/ClaimDialog.tsx:81`, `apps/web/src/components/compare/CompareModal.tsx:51`, `apps/web/src/components/auth/WhatIsKuukiDialog.tsx:40`, `apps/web/src/components/auth/WhatIsKuukiDialog.tsx:43-58`, `apps/web/src/components/ui/dialog.tsx:12-14`
- **Экраны:** [`passport-claim-new-mobile`](../dashboard-passport-journey/images/passport-claim-new-mobile.png), [`auth-about-dialog-desktop`](../public-social/images/auth-about-dialog-desktop.png)
- **Влияние:** На низком экране или при увеличенном тексте кнопки и крестик уходят за край, диалог нельзя закрыть или подтвердить.
- **Стандарт:** WCAG 2.1 SC 1.4.10 Reflow (AA)
- **Рекомендация:** В ui/dialog.tsx добавить `max-h-[calc(100dvh-2rem)] overflow-y-auto` и закрепить заголовок/действия.
- **Команда:** `$impeccable adapt`
- **Доказательства:** dialog.tsx:11 (нет max-h); высота WhatIsKuukiDialog оценена по тексту — confidence likely.
- **Источник:** `foundations:dialog-no-max-height-no-scroll`, `entry:what-is-kuuki-dialog-mobile-overflow`

<details><summary>Доказательства срезов</summary>

- [foundations:dialog-no-max-height-no-scroll] Код dialog.tsx и 4 потребителей прочитан (rg max-h|overflow-y-auto). Фактическое отсечение не воспроизводилось (браузер не запускался).
- [entry:what-is-kuuki-dialog-mobile-overflow] Оценка по тексту (ru.json about.features.*.description: 235+223+236+177+181 знаков), ширине 390-32 минус отступы Note p-6 и pr-10 (получается около 245px) и по desktop-снимку (22 строки при ширине текста 477px). Мобильного снимка этого диалога в atlas нет, поэтому уверенность «likely»; не измерял в браузере.

</details>

<a id="touch-targets-below-44px"></a>

#### [P2] Касательные цели меньше 44×44: свотчи, вкладки, крестики, чекбоксы, слои карты, точки шоукейса, текстовые ссылки

`touch-targets-below-44px` · Адаптивность · уверенность: verified · системная

- **Где:** `apps/web/src/index.css:1038-1063`, `apps/web/src/components/ui/button.tsx:24-28`, `apps/web/src/components/ui/input.tsx:11`, `apps/web/src/components/ui/dialog.tsx:95-98`, `apps/web/src/components/ui/sheet.tsx:113-116`, `apps/web/src/components/ui/checkbox.tsx:15`, `apps/web/src/components/ui/dropdown-menu.tsx:75`, `apps/web/src/components/ui/select.tsx:40`, `apps/web/src/components/settings/AppearanceSection.tsx:89`, `apps/web/src/components/settings/LanguageSection.tsx:26`, `apps/web/src/components/leaderboard/CategoryTabs.tsx:33`, `apps/web/src/components/profile/ProfileHeader.tsx:135`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:121`, `apps/web/src/components/ui/dialog.tsx:95`, `apps/web/src/components/ui/button.tsx:25`, `apps/web/src/components/import/FlightEditRow.tsx:288`, `apps/web/src/components/import/FlightEditRow.tsx:299`, `apps/web/src/components/import/ImportUpload.tsx:321`, `apps/web/src/components/import/ImportUpload.tsx:400`, `apps/web/src/components/map/MapCard.tsx:105`, `apps/web/src/components/map/MapCard.tsx:119`, `apps/web/src/components/map/MapCard.tsx:131`, `apps/web/src/index.css:1038-1047`, `apps/web/src/components/flights/FlightFilters.tsx:201`, `apps/web/src/routes/AuthPage.tsx:134-136`, `apps/web/src/components/auth/ActivationRequestForm.tsx:37`, `apps/web/src/components/onboarding/ShowcaseModal.tsx:78-92`
- **Экраны:** [`import-review-mobile`](../flights-import/images/import-review-mobile.png), [`flight-add-form-mobile`](../flights-import/images/flight-add-form-mobile.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`profile-own-private-desktop`](../public-social/images/profile-own-private-desktop.png), [`leaderboard-guest-mobile`](../public-social/images/leaderboard-guest-mobile.png), [`import-upload-mobile`](../flights-import/images/import-upload-mobile.png), [`dashboard-filters-expanded-mobile`](../dashboard-passport-journey/images/dashboard-filters-expanded-mobile.png), [`passport-populated-mobile`](../dashboard-passport-journey/images/passport-populated-mobile.png), [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`auth-activation-request-desktop`](../public-social/images/auth-activation-request-desktop.png), [`landing-showcase-step1-desktop`](../public-social/images/landing-showcase-step1-desktop.png), [`landing-showcase-step2-desktop`](../public-social/images/landing-showcase-step2-desktop.png), [`landing-showcase-step3-desktop`](../public-social/images/landing-showcase-step3-desktop.png)
- **Влияние:** На телефоне промахи по мелким контролам; 44px обеспечены глобальным `@media (pointer: coarse)` и выпадают у элементов с p-0, у закрытия диалогов (16–32px) и у текстовых ссылок (~20px).
- **Стандарт:** DESIGN.md: 44×44 touch target; WCAG 2.2 SC 2.5.8 (AA, 24px минимум)
- **Рекомендация:** Задать размеры в самих примитивах (size-11 / min-h-11 для icon-кнопок, hit-area через ::before для чекбоксов, свотчей и точек) вместо глобального патча.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Объединены находки пяти срезов (index.css:1038-1063, MapCard.tsx:105/119, AppearanceSection.tsx:89, FlightEditRow.tsx:288, ShowcaseModal.tsx:78-92 и др.).
- **Источник:** `foundations:touch-targets-patched-by-coarse-pointer-css`, `social-settings:touch-targets-below-44px-in-social-settings`, `flights-import:import-row-actions-small-targets`, `dashboard-passport-journey:map-toggle-buttons-32px-excluded-from-touch-rule`, `entry:auth-standalone-text-links-small-targets`, `entry:showcase-dots-tiny-and-low-contrast`

<details><summary>Доказательства срезов</summary>

- [foundations:touch-targets-patched-by-coarse-pointer-css] Размеры прочитаны в cva button/input/select/checkbox/dialog/sheet; просмотрен import-review-mobile (чекбоксы ≈16px, скриншот снят без coarse pointer). Эффект правила на реальном тач-устройстве не проверялся.
- [social-settings:touch-targets-below-44px-in-social-settings] Классы прочитаны в каждом файле; размеры из Tailwind (w-8, h-9, h-7, size-4). Реальное касание не проверялось.
- [flights-import:import-row-actions-small-targets] Прочитаны классы в FlightEditRow.tsx:288,299 и ImportUpload.tsx:321,400; button.tsx size=icon = size-11 на мобильном, но className переопределяет.
- [dashboard-passport-journey:map-toggle-buttons-32px-excluded-from-touch-rule] Прочитаны CSS-правило и классы кнопок; на скриншотах mobile иконки в оверлее карты ~32px.
- [entry:auth-standalone-text-links-small-targets] AuthPage.tsx:134 className="block mx-auto text-sm text-primary hover:underline" без размеров; ActivationRequestForm.tsx:37 аналогично. Смотрел auth-signin-mobile.png: ссылка 14px текста без области вокруг.
- [entry:showcase-dots-tiny-and-low-contrast] ShowcaseModal.tsx:80-90 button w-2 h-2 без padding; неактивные bg-border; aria-label литерал. Посчитал: bg-border на card 1.4:1. Смотрел landing-showcase-step2-desktop.png.

</details>

<a id="country-dominant-colors-hex-low-contrast-dark"></a>

#### [P2] Цвета стран (dominantColor) — хардкод-hex из countries.json; на тёмной теме 137 из 246 ниже 3:1, на светлой 25 ниже 3:1

`country-dominant-colors-hex-low-contrast-dark` · Темы и токены · уверенность: verified · системная

- **Где:** `apps/web/src/lib/countries.ts:21`, `apps/web/src/components/map/RouteMapWithCountries.tsx:208`, `apps/web/src/components/passport/CountryStamp.tsx:27`, `apps/web/src/components/passport/CountryStamp.tsx:122-134`, `apps/web/src/components/passport/StampPopup.tsx:115`, `apps/web/src/components/passport/CountryClaimMap.tsx:160-166`, `packages/data/src/countries.json`
- **Экраны:** [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-map-heatmap-desktop`](../dashboard-passport-journey/images/passport-map-heatmap-desktop.png), [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`passport-country-picker-desktop`](../dashboard-passport-journey/images/passport-country-picker-desktop.png)
- **Влияние:** Заливка посещённой страны, кольцо и текст ×N на штампе, точка в попапе и пикере берут произвольный флаговый hex. Светлая тема: Колумбия #FCD116 (1.43:1), Эквадор #FFD100 (1.42:1), Бруней (1.31:1) почти исчезают на карте/штампе; тёмная: Афганистан/Бельгия #000000 (1.31:1), Австралия #002868 (1.15:1), Англия-синие — заливка и кольцо теряются, текст ×N на штампе 213 из 246 стран ниже 4.5:1. «Посещена/не посещена» на карте различается только цветом/opacity (claim-only — пунктир 0.6px). Это «orphan hex palette» вразрез с PRODUCT.md.
- **Стандарт:** WCAG 2.1 SC 1.4.11 (AA), SC 1.4.1 (A); PRODUCT.md «Tokens over literals»
- **Рекомендация:** Для заливки использовать токены (--primary / tint) и штриховку/паттерн для claim-only; флаговый цвет оставить акцентной точкой с обязательным контуром (stroke var(--foreground)/30); для текста ×N брать foreground. При необходимости нормализовать dominantColor через oklch-clamp по L для темы.
- **Команда:** `$impeccable colorize`
- **Доказательства:** Посчитан контраст всех 246 dominantColor (packages/data/src/countries.json) к --card в светлой/тёмной теме (python). Тёмные скриншоты в атласе отсутствуют — для тёмной темы вывод основан на расчёте, а не на изображении.
- **Источник:** `dashboard-passport-journey:country-dominant-colors-hex-low-contrast-dark`

<a id="hardcoded-color-literals"></a>

#### [P2] Цвета вне токенов: 36 hex, 27 классов палитры Tailwind (blue-500, amber-500…), rgba/white в карте и журнале

`hardcoded-color-literals` · Темы и токены · уверенность: verified · системная

- **Где:** `apps/web/src/hooks/useAccentColor.ts:6-13`, `apps/web/src/lib/profiles.ts:14-22`, `apps/web/src/components/common/UserAvatar.tsx:3`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:69-134`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:29-35`, `apps/web/src/components/profile/ProfileRankings.tsx:55-86`, `apps/web/src/components/leaderboard/UserRankCard.tsx:169-177`, `apps/web/src/components/import/ImportReview.tsx:262-264`, `apps/web/src/components/flights/FlightFilters.tsx:24-26`, `apps/web/src/components/journey/JourneyTimeline.tsx:54-76`, `apps/web/src/components/map/MapCard.tsx:151-153`, `apps/web/src/components/map/RouteMapWithCountries.tsx:364-370`, `apps/web/src/components/ui/AtmosphericCard.tsx:55`, `apps/web/src/index.css:258-262`, `apps/web/src/components/import/ImportReview.tsx:262`, `apps/web/src/components/import/ImportReview.tsx:264`
- **Экраны:** [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`profile-public-dark-theme-desktop`](../public-social/images/profile-public-dark-theme-desktop.png), [`import-review-mobile`](../flights-import/images/import-review-mobile.png)
- **Влияние:** Цвета не реагируют на тему и акцент; часть литералов уже даёт видимые дефекты (см. map-overlays-white-on-light-theme, journey-timeline-white-literals-invisible, amber-literal-rank-text-fails-contrast-light).
- **Стандарт:** PRODUCT.md: Tokens over literals
- **Рекомендация:** Заменить литералы на семантические токены (`--info`, `--warning`, `--map-*`); добавить lint-правило против палитровых классов в components/.
- **Команда:** `$impeccable colorize`
- **Доказательства:** Подсчёт grep по apps/web/src (срез foundations); ImportReview.tsx:262 blue-500.
- **Источник:** `foundations:hardcoded-color-literals-systemic`, `flights-import:import-blue-literals-instead-of-tokens`

<details><summary>Доказательства срезов</summary>

- [foundations:hardcoded-color-literals-systemic] Сканирование rg по hex/rgb/oklch/палитре Tailwind/white|black по всему apps/web/src, подсчёт по файлам (скрипт в терминале). MapCard/RouteMapWithCountries проверены только по классам: контейнер и реальный фон не рендерились, поэтому часть про карту likely.
- [flights-import:import-blue-literals-instead-of-tokens] Прочитан ImportReview.tsx:262–264; сравнено с токеном --info (index.css:89).

</details>

<a id="one-material-border-plus-shadow"></a>

#### [P2] Карточки сочетают рамку и тень/ореол вопреки правилу «один материал», карта получает постоянный розовый ореол

`one-material-border-plus-shadow` · Темы и токены · уверенность: verified · системная

- **Где:** `apps/web/src/components/map/MapCard.tsx:80-83`, `apps/web/src/index.css:903-912`, `apps/web/src/components/dashboard/MicroBadgeStatCard.tsx:70-74`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:155`, `apps/web/src/components/dashboard/DashboardCard.tsx:57-58`, `apps/web/src/components/passport/StampPopup.tsx:108`
- **Экраны:** [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-map-expanded-desktop`](../dashboard-passport-journey/images/passport-map-expanded-desktop.png), [`dashboard-upcoming-banner-desktop`](../dashboard-passport-journey/images/dashboard-upcoming-banner-desktop.png)
- **Влияние:** MapCard: border border-border + shadow-glow-sm (1px primary-ring + 12px blur) — на скриншотах у карты розовый контур, не встречающийся у других карточек; stat-карточки добавляют hover:shadow-md к border-border/50; StampPopup — border + shadow-lg. Нарушены DESIGN.md Elevation («flat border or shadow … never both», тень ≤ 8px blur) и PRODUCT.md «ghost cards (border plus wide shadow)» из anti-references. Появляется визуальная несогласованность: карта выделена сильнее всего, хотя по смыслу равна карточкам.
- **Стандарт:** DESIGN.md Elevation; PRODUCT.md Anti-references
- **Рекомендация:** Убрать shadow-glow-sm у MapCard (оставить border), заменить hover:shadow-md на border-color/translate-feedback, у StampPopup использовать border без shadow-lg (или тень ≤8px без border).
- **Команда:** `$impeccable quieter`
- **Доказательства:** Просмотрены скриншоты: розовый ореол вокруг карты на dashboard-populated-desktop, passport-map-expanded-desktop. Код и CSS .shadow-glow-sm прочитаны.
- **Источник:** `dashboard-passport-journey:one-material-border-plus-shadow`

<a id="activate-page-errors-not-associated-and-misleading"></a>

#### [P2] Страница /activate: ошибки не привязаны к полям, фокус теряется, подсказка в ошибке вводит в заблуждение

`activate-page-errors-not-associated-and-misleading` · Доступность · уверенность: verified

- **Где:** `apps/web/public/activate.js:19-26`, `apps/web/public/activate.js:36-44`, `apps/web/public/activate.js:40-42`, `apps/web/public/activate.html:27-34`
- **Экраны:** [`activation-password-mismatch-desktop`](../public-social/images/activate-password-mismatch-desktop.png), [`activation-server-unavailable-desktop`](../public-social/images/activate-server-unavailable-desktop.png), [`activation-success-simulated-desktop`](../public-social/images/activation-success-simulated-desktop.png)
- **Влияние:** Сообщение о несовпадении паролей стоит ниже кнопки и не привязано к полям, фокус остаётся на кнопке. Любая ошибка (даже «ссылка недействительна») получает хвост «If you submitted a password but did not see confirmation, try signing in with that password» без пробела/точки после основного текста. На успехе форма скрывается вместе с сфокусированной кнопкой, фокус уходит на body.
- **Стандарт:** WCAG 2.1 SC 3.3.1 (A), 3.3.3 (AA), 2.4.3 (A); 3.3.2 (подсказка про минимум 8 символов только после ошибки)
- **Рекомендация:** Показывать хвост только при сетевой ошибке/5xx, ставить точку после основного текста; на поля вешать aria-invalid и aria-describedby="status", при ошибке фокусировать первое проблемное поле; на успехе фокусировать status или ссылку «Back to sign in»; подсказку про 8 символов показывать до ввода.
- **Команда:** `$impeccable harden`
- **Доказательства:** activate.js:44 шаблон `${error.message} If you submitted…` — в снимке activate-server-unavailable-desktop.png видно слипшееся «unavailable If you». #status (activate.html:34) role="status" aria-live="polite" расположен после формы; у input нет aria-invalid/aria-describedby; form.hidden=true (строка 40) убирает сфокусированный элемент.
- **Источник:** `entry:activate-page-errors-not-associated-and-misleading`

<a id="appearance-menu-controls-unreachable-by-keyboard"></a>

#### [P2] Переключатели темы и акцента в шапке — обычные button внутри Radix DropdownMenu: Tab заблокирован, стрелки их не достигают

`appearance-menu-controls-unreachable-by-keyboard` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/common/AppearanceToggle.tsx:49-120`, `apps/web/src/components/common/AppearanceToggle.tsx:64-76`, `apps/web/src/components/common/AppearanceToggle.tsx:96-116`, `apps/web/src/components/layout/MobileHeader.tsx:46`
- **Экраны:** [`app-header-appearance-menu-desktop`](../public-social/images/app-header-appearance-menu-desktop.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`settings-dark-theme-desktop`](../public-social/images/settings-dark-theme-desktop.png)
- **Влияние:** Переключатели темы и акцента в шапке — обычные <button> внутри Radix DropdownMenuContent: Tab заблокирован меню, стрелки ходят только по DropdownMenuItem, поэтому с клавиатуры их не выбрать; у иконок темы есть только title. Обходной путь — те же настройки на /settings, поэтому P2.
- **Стандарт:** WCAG 2.1 SC 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A), 3.1.2
- **Рекомендация:** Заменить на DropdownMenuRadioGroup/DropdownMenuRadioItem (тема) и radio-group для акцента, либо сделать Popover (не меню) с role=radiogroup и aria-checked; локализовать label через t(); добавить aria-label на все кнопки.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код AppearanceToggle.tsx и исходник Radix react-menu (grep "Tab", строка 305) прочитаны; поведение в браузере не запускалось. Скриншот app-header-appearance-menu-desktop показывает меню из обычных кнопок без пунктов меню.
- **Источник:** `foundations:appearance-menu-controls-unreachable-by-keyboard`

<a id="charts-lack-text-alternative-and-keyboard"></a>

#### [P2] Ридж-график, радар, полосы и вафля: нет текстового эквивалента, тултипы только по мыши, вложенные role="img" на 64 квадратах

`charts-lack-text-alternative-and-keyboard` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/dashboard/AdvancedStatCards.tsx:335-345`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:366-372`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:438-453`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:693-711`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:744-770`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:912-939`
- **Экраны:** [`dashboard-synthetic-fleet-manufacturer-desktop`](../dashboard-passport-journey/images/dashboard-synthetic-fleet-manufacturer-desktop.png), [`dashboard-populated-full`](../dashboard-passport-journey/images/dashboard-populated-full.png), [`dashboard-synthetic-fixture-full`](../dashboard-passport-journey/images/dashboard-synthetic-fixture-full.png), [`dashboard-populated-full-mobile`](../dashboard-passport-journey/images/dashboard-populated-full-mobile.png)
- **Влияние:** FleetRidgeline — <svg> без role/title/desc, данные раскрываются только mouse-hover (onMouseMove, foreignObject-тултип; на touch и с клавиатуры недоступно). FleetBar-тултип — `hidden group-hover:block` с английским «flights». WaffleGrid: родитель role="img" с английской фразой без данных, внутри 64 квадрата с собственным role="img"+aria-label (дочерние role=img презентационные, скринридер получит один пустой по смыслу образ; в DOM 64 лишних узлов); численные данные частично есть в легенде (хорошо), у радара — только tooltip и один инсайт-текст. Цвета производителей различаются только оттенком; контраст ряда брендовых цветов к --card ниже 3:1 (embraer 2.43, bombardier 2.95, antonov 2.73, fokker 2.66, regional 2.83).
- **Стандарт:** WCAG 2.1 SC 1.1.1 (A), SC 1.4.1 (A), SC 1.4.11 (AA), SC 2.1.1 (A)
- **Рекомендация:** Обернуть графики в <figure> с <figcaption> и скрытой таблицей/списком значений (sr-only), у ридж-графика и радара — role="img" + aria-label с итогом; сделать точки/ряды фокусируемыми или добавить доступную таблицу; убрать вложенные role="img", оставить один aria-label с распределением; подобрать цвета ≥3:1 или добавить паттерн/подпись долей рядом с сегментом.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан код AdvancedStatCards.tsx; контраст цветов рассчитан по oklch-значениям MANUFACTURER_COLORS/TYPE_COLORS против --card (светлая) / --card (тёмная). Скриншот dashboard-synthetic-fleet-manufacturer-desktop показывает вафлю и легенды. Скринридер/клавиатуру не запускал.
- **Источник:** `dashboard-passport-journey:charts-lack-text-alternative-and-keyboard`

<a id="delete-dialog-focus-and-submit-semantics"></a>

#### [P2] Диалог удаления: нет управления фокусом между шагами, нет <form>, Enter не подтверждает

`delete-dialog-focus-and-submit-semantics` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/settings/DeleteAccountDialog.tsx:122`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:235`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:262`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:292`
- **Экраны:** [`settings-delete-preview-desktop`](../public-social/images/settings-delete-preview-desktop.png), [`settings-delete-export-prompt-desktop`](../public-social/images/settings-delete-export-prompt-desktop.png), [`settings-delete-password-desktop`](../public-social/images/settings-delete-password-desktop.png)
- **Влияние:** Шаги подменяют содержимое DialogContent: нажатая кнопка размонтируется, Radix возвращает фокус на контейнер, а не на заголовок/первое поле; в шаге «пароль» input без autoFocus; Enter в поле пароля ничего не делает (нет form/onKeyDown), менеджеры паролей не видят форму; описаний (DialogDescription) нет на 3 из 4 шагов (в снимке dialog "Удалить аккаунт?" без описания — Radix warning). Кнопка закрытия — «Close» на английском (ui/dialog.tsx:98) и 16px.
- **Стандарт:** WCAG 2.1 SC 2.4.3 Focus Order (A); SC 3.3.2 Labels or Instructions (A); SC 4.1.2
- **Рекомендация:** Обернуть шаг пароля в <form onSubmit>, autoFocus на input и на заголовок шага (tabIndex=-1 + ref.focus() при смене step), aria-describedby для описаний/предупреждений, `common.close` для sr-only текста. Блокировать закрытие и в состоянии export-prompt isExporting.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан компонент и ui/dialog.tsx; снимки delete-*.txt: `button "Close"` англ. в ru-интерфейсе, нет paragraph-описаний на шаге пароля. Реальный порядок фокуса в браузере не проверялся (untested).
- **Источник:** `social-settings:delete-dialog-focus-and-submit-semantics`

<a id="flight-form-required-validation-wiring"></a>

#### [P2] Обязательность и ошибки формы рейса не связаны с полями: звёздочка без sr-текста, DatePicker и автокомплиты вне FormControl

`flight-form-required-validation-wiring` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/flights/FlightForm.tsx:43`, `apps/web/src/components/flights/FlightForm.tsx:304`, `apps/web/src/components/flights/FlightForm.tsx:363`, `apps/web/src/components/flights/FlightForm.tsx:366`, `apps/web/src/components/flights/FlightForm.tsx:307`
- **Экраны:** [`flight-add-form-mobile`](../flights-import/images/flight-add-form-mobile.png)
- **Влияние:** «*» в красном span без aria-hidden/«обязательное»; сообщения zod на английском («Date is required»); для DatePicker/автокомплитов FormControl не передаёт aria-invalid/aria-describedby, фокус при ошибке не уходит на первое невалидное поле.
- **Стандарт:** WCAG 2.1 SC 3.3.1, 3.3.2, 4.1.2; i18n
- **Рекомендация:** Пометить required (aria-required + текст «обязательное поле» в sr-only), локализовать сообщения zod через t(), убедиться что DatePicker принимает id/aria-* и фокус переходит на первое невалидное поле.
- **Команда:** `$impeccable clarify`
- **Доказательства:** Прочитан FlightForm.tsx:43,361–374 и AirportAutocomplete (required передаётся атрибутом, ошибки показывает FormMessage отдельно). Поведение DatePicker с клавиатуры статически не проверялось.
- **Источник:** `flights-import:flight-form-required-validation-wiring`

<a id="focus-lost-on-mode-and-step-switch"></a>

#### [P2] Фокус теряется при переключении «вход / регистрация / активация» и шагов онбординга; режим не отражён в URL

`focus-lost-on-mode-and-step-switch` · Доступность · уверенность: verified

- **Где:** `apps/web/src/routes/AuthPage.tsx:29-31`, `apps/web/src/routes/AuthPage.tsx:120-138`, `apps/web/src/components/auth/SignInForm.tsx:122-128`, `apps/web/src/components/auth/RegisterForm.tsx:130-136`, `apps/web/src/components/auth/ActivationRequestForm.tsx:20-37`, `apps/web/src/routes/OnboardingPage.tsx:84-104`
- **Экраны:** [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-register-desktop`](../public-social/images/auth-register-desktop.png), [`auth-activation-request-desktop`](../public-social/images/auth-activation-request-desktop.png), [`activation-request-success-simulated-desktop`](../public-social/images/activation-request-success-simulated-desktop.png), [`onboarding-username-desktop`](../public-social/images/onboarding-username-desktop.png), [`onboarding-import-empty-desktop`](../public-social/images/onboarding-import-empty-desktop.png)
- **Влияние:** Нажатие «Создать аккаунт» / «Войти» / «Активировать» размонтирует кнопку, на которой стоял фокус, он улетает на body; скринридер ничего не объявляет о смене режима. После успешного запроса активации форма заменяется абзацем, фокус также теряется. Режим хранится только в useState (читается из ?mode лишь при монтировании), поэтому «Назад» и обновление страницы возвращают на регистрацию.
- **Стандарт:** WCAG 2.1 SC 2.4.3 Focus Order (A), SC 4.1.3 (AA), SC 3.2.2
- **Рекомендация:** Синхронизировать mode с useSearchParams; после смены режима переводить фокус на заголовок режима (tabIndex=-1) или первое поле; на шаге онбординга фокусировать h1 нового шага; успешный результат активации — role="status" с фокусом.
- **Команда:** `$impeccable harden`
- **Доказательства:** AuthPage: mode в useState (стр. 29-31) инициализируется из searchParams один раз; кнопки переключения — type=button без ref/focus-логики; нет autoFocus и useEffect для фокуса в проекте форм (grep). Динамически проверить не мог: нужен браузер и скринридер.
- **Источник:** `entry:focus-lost-on-mode-and-step-switch`

<a id="form-controls-unlabeled-filters-claim-dialog"></a>

#### [P2] Фильтры, форма добавления визита и подсказки: поля без программных подписей и переключатели без состояния

`form-controls-unlabeled-filters-claim-dialog` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/flights/FlightFilters.tsx:194-232`, `apps/web/src/components/flights/FlightFilters.tsx:249-369`, `apps/web/src/components/passport/ClaimDialog.tsx:115-119`, `apps/web/src/components/passport/ClaimDialog.tsx:133-153`, `apps/web/src/components/passport/ClaimDialog.tsx:158-164`, `apps/web/src/components/passport/CountryClaimMap.tsx:90-97`, `apps/web/src/components/passport/CountryListSheet.tsx:170-196`
- **Экраны:** [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`dashboard-filters-expanded-mobile`](../dashboard-passport-journey/images/dashboard-filters-expanded-mobile.png), [`passport-claim-new-mobile`](../dashboard-passport-journey/images/passport-claim-new-mobile.png), [`passport-claim-existing-desktop`](../dashboard-passport-journey/images/passport-claim-existing-desktop.png), [`passport-country-picker-mobile`](../dashboard-passport-journey/images/passport-country-picker-mobile.png)
- **Влияние:** Поля «City or code» — только placeholder, 4 select — без label/aria-label (в a11y-снимке: textbox "City or code", combobox: «Все годы» — имя совпадает со значением, не с назначением). В ClaimDialog <Label> не связан с контролом (нет htmlFor/id у Select и Textarea); кнопки «Суша/Море» показывают выбранное состояние только цветом заливки, без aria-pressed/role=radiogroup. Кнопки-крестики закрытия подсказок (h-6 w-6) и очистки поиска не имеют имён. SelectTrigger в диалоге ужимается до w-fit и не растягивается на ширину поля (скриншот).
- **Стандарт:** WCAG 2.1 SC 1.3.1 (A), SC 3.3.2 (A), SC 4.1.2 (A), SC 1.4.1 (A)
- **Рекомендация:** Добавить aria-label/Label+htmlFor для каждого фильтра («Год», «Авиакомпания», «Самолёт», «Статус», «Откуда», «Куда»), связать Label↔Select/Textarea через id, сделать Land/Sea ToggleGroup с aria-pressed, добавить aria-label всем иконочным кнопкам, растянуть SelectTrigger на w-full.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код прочитан; accessibility-снимки dashboard-populated-desktop.txt содержат textbox "City or code" и combobox без label. Скриншот passport-claim-new-mobile: поле «Выберите год…» уже ширины колонки.
- **Источник:** `dashboard-passport-journey:form-controls-unlabeled-filters-claim-dialog`

<a id="journey-reorder-mouse-only-dnd"></a>

#### [P2] Перестановка сегментов Journey — только нативный HTML5 drag-and-drop: нет клавиатуры, на touch не работает; кнопка «Reorder segment» ничего не делает

`journey-reorder-mouse-only-dnd` · Доступность · уверенность: likely

- **Где:** `apps/web/src/components/journey/JourneyTimeline.tsx:39-50`, `apps/web/src/components/journey/FlightGanttBlock.tsx:56-58`, `apps/web/src/components/journey/FlightGanttBlock.tsx:20-27`, `apps/web/src/components/layout/AppHeader.tsx:39`, `apps/web/src/components/layout/MobileTabBar.tsx:35`
- **Экраны:** [`journey-initial-desktop`](../dashboard-passport-journey/images/journey-initial-desktop.png), [`journey-initial-mobile`](../dashboard-passport-journey/images/journey-initial-mobile.png), [`journey-reordered-desktop`](../dashboard-passport-journey/images/journey-reordered-desktop.png), [`journey-full-mobile`](../dashboard-passport-journey/images/journey-full-mobile.png)
- **Влияние:** Обёртка сегмента draggable с onDragStart/Over/End; блок не фокусируется и не имеет key-обработчиков; «ручка» GripVertical — это <button aria-label="Reorder segment"> без onClick, т.е. обещает действие и ничего не делает. Нативные DragEvent на мобильных браузерах не вызываются обычным касанием, у блока нет pointer-событий/touch-action, поэтому на телефоне порядок не поменять. Перестановка в процессе dragover меняет порядок на каждый шаг (мерцание при разной ширине блоков). Маршрут скрыт из навигации (пункты закомментированы), но открывается по /journey для любого залогиненного.
- **Стандарт:** WCAG 2.1 SC 2.1.1 (A); WCAG 2.2 SC 2.5.7 Dragging Movements (AA)
- **Рекомендация:** Добавить кнопки «Сдвинуть влево/вправо» (или Up/Down) с aria-live-объявлением и Alt+←/→ на фокусируемом блоке; реализовать drag через pointer events + touch-action: pan-x/none на ручке (или dnd-kit с KeyboardSensor/TouchSensor); либо спрятать маршрут за feature-flag до готовности.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан JourneyTimeline.tsx/FlightGanttBlock.tsx; в manifest указано, что drag наблюдался в реальном UI мышью. Реальное касание/клавиатуру не проверял; вывод про touch основан на отсутствии pointer-обработки и поведении HTML5 DnD в мобильных браузерах.
- **Источник:** `dashboard-passport-journey:journey-reorder-mouse-only-dnd`

<a id="leaderboard-table-unnamed-and-category-change-silent"></a>

#### [P2] Таблица рейтинга без caption/имени; смена категории и загрузка не объявляются

`leaderboard-table-unnamed-and-category-change-silent` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/leaderboard/LeaderboardTable.tsx:98`, `apps/web/src/components/leaderboard/LeaderboardTable.tsx:102`, `apps/web/src/components/ui/table.tsx:68`, `apps/web/src/routes/LeaderboardPage.tsx:59`
- **Экраны:** [`leaderboard-distance-authenticated-desktop`](../public-social/images/leaderboard-distance-authenticated-desktop.png), [`leaderboard-flights-populated-simulated-desktop`](../public-social/images/leaderboard-flights-populated-simulated-desktop.png)
- **Влияние:** У <table> нет <caption>/aria-label (категория и «топ-50» не названы), th без scope="col"; при переключении вкладки контент заменяется без aria-live, у скелетона нет aria-busy/status; «Top N%» в ячейке выводится по-английски. Колонка «Rank» выровнена влево, а иконки/числа центрированы в w-8.
- **Стандарт:** WCAG 2.1 SC 1.3.1 (A); SC 4.1.3 (AA)
- **Рекомендация:** TableCaption (sr-only) с «Рейтинг: Полёты, топ-50», scope="col", aria-live="polite" счётчик «Показано N», aria-busy на контейнере в загрузке; локализовать «Top».
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитаны table.tsx и LeaderboardTable.tsx: нет caption/scope. Поведение скринридера не проверялось.
- **Источник:** `social-settings:leaderboard-table-unnamed-and-category-change-silent`

<a id="loading-screen-english-and-silent"></a>

#### [P2] LoadingScreen: английский текст в RU и без объявления состояния загрузки

`loading-screen-english-and-silent` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/ui/LoadingScreen.tsx:20-41`, `apps/web/src/lib/glados-text.ts:76-79`, `apps/web/src/components/ProtectedRoute.tsx:13-15`, `apps/web/src/App.tsx:63`
- **Экраны:** [`onboarding-import-mobile`](../public-social/images/onboarding-import-mobile.png)
- **Влияние:** Экран показывается при каждой загрузке защищённого маршрута и lazy-чанка: для русскоязычного пользователя это «PROCESSING. THIS IS THE PART WHERE YOU WAIT.» капсом на английском; у экрана нет role="status"/aria-live, поэтому скринридер молчит и фокус остаётся «под» fixed-оверлеем.
- **Стандарт:** WCAG 2.1 SC 4.1.3 Status Messages (AA); PRODUCT.md: i18n EN/RU
- **Рекомендация:** Вынести тексты в i18n (common.loading уже есть), добавить role="status" и sr-only подпись; фиксированный оверлей оставить, но не перехватывать фокус клавиатуры.
- **Команда:** `$impeccable clarify`
- **Доказательства:** LoadingScreen.tsx: сообщение из getProcessingMessage('generic') (glados-text.ts, строки только по-английски), uppercase tracking-widest; нет role/aria-live. Смотрел onboarding-import-mobile.png: в atlas вместо онбординга пойман этот экран с английской фразой.
- **Источник:** `entry:loading-screen-english-and-silent`

<a id="nav-landmarks-missing-aria-current-and-labels"></a>

#### [P2] Навигация без aria-current и aria-label, кнопка пользователя подписана инициалами

`nav-landmarks-missing-aria-current-and-labels` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/common/AppHeader.tsx:67-80`, `apps/web/src/components/common/AppHeader.tsx:96-116`, `apps/web/src/components/layout/MobileTabBar.tsx:50-80`, `apps/web/src/components/layout/MobileHeader.tsx:35-42`
- **Экраны:** [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`flights-populated-mobile`](../flights-import/images/flights-populated-mobile.png), [`import-upload-mobile`](../flights-import/images/import-upload-mobile.png), [`app-header-user-menu-desktop`](../public-social/images/app-header-user-menu-desktop.png), [`settings-system-theme-desktop`](../public-social/images/settings-system-theme-desktop.png)
- **Влияние:** Активный пункт — только цвет/вес (text-primary, scale-110, strokeWidth 2.5), атрибута aria-current="page" нет (rg aria-current: только ShowcaseModal). <nav> в AppHeader и MobileTabBar без aria-label, a11y-снимок даёт безымянный navigation. Кнопка меню пользователя в шапке — button "FI" (имя = инициалы, нет aria-label «Меню пользователя»), у иконки KuukiIcon одновременно aria-hidden и aria-label. Активный цвет text-primary (3.63:1 на светлом) — единственный признак выбранного таба, включая 12px подписи.
- **Стандарт:** WCAG 2.1 SC 1.3.1, 4.1.2 (A), 1.4.1 (A)
- **Рекомендация:** Добавить aria-current={active ? "page" : undefined} и aria-label={t("nav.main")} на <nav>; aria-label у кнопки пользователя; добавить второй визуальный признак активного таба (индикатор-линия).
- **Команда:** `$impeccable harden`
- **Доказательства:** Код AppHeader/MobileTabBar/MobileHeader прочитан; a11y-снимок settings-system-theme-desktop.txt показывает безымянные navigation и button "FI". Просмотрены 4 мобильных состояния таб-бара.
- **Источник:** `foundations:nav-landmarks-missing-aria-current-and-labels`

<a id="profile-badges-tooltip-only-details-and-color-tier"></a>

#### [P2] Бейджи профиля: описание и дата — только в title, тир — только цветом, лента не фокусируется

`profile-badges-tooltip-only-details-and-color-tier` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/profile/ProfileBadges.tsx:103`, `apps/web/src/components/profile/ProfileBadges.tsx:112`, `apps/web/src/components/profile/ProfileBadges.tsx:116`, `apps/web/src/components/profile/ProfileBadges.tsx:107`
- **Экраны:** [`profile-public-test-traveler-desktop`](../public-social/images/profile-public-test-traveler-desktop.png)
- **Влияние:** Описание/дата «Earned:» лежат в атрибуте title: недоступны на touch и с клавиатуры, на русском фиксированно «Earned:» и дата в локали браузера. Тир обозначен точкой w-2 h-2 только цветом. На mobile `overflow-x-auto` без tabindex — клавиатурный пользователь не может прокрутить ленту.
- **Стандарт:** WCAG 2.1 SC 1.4.1 (A); SC 2.1.1 (A) (scrollable region); SC 1.3.1
- **Рекомендация:** Показывать описание в раскрывающемся popover/button либо под бейджем; текст тира (sr-only или видимый); `tabIndex={0} role="region" aria-label` на горизонтальную ленту либо wrap на mobile; локализовать «Earned».
- **Команда:** `$impeccable harden`
- **Доказательства:** Код ProfileBadges.tsx прочитан; состояние с бейджами в fixture отсутствует (у test-traveler badges=0 в атласе) — вывод по исходнику.
- **Источник:** `social-settings:profile-badges-tooltip-only-details-and-color-tier`

<a id="profile-founding-pill-reveal-hover-only-and-auto-collapse"></a>

#### [P2] Пилюля «Первый экипаж» через 5 с сворачивается в иконку и раскрывается только по :hover

`profile-founding-pill-reveal-hover-only-and-auto-collapse` · Доступность · уверенность: likely

- **Где:** `apps/web/src/components/profile/ProfileHeader.tsx:22`, `apps/web/src/components/profile/ProfileHeader.tsx:109`, `apps/web/src/components/profile/ProfileHeader.tsx:115`
- **Экраны:** в атласе не снято
- **Влияние:** Таймер 5 с схлопывает подпись (max-w-0 opacity-0), раскрытие только `group-hover` — нет :focus, нет touch: на телефоне подпись теряется навсегда, смысл иконки Sparkles не ясен. Анимируются max-width/padding/margin (layout-свойства), элемент не фокусируемый и без title. Подпись остаётся в DOM (скринридер читает), так что дефект зрячих touch/keyboard-пользователей.
- **Стандарт:** WCAG 2.1 SC 1.4.13 Content on Hover (AA) / SC 2.1.1; DESIGN.md: motion with purpose
- **Рекомендация:** Не схлопывать автоматически (или схлопывать только в компактных контекстах); если оставить — сделать <button>/tooltip с focus/tap и анимировать transform/opacity.
- **Команда:** `$impeccable animate`
- **Доказательства:** Код прочитан; в атласе нет профиля с founding-user badge (пилюля не снята) — вывод по исходнику.
- **Источник:** `social-settings:profile-founding-pill-reveal-hover-only-and-auto-collapse`

<a id="profile-mobile-section-triggers-not-headings"></a>

#### [P2] На mobile заголовки секций профиля — кнопки без heading-семантики

`profile-mobile-section-triggers-not-headings` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/profile/ProfileSection.tsx:50`, `apps/web/src/components/profile/ProfileSection.tsx:66`, `apps/web/src/components/profile/ProfileSection.tsx:96`
- **Экраны:** [`profile-public-test-traveler-mobile`](../public-social/images/profile-public-test-traveler-mobile.png), [`profile-sections-expanded-mobile`](../public-social/images/profile-sections-expanded-mobile.png)
- **Влияние:** На desktop заголовок секции — h2, на mobile тот же заголовок — span внутри <button>, поэтому навигация по заголовкам скринридера на телефоне видит только h1. aria-expanded есть (хорошо), но состояние продублировано вручную при Radix. Текст триггера в uppercase tracking-widest (в снимке «СТАТИСТИКА»). Шеврон text-muted-foreground/40 = 1.46:1 в light — индикатор состояния не различим.
- **Стандарт:** WCAG 2.1 SC 1.3.1 (A); SC 1.4.11 (AA)
- **Рекомендация:** Оборачивать trigger в <h2><button>…</button></h2> (паттерн accordion), шеврон — text-muted-foreground, убрать лишний aria-expanded.
- **Команда:** `$impeccable harden`
- **Доказательства:** Снимок profile-public-test-traveler-mobile.txt: `button "СТАТИСТИКА" [expanded=true]` без heading; ss_contrast.py: /40 chevron 1.46:1 light, 2.79 dark.
- **Источник:** `social-settings:profile-mobile-section-triggers-not-headings`

<a id="progress-bar-value-not-exposed"></a>

#### [P2] Progress не передаёт value в Radix Root: прогресс-бары объявляются как indeterminate без aria-valuenow

`progress-bar-value-not-exposed` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/ui/progress.tsx:6-25`, `apps/web/src/components/badges/BadgeProgress.tsx:56`, `apps/web/src/components/leaderboard/UserRankCard.tsx:114`, `apps/web/src/components/profile/ProfileRankings.tsx:106`
- **Экраны:** в атласе не снято
- **Влияние:** value деструктурируется и используется только для translateX индикатора, в ProgressPrimitive.Root он не прокидывается ({...props} уже без value). Radix ставит role=progressbar, но без aria-valuenow (data-state=indeterminate). В 5 местах (бейджи, рейтинг, профиль) пользователь SR слышит «индикатор выполнения» без значения и имени.
- **Стандарт:** WCAG 2.1 SC 4.1.2 Name, Role, Value (A)
- **Рекомендация:** Передавать value={value} в Root, добавить aria-label/aria-labelledby в местах вызова.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код progress.tsx прочитан; 5 вызовов найдены rg. В состояниях атласа не снят.
- **Источник:** `foundations:progress-bar-value-not-exposed`

<a id="register-form-autocomplete-and-password-affordances"></a>

#### [P2] Регистрация: нет autocomplete=email/new-password, нет подсказки про 8 символов и показа пароля

`register-form-autocomplete-and-password-affordances` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/auth/RegisterForm.tsx:82-88`, `apps/web/src/components/auth/RegisterForm.tsx:106-112`, `apps/web/src/components/auth/SignInForm.tsx:101-108`, `apps/web/src/components/auth/RegisterForm.tsx:20-22`
- **Экраны:** [`auth-register-desktop`](../public-social/images/auth-register-desktop.png), [`auth-register-mobile`](../public-social/images/auth-register-mobile.png), [`auth-register-validation-desktop`](../public-social/images/auth-register-validation-desktop.png)
- **Влияние:** Менеджеры паролей не предлагают сгенерировать новый пароль и могут подставить старый; требование «минимум 8 символов» открывается только после ошибки (ключ auth.passwordHint есть, но не используется); показать/скрыть пароль нет, на телефоне опечатку не проверить; placeholder «••••••••» выглядит как уже введённое значение.
- **Стандарт:** WCAG 2.1 SC 1.3.5 Identify Input Purpose (AA), SC 3.3.2 Labels or Instructions (A)
- **Рекомендация:** email: autoComplete="email" (или "username"); password: autoComplete="new-password", FormDescription с t("auth.passwordHint") и aria-describedby; добавить кнопку «Показать пароль» (44px, aria-pressed); placeholder пароля убрать; добавить noValidate на form, чтобы нативные баллоны на type=email не перебивали переведённые ошибки.
- **Команда:** `$impeccable harden`
- **Доказательства:** RegisterForm.tsx: у email Input нет autoComplete (стр. 82-88), у password нет autoComplete (106-112); в SignInForm autoComplete есть (79, 103). grep: auth.passwordHint не используется ни в одном компоненте. Смотрел auth-register-mobile.png: «••••••••» в поле выглядит заполненным. Положительно: Label привязан через FormLabel/htmlFor.
- **Источник:** `entry:register-form-autocomplete-and-password-affordances`

<a id="rotating-tagline-no-pause"></a>

#### [P2] Слоган меняется каждые 6 секунд без возможности остановить; в reduced-motion продолжает меняться

`rotating-tagline-no-pause` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/auth/RotatingTagline.tsx:15-32`, `apps/web/src/components/auth/RotatingTagline.tsx:38-49`, `apps/web/src/routes/AuthPage.tsx:141-147`
- **Экраны:** [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png), [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`auth-register-mobile`](../public-social/images/auth-register-mobile.png)
- **Влияние:** Автоматически сменяющийся текст рядом с формой отвлекает пользователей с когнитивными особенностями и не может быть приостановлен; при prefers-reduced-motion глобальное правило ставит transition 0.01ms, но ротация идёт (текст просто «щёлкает»).
- **Стандарт:** WCAG 2.1 SC 2.2.2 Pause, Stop, Hide (A)
- **Рекомендация:** При prefers-reduced-motion не запускать interval (показать один случайный слоган), для остальных останавливать ротацию на hover/focus-within соседней формы и после ввода в поля; убрать blur-sm из анимации (filter) в пользу opacity/translate.
- **Команда:** `$impeccable animate`
- **Доказательства:** Читал RotatingTagline.tsx: setInterval 6000 мс без matchMedia; фазы exit/enter через Tailwind-классы с blur-sm и transition-all. Глобальный блок reduced-motion в index.css:1068-1117 сокращает duration, но не останавливает таймер. Положительно: cleanup таймеров исправлен (swap/reveal очищаются), live-области нет (чтение не спамит).
- **Источник:** `entry:rotating-tagline-no-pause`

<a id="settings-save-result-and-form-errors-not-announced-or-localized"></a>

#### [P2] Сохранение профиля: статус кнопки и ошибка не озвучиваются; «Failed to save» на английском

`settings-save-result-and-form-errors-not-announced-or-localized` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/settings/ProfileSection.tsx:58`, `apps/web/src/components/settings/ProfileSection.tsx:74`, `apps/web/src/components/settings/ProfileSection.tsx:182`, `apps/web/src/components/settings/ProfileSection.tsx:194`, `apps/web/src/components/ui/status-button.tsx:42`
- **Экраны:** [`settings-main-desktop`](../public-social/images/settings-main-desktop.png)
- **Влияние:** StatusButton меняет текст/иконку без aria-live (успех disabled на 3 с, фокус теряется на отключённой кнопке); ошибка — <p> без role=alert; тексты ошибок захардкожены по-английски; подсказка «Your display name or leave empty to use @…» видна на английском в ru (ключ profile.displayNameHint отсутствует в обеих локалях). Useэффект [profile] сбрасывает форму при любом обновлении profile и стирает несохранённый ввод.
- **Стандарт:** WCAG 2.1 SC 4.1.3 (AA); DESIGN.md i18n
- **Рекомендация:** aria-live="polite" область рядом с кнопкой; role=alert на ошибку; ключи в локали; не перезаписывать dirty-поля из effect.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код; снимок settings-main-mobile.txt: «Your display name or leave empty to use @fixture-a»; скрипт сверки ключей: profile.displayNameHint RU/EN-MISSING.
- **Источник:** `social-settings:settings-save-result-and-form-errors-not-announced-or-localized`

<a id="settings-segmented-control-radio-keyboard-and-label"></a>

#### [P2] Переключатель темы: role=radio без стрелочной навигации; подписи <label> без связи; язык без aria-pressed

`settings-segmented-control-radio-keyboard-and-label` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/settings/AppearanceSection.tsx:36`, `apps/web/src/components/settings/AppearanceSection.tsx:33`, `apps/web/src/components/settings/AppearanceSection.tsx:77`, `apps/web/src/components/settings/LanguageSection.tsx:21`, `apps/web/src/components/settings/AppearanceSection.tsx:93`
- **Экраны:** [`settings-main-desktop`](../public-social/images/settings-main-desktop.png), [`settings-main-mobile`](../public-social/images/settings-main-mobile.png), [`settings-system-theme-desktop`](../public-social/images/settings-system-theme-desktop.png)
- **Влияние:** radiogroup из <button role=radio> не реализует паттерн APG: все три в tab-order, стрелки не работают; <label> над группами не имеет for/id (в снимке LabelText вне группы); кнопки выбора языка (LanguageSection) не передают текущее состояние (нет aria-pressed/lang), высота ~36px; swatch-кнопки акцента — aria-label на английском «Select blue accent color» в русском UI (виден в снимке), 32px. Выбранный акцент отмечен только кольцом цвета самого свотча.
- **Стандарт:** WCAG 2.1 SC 4.1.2 (A); SC 2.1.1 (A); SC 3.1.2 Language of Parts (AA); SC 1.4.1
- **Рекомендация:** Использовать Radix RadioGroup/ToggleGroup (roving tabindex, стрелки), aria-labelledby вместо <label>, aria-pressed/lang на выборе языка, aria-label из i18n (`settings.appearance.accentNames.*`), добавить галочку на выбранный акцент.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитаны AppearanceSection/LanguageSection: нет onKeyDown/roving; снимок settings-main-mobile.txt: `button "Select blue accent color"` при ru; кнопки языка без состояния.
- **Источник:** `social-settings:settings-segmented-control-radio-keyboard-and-label`

<a id="settings-visibility-leaderboard-disabled-reason-hidden"></a>

#### [P2] Чекбокс «Показывать в рейтинге» отключён без объяснения причины; снятие «Публичный» молча снимает рейтинг

`settings-visibility-leaderboard-disabled-reason-hidden` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/settings/ProfileSection.tsx:141`, `apps/web/src/components/settings/ProfileSection.tsx:159`, `apps/web/src/components/settings/ProfileSection.tsx:173`
- **Экраны:** [`settings-main-desktop`](../public-social/images/settings-main-desktop.png), [`settings-public-profile-enabled-desktop`](../public-social/images/settings-public-profile-enabled-desktop.png)
- **Влияние:** Disabled-чекбокс объясняет «требуется 5+ полётов», хотя реальная причина блокировки — выключенный публичный профиль; описания не связаны через aria-describedby; автосброс showOnLeaderboards при снятии публичности не объявляется. Изменения приватности применяются только по «Сохранить», индикатора несохранённых изменений и предупреждения при уходе нет; при профиле, ставшем публичным, нет предпросмотра/ссылки.
- **Стандарт:** WCAG 2.1 SC 3.3.2 (A); SC 1.3.1
- **Рекомендация:** При disabled показывать «Сначала включите публичный профиль»; aria-describedby; live-сообщение при автосбросе; блокировка ухода (beforeunload/router blocker) при hasChanges.
- **Команда:** `$impeccable clarify`
- **Доказательства:** Код ProfileSection.tsx:137-196; снимок settings-main-mobile.txt: checkbox disabled без описания причины, текст «требуется 5+ полётов».
- **Источник:** `social-settings:settings-visibility-leaderboard-disabled-reason-hidden`

<a id="share-button-feedback-silent-and-unhandled-clipboard-failure"></a>

#### [P2] Кнопка «Share»: результат не озвучивается, сбой clipboard не обрабатывается

`share-button-feedback-silent-and-unhandled-clipboard-failure` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/profile/ProfileHeader.tsx:38`, `apps/web/src/components/profile/ProfileHeader.tsx:131`
- **Экраны:** [`profile-own-private-desktop`](../public-social/images/profile-own-private-desktop.png)
- **Влияние:** Подпись в кнопке меняется на «Copied» на 2 с без aria-live — скринридер ничего не объявляет. `await navigator.clipboard.writeText` без try/catch: в небезопасном контексте/при отказе — необработанный rejection, пользователь видит «Share» без ошибки. Кнопка называется «Share», а копирует ссылку; ключи profile.share и common.copied отсутствуют в en.json и ru.json (английский fallback в ru, виден в снимке).
- **Стандарт:** WCAG 2.1 SC 4.1.3 (AA); SC 3.3.1
- **Рекомендация:** Скрытый `role="status"` с «Ссылка скопирована»/ошибкой; try/catch c fallback (Web Share API / select+execCommand / показ URL в input); добавить ключи в обе локали; aria-label="Скопировать ссылку на профиль".
- **Команда:** `$impeccable harden`
- **Доказательства:** Код прочитан; снимок profile-own-private-desktop.txt: `button "Share"` (англ.); скрипт сверки ключей: profile.share, common.copied — RU-MISSING и EN-MISSING.
- **Источник:** `social-settings:share-button-feedback-silent-and-unhandled-clipboard-failure`

<a id="stamp-popup-semantics-focus-and-position"></a>

#### [P2] Попап штампа — не диалог: нет роли/имени, фокус не переносится, позиция не ограничена экраном и уходит под таб-бар

`stamp-popup-semantics-focus-and-position` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/passport/PassportStamps.tsx:108-123`, `apps/web/src/components/passport/PassportStamps.tsx:225-243`, `apps/web/src/components/passport/PassportStamps.tsx:72-75`, `apps/web/src/components/passport/StampPopup.tsx:108`, `apps/web/src/components/passport/StampPopup.tsx:126`, `apps/web/src/components/passport/CountryStamp.tsx:30-39`
- **Экраны:** [`passport-stamp-popup-mobile`](../dashboard-passport-journey/images/passport-stamp-popup-mobile.png), [`passport-delete-visit-confirm-desktop`](../dashboard-passport-journey/images/passport-delete-visit-confirm-desktop.png), [`passport-stamp-popup-atlas-account-desktop`](../dashboard-passport-journey/images/passport-stamp-popup-atlas-account-desktop.png), [`passport-stamp-details-test-traveler`](../dashboard-passport-journey/images/passport-stamp-details-test-traveler.png)
- **Влияние:** Открытие по клику на штамп не помечено aria-haspopup/aria-expanded, у попапа нет role="dialog"/aria-label, фокус остаётся на штампе, а сам попап стоит в DOM после всех секций — до него нужно «протабить» все штампы; Esc закрывает, но фокус не возвращается. Положение считается по getBoundingClientRect() event.target (внутренний SVG-элемент, а не кнопки) и translateX(-50%) без ограничений: ширина w-80 (320px) на 390px экране уходит за левый край и прячется под MobileTabBar (на скриншоте «n» слева и обрезанная карточка). Кнопка закрытия — h-8 w-8. Обёртка div onClick дублирует неиспользуемый onClick у CountryStamp.
- **Стандарт:** WCAG 2.1 SC 4.1.2 (A), SC 2.4.3 (A), SC 1.4.10 Reflow (AA)
- **Рекомендация:** Заменить самодельный попап на Radix Popover (desktop) / Drawer-Sheet (mobile) — получаем роль, фокус-менеджмент, collision-aware позиционирование и Esc; передавать onClick в CountryStamp вместо div-обёртки; использовать currentTarget.
- **Команда:** `$impeccable harden`
- **Доказательства:** Просмотрены passport-stamp-popup-mobile (попап слева обрезан, снизу табы) и passport-delete-visit-confirm-desktop (карточка продолжается за низ страницы). Код прочитан; скринридер и клавиатуру не прогонял.
- **Источник:** `dashboard-passport-journey:stamp-popup-semantics-focus-and-position`

<a id="username-picker-errors-not-announced"></a>

#### [P2] Ошибки выбора имени пользователя не связаны с полем и не озвучиваются

`username-picker-errors-not-announced` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/onboarding/UsernamePicker.tsx:128-143`, `apps/web/src/components/onboarding/UsernamePicker.tsx:160-165`, `apps/web/src/components/onboarding/UsernamePicker.tsx:86-92`
- **Экраны:** [`onboarding-username-validation-desktop`](../public-social/images/onboarding-username-validation-desktop.png), [`onboarding-username-normalized-desktop`](../public-social/images/onboarding-username-normalized-desktop.png)
- **Влияние:** Пользователь скринридера после «Продолжить» не услышит «имя уже занято» (фокус остаётся на кнопке, live-области нет); поле не помечено aria-invalid и не ссылается на текст ошибки через aria-describedby. Подсказка «Will be saved as» тоже не озвучивается.
- **Стандарт:** WCAG 2.1 SC 4.1.3 Status Messages (AA), SC 3.3.1 Error Identification (A), SC 1.3.1
- **Рекомендация:** Дать <p> ошибки id и role="alert" (или aria-live="polite"), добавить на Input aria-invalid={!!hasError} и aria-describedby; при серверной ошибке вернуть фокус в поле. Привести к общему паттерну FormMessage.
- **Команда:** `$impeccable harden`
- **Доказательства:** UsernamePicker.tsx: <Input> (128-136) без aria-*; <p> ошибки (140-142) без id/role. Сравнил с form.tsx: FormControl ставит aria-invalid и aria-describedby, а на username-шаге компоненты формы не используются. Snapshot onboarding-username-validation-desktop.txt: ошибка простым paragraph.
- **Источник:** `entry:username-picker-errors-not-announced`

<a id="activate-page-english-only"></a>

#### [P2] Страница /activate целиком на английском и не знает язык приложения

`activate-page-english-only` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/public/activate.html:2`, `apps/web/public/activate.html:7`, `apps/web/public/activate.html:25-35`, `apps/web/public/activate.js:10`, `apps/web/public/activate.js:20`, `apps/web/public/activate.js:24`, `apps/web/public/activate.js:28`, `apps/web/public/activate.js:38`, `apps/web/public/activate.js:42-44`
- **Экраны:** [`activation-no-token-desktop`](../public-social/images/activate-no-token-desktop.png), [`activation-no-token-mobile`](../public-social/images/activate-no-token-mobile.png), [`activation-token-form-desktop`](../public-social/images/activate-token-form-desktop.png), [`activation-password-mismatch-desktop`](../public-social/images/activate-password-mismatch-desktop.png), [`activation-server-unavailable-desktop`](../public-social/images/activate-server-unavailable-desktop.png), [`activation-success-simulated-desktop`](../public-social/images/activation-success-simulated-desktop.png)
- **Влияние:** Пользователь, перешедший по письму из русского интерфейса (форма запроса /?mode=signin на русском), попадает на английскую страницу установки пароля; ошибки о несовпадении, длине и недоступности сервера тоже по-английски. Это единственный путь миграции старого аккаунта.
- **Стандарт:** PRODUCT.md / DESIGN.md: i18n EN/RU
- **Рекомендация:** Прочитать localStorage["kuuki-language"] (тот же origin) или navigator.language в activate.js, держать словарь EN/RU рядом (10-12 строк), ставить document.documentElement.lang и title. Серверные ошибки мапить по code, а не показывать error.message.
- **Команда:** `$impeccable clarify`
- **Доказательства:** activate.html/activate.js: все строки литералами; <html lang="en">. activate.js:38 пробрасывает body.error сервера. Страница не подключает i18n SPA. Atlas flows.md сам фиксирует «весь статический /activate остаётся на английском». Смотрел activate-token-form-desktop.png и activate-no-token-mobile.png.
- **Источник:** `entry:activate-page-english-only`

<a id="badge-toast-queue-floods-on-new-device-and-global-seen-state"></a>

#### [P2] На новом устройстве все накопленные награды показываются очередью по 6 секунд; seen-state общий для всех аккаунтов

`badge-toast-queue-floods-on-new-device-and-global-seen-state` · Целостность реализации · уверенность: likely

- **Где:** `apps/web/src/components/badges/BadgeNotificationManager.tsx:40`, `apps/web/src/components/badges/BadgeNotificationManager.tsx:59`, `apps/web/src/components/badges/BadgeNotificationManager.tsx:66`, `apps/web/src/components/badges/BadgeNotificationManager.tsx:7`
- **Экраны:** в атласе не снято
- **Влияние:** Seen-ключ `kuuki-seen-badges` не привязан к userId и хранится в localStorage: в новом браузере все полученные бейджи «непросмотренные» → очередь по ~6.3 с каждая (20 бейджей ≈ 2 минуты поверх интерфейса); на общем устройстве второй аккаунт не получит toast за уже виденные коды. Seen записывается до показа — закрытие вкладки теряет остаток очереди. JSON.parse без try/catch внутри useEffect при битом значении бросает в корне App.
- **Стандарт:** DESIGN.md: calm; WCAG 2.1 SC 2.2.2 Pause, Stop, Hide (A)
- **Рекомендация:** Хранить по userId (`kuuki-seen-badges:${id}`) либо брать флаг seen с сервера; при >2–3 новых — один агрегированный toast «+N достижений»; try/catch вокруг JSON.parse.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код прочитан; поведение выведено из условий (`!seenBadges.includes`). В браузере не воспроизводилось.
- **Источник:** `social-settings:badge-toast-queue-floods-on-new-device-and-global-seen-state`

<a id="continent-model-inconsistent-totals-and-labels"></a>

#### [P2] Модель континентов расходится: хардкод-итоги радара, «/ 7», подписи «americas» и пропуск Антарктиды

`continent-model-inconsistent-totals-and-labels` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/dashboard/AdvancedStatCards.tsx:870-877`, `apps/web/src/components/dashboard/AdvancedStatCards.tsx:895-903`, `apps/web/src/routes/PassportPage.tsx:177`, `apps/web/src/components/passport/PassportStamps.tsx:188-197`, `apps/web/src/components/passport/CountryClaimMap.tsx:124`, `packages/data/src/countries.json`
- **Экраны:** [`dashboard-populated-full`](../dashboard-passport-journey/images/dashboard-populated-full.png), [`dashboard-populated-full-mobile`](../dashboard-passport-journey/images/dashboard-populated-full-mobile.png), [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-populated-full`](../dashboard-passport-journey/images/passport-populated-full.png)
- **Влияние:** В данных 6 значений continent (africa 58, americas 54, asia 52, europe 51, oceania 28, antarctica 3), а радар использует CONTINENT_TOTALS 44/48/35/54/14 (coverage = visited/total без clamp — может быть >100%), Passport показывает «/ 7» (максимум достижимых — 6), PassportStamps.continentNames содержит north-america/south-america, но не americas — заголовок раздела выведется сырым «americas», а Antarctica/Other дублируют английские слова; в пикере CountryClaimMap нет antarctica, и 3 территории нельзя добавить.
- **Стандарт:** PRODUCT.md «accurate data»
- **Рекомендация:** Один источник правды для континентов (список + итоги из countries.json или константа в @kuuki/shared), локализованные названия через Intl.DisplayNames/ключи, clamp coverage ≤100, «/ N» считать из той же константы.
- **Команда:** `$impeccable harden`
- **Доказательства:** Подсчитано по countries.json (Counter по continent); прочитан код всех мест. Заголовок «americas» не наблюдался на скриншотах (тестовый паспорт — Asia/Europe), вывод из кода.
- **Источник:** `dashboard-passport-journey:continent-model-inconsistent-totals-and-labels`

<a id="country-picker-search-double-filter"></a>

#### [P2] Поиск страны: cmdk повторно фильтрует по имени, поэтому код (ES) и родное название (España) не находятся; русские запросы не работают нигде

`country-picker-search-double-filter` · Целостность реализации · уверенность: likely

- **Где:** `apps/web/src/components/passport/CountryClaimMap.tsx:50-59`, `apps/web/src/components/passport/CountryClaimMap.tsx:114-121`, `apps/web/src/components/passport/CountryClaimMap.tsx:149-152`, `apps/web/src/components/passport/CountryListSheet.tsx:93-102`, `apps/web/src/components/passport/CountryListSheet.tsx:108-112`, `apps/web/src/components/ui/command.tsx:21`
- **Экраны:** [`passport-country-picker-desktop`](../dashboard-passport-journey/images/passport-country-picker-desktop.png), [`passport-country-picker-mobile`](../dashboard-passport-journey/images/passport-country-picker-mobile.png), [`passport-country-picker-search-mobile`](../dashboard-passport-journey/images/passport-country-picker-search-mobile.png)
- **Влияние:** Компонент вычисляет filteredCountries (по name, code и nativeName), но <Command> оставлен с включённой встроенной фильтрацией и каждый CommandItem имеет value={country.name}; cmdk дополнительно отсеет элементы, у которых value не совпадает с запросом. Код «ES» или «España» (то, что пользователь видит на штампе) даёт «Ничего не найдено». Названия в данных только английские, так что «Испания» не находится ни в десктопном диалоге, ни в мобильном листе; в мобильном аккордеоне группы A–C… строятся по name[0] латиницы. Фильтр в CommandList также не сбрасывается cmdk-ом с учётом filteredCountries (двойная логика).
- **Стандарт:** WCAG 2.1 SC 3.3.2 (A) (ожидаемое поведение поиска); PRODUCT.md i18n RU
- **Рекомендация:** Передать shouldFilter={false} в <Command> и оставить единственный фильтр (по name, nativeName, code и русскому Intl.DisplayNames), либо задать keywords у CommandItem. Вынести общий список/фильтр стран из двух компонентов (CountryClaimMap и CountryListSheet дублируют код).
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан код и ui/command.tsx (shouldFilter не переопределён). Поведение cmdk по умолчанию (фильтр по value) известно из библиотеки, но интерактивно не запускалось. Скриншоты picker показывают только английские названия.
- **Источник:** `dashboard-passport-journey:country-picker-search-double-filter`

<a id="dashboard-filters-vs-map-and-persistence"></a>

#### [P2] Фильтры Dashboard и карта расходятся: aircraft-фильтр не применяется к карте, страны не фильтруются, а origin/destination из persist-стора стираются при монтировании

`dashboard-filters-vs-map-and-persistence` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/routes/DashboardPage.tsx:91-116`, `apps/web/src/routes/DashboardPage.tsx:142-175`, `apps/web/src/routes/DashboardPage.tsx:255-261`, `apps/web/src/stores/dashboardStore.ts:15-27`
- **Экраны:** [`dashboard-filter-aircraft-menu-desktop`](../dashboard-passport-journey/images/dashboard-filter-aircraft-menu-desktop.png), [`dashboard-filtered-2025-desktop`](../dashboard-passport-journey/images/dashboard-filtered-2025-desktop.png), [`dashboard-origin-filter-tbs-desktop`](../dashboard-passport-journey/images/dashboard-origin-filter-tbs-desktop.png), [`dashboard-route-filter-tbs-doh-desktop`](../dashboard-passport-journey/images/dashboard-route-filter-tbs-doh-desktop.png)
- **Влияние:** filteredFlights учитывает год, авиакомпанию(и), origin/destination и upcoming, но не filters.aircraftIcao — карточки статистики сузятся по самолёту, карта нет. Заливка стран берётся из всего паспорта (passportCountries), поэтому после «2025» на карте остаются все страны за все годы, пока счётчик «Страны» показывает 7. Фильтры persist-ятся в localStorage (kuuki-dashboard-storage, без привязки к пользователю), но локальные originSearch/destSearch стартуют с '' и два useEffect при монтировании вызывают setFilters({...filters, originCodes: undefined}) — сохранённые маршрутные фильтры молча сбрасываются, остальные остаются; эффекты используют stale filters и пропускают deps.
- **Стандарт:** DESIGN.md/PRODUCT.md: «Accurate data»
- **Рекомендация:** Добавить aircraftIcao в filteredFlights; передавать в MapCard страны, выведенные из filteredFlights (или явно пометить карту как «весь паспорт»); не persist-ить origin/destination либо инициализировать originSearch из стора; заменить эффекты на производное состояние + debounce-хук; ключевать persist по userId.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан DashboardPage.tsx:91-175 и dashboardStore.ts; в dashboard-filtered-2025-desktop карта показывает те же страны (Россия/Китай/Турция), что и без фильтра, при 12 полётах и «7 Страны». Поведение aircraft-фильтра на карте выведено из кода (не запускалось).
- **Источник:** `dashboard-passport-journey:dashboard-filters-vs-map-and-persistence`

<a id="data-export-disabled-looks-empty-while-stats-load"></a>

#### [P2] Кнопки экспорта показывают «Нет полётов/стран» пока статистика грузится; экспорт стран может молча ничего не делать

`data-export-disabled-looks-empty-while-stats-load` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/settings/DataExportSection.tsx:29`, `apps/web/src/components/settings/DataExportSection.tsx:95`, `apps/web/src/components/settings/DataExportSection.tsx:116`, `apps/web/src/components/settings/DataExportSection.tsx:49`
- **Экраны:** [`settings-data-export-populated-desktop`](../public-social/images/settings-data-export-populated-desktop.png), [`settings-data-export-success-desktop`](../public-social/images/settings-data-export-success-desktop.png)
- **Влияние:** flightCount/claimsCount = `?? 0` — состояние загрузки и ошибки неотличимы от пустого аккаунта (кнопка disabled с «Нет полётов для экспорта»). Количество стран берётся из passportStats, а экспортируются `claims` из другого запроса: при расхождении кнопка активна, но handleExportClaims выходит молча без toast. Причины disabled в остальном объяснены (подпись на кнопке и абзац лимита — это хорошо), но `title` на disabled-кнопке недоступен с клавиатуры/touch. Успешный toast «Экспорт полётов» — название кнопки, а не подтверждение (нет имени файла/числа записей).
- **Стандарт:** WCAG 2.1 SC 3.3.1; DESIGN.md: data accuracy
- **Рекомендация:** Показывать скелетон/«Загрузка…» пока isLoading; единый источник числа стран и claims; toast «Скачано 69 полётов (flights.csv)»; убрать зависимость от title.
- **Команда:** `$impeccable clarify`
- **Доказательства:** Код + atlas flows.md/manifest (экспорт 69 полётов, toast «Export Flights», claims toast «Экспорт стран»).
- **Источник:** `social-settings:data-export-disabled-looks-empty-while-stats-load`

<a id="flight-date-utc-shift"></a>

#### [P2] Даты рейсов парсятся как UTC и форматируются локальными геттерами — для UTC− сдвиг на день

`flight-date-utc-shift` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/flights/FlightCard.tsx:26`, `apps/web/src/components/flights/FlightTable.tsx:122`, `apps/web/src/lib/geo.ts:258`, `apps/web/src/lib/geo.ts:268`, `apps/web/src/components/flights/AircraftEnrichDialog.tsx:209`
- **Экраны:** [`flights-populated-mobile`](../flights-import/images/flights-populated-mobile.png), [`flights-populated-desktop`](../flights-import/images/flights-populated-desktop.png)
- **Влияние:** new Date('2026-05-12') = 00:00 UTC; getDate()/toLocaleDateString в TZ America/New_York дают 11 мая. Пользователь западнее UTC видит неверную дату рейса и неверный «+Nd» до вылета (daysUntilFlight).
- **Стандарт:** Целостность данных (корректность дат)
- **Рекомендация:** Парсить YYYY-MM-DD как локальную дату (new Date(y, m-1, d) или dateStr + 'T00:00:00', как уже сделано в FlightEditRow.tsx:151) либо форматировать с timeZone: 'UTC'; вынести общий helper parseLocalDate.
- **Команда:** `$impeccable harden`
- **Доказательства:** Проверено node с TZ=America/New_York: дата сдвигается на день назад. Код прочитан в указанных местах; FlightEditRow использует безопасный вариант.
- **Источник:** `flights-import:flight-date-utc-shift`

<a id="header-appearance-state-stale-duplicate-hooks"></a>

#### [P2] useTheme/useAccentColor хранят состояние локально в каждом экземпляре: иконка темы и точка акцента в шапке устаревают

`header-appearance-state-stale-duplicate-hooks` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/hooks/useTheme.ts:77-127`, `apps/web/src/hooks/useAccentColor.ts:57-79`, `apps/web/src/components/common/AppearanceToggle.tsx:17-26`, `apps/web/src/components/settings/AppearanceSection.tsx:18-19`
- **Экраны:** [`settings-dark-theme-desktop`](../public-social/images/settings-dark-theme-desktop.png), [`settings-system-theme-desktop`](../public-social/images/settings-system-theme-desktop.png)
- **Влияние:** Каждый вызов useTheme()/useAccentColor() создаёт свой useState; изменение в AppearanceSection на /settings не обновляет AppearanceToggle в шапке (и наоборот). Скриншот settings-dark-theme-desktop: выбрана «Тёмная», страница тёмная, а иконка в шапке — солнце. Аналогично цветная точка акцента остаётся прежней.
- **Стандарт:** Playbook: Theme switching issues / consistency
- **Рекомендация:** Вынести тему и акцент в один store (zustand уже в зависимостях) или подписываться на storage/CustomEvent; resolvedTheme считать из единого источника.
- **Команда:** `$impeccable harden`
- **Доказательства:** Просмотрен и увеличен кроп шапки settings-dark-theme-desktop (солнце при тёмной теме); код хуков прочитан. Источник состояния не менялся с момента скриншота.
- **Источник:** `foundations:header-appearance-state-stale-duplicate-hooks`

<a id="journey-dead-controls-fake-data-unreachable-nav"></a>

#### [P2] Journey: Save Trip, «+» и Add Segment не подключены; шапка и итоги — статичный текст; прототип с жёсткими данными доступен по URL

`journey-dead-controls-fake-data-unreachable-nav` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/routes/JourneyPlannerPage.tsx:10-27`, `apps/web/src/routes/JourneyPlannerPage.tsx:39-43`, `apps/web/src/routes/JourneyPlannerPage.tsx:50`, `apps/web/src/routes/JourneyPlannerPage.tsx:57`, `apps/web/src/routes/JourneyPlannerPage.tsx:60-63`, `apps/web/src/routes/JourneyPlannerPage.tsx:70-74`, `apps/web/src/routes/JourneyPlannerPage.tsx:83`, `apps/web/src/routes/JourneyPlannerPage.tsx:86-88`, `apps/web/src/components/journey/JourneyTimeline.tsx:73-81`, `apps/web/src/App.tsx:118-122`
- **Экраны:** [`journey-initial-desktop`](../dashboard-passport-journey/images/journey-initial-desktop.png), [`journey-initial-mobile`](../dashboard-passport-journey/images/journey-initial-mobile.png), [`journey-reordered-desktop`](../dashboard-passport-journey/images/journey-reordered-desktop.png), `journey-save-add-controls-source-only`
- **Влияние:** Три кнопки (Save Trip, «+» на карте, Add Segment) и круглая «+» в конце таймлайна без onClick; «+» иконки без accessible name; ссылка «назад» — <a><button> без имени (вложенные интерактивные элементы). «TBS • NRT», «Oct 24 — Nov 12» и «Total Duration: 13h 05m» — статические строки, не зависят от порядка/состава сегментов; INITIAL_TRIP зашит. После перестановки DOH→NRT перед TBS→DOH итоговый маршрут бессмыслен, но ни карта, ни итоги не реагируют и валидации нет. Все строки на английском. Данные не сохраняются.
- **Стандарт:** WCAG 2.1 SC 4.1.2 (A), SC 2.4.4 (A); PRODUCT.md «Accurate data»
- **Рекомендация:** Либо спрятать маршрут за флагом (route + guard) до готовности, либо подключить обработчики, посчитать заголовок/даты/длительность из state, валидировать цепочку (arrival = next departure), добавить aria-label иконочным кнопкам и i18n.
- **Команда:** `$impeccable distill`
- **Доказательства:** Прочитан исходник JourneyPlannerPage.tsx и JourneyTimeline.tsx; manifest.gaps подтверждает «Add Segment, +, Save Trip не подключены». Скриншот journey-reordered-desktop показывает DOH→NRT, TBS→DOH при неизменных итогах.
- **Источник:** `dashboard-passport-journey:journey-dead-controls-fake-data-unreachable-nav`

<a id="lazy-chunk-retry-flag-cleared-before-use-reload-loop"></a>

#### [P2] Защита от повторной перезагрузки при сбое чанка сбрасывается при каждом старте и не работает

`lazy-chunk-retry-flag-cleared-before-use-reload-loop` · Целостность реализации · уверенность: likely

- **Где:** `apps/web/src/main.tsx:10-11`, `apps/web/src/App.tsx:20-33`
- **Экраны:** в атласе не снято
- **Влияние:** main.tsx:11 безусловно делает sessionStorage.removeItem("chunk_retry") при загрузке модуля, до рендера и до загрузки lazy-маршрута. В lazyWithRetry флаг ставится и вызывается window.location.reload(); после перезагрузки флаг уже сброшен, а повторный сбой снова видит alreadyRetried=null → новый reload. Если чанк недоступен не из-за устаревшего хеша (офлайн в PWA, сбой CDN, блокировка), страница уходит в бесконечный цикл перезагрузок вместо CrashScreen.
- **Стандарт:** Playbook: Implementation integrity; resilience
- **Рекомендация:** Сбрасывать флаг только после успешной загрузки чанка (в then внутри lazyWithRetry) или по таймеру (например, после 10 секунд работы), хранить timestamp и ограничивать одной перезагрузкой в минуту.
- **Команда:** `$impeccable harden`
- **Доказательства:** Логика прочитана по main.tsx и App.tsx; цикл не воспроизводился (нужен сбой сети).
- **Источник:** `foundations:lazy-chunk-retry-flag-cleared-before-use-reload-loop`

<a id="map-viewbox-clips-world-edges"></a>

#### [P2] Карта обрезается фиксированным viewBox 800×600: жёсткий вертикальный срез у России/Тихого океана, обрезан юг

`map-viewbox-clips-world-edges` · Целостность реализации · уверенность: likely

- **Где:** `apps/web/src/components/map/RouteMapWithCountries.tsx:273-280`, `apps/web/src/components/map/RouteMapWithCountries.tsx:156-189`, `apps/web/src/components/map/MapCard.tsx:80-98`
- **Экраны:** [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-map-expanded-desktop`](../dashboard-passport-journey/images/passport-map-expanded-desktop.png), [`passport-map-heatmap-desktop`](../dashboard-passport-journey/images/passport-map-heatmap-desktop.png), [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png)
- **Влияние:** ComposableMap без width/height использует viewBox по умолчанию 800×600 с style 100%×100%; при другом аспекте контейнера (широкий expanded 1232×~900, карточка 608×456) содержимое за границами viewBox обрезается — на скриншотах видна ровная вертикальная кромка справа у Чукотки (x≈701 в обычной карточке, x≈1008 в развёрнутой) и срез Антарктиды/юга. Маршруты в Тихоокеанский регион и в Америку могут оказаться за кромкой, а масштаб рассчитывается без учёта размера контейнера.
- **Стандарт:** DESIGN.md: «Data serves the story» (карта должна показывать путешествия, а не терять их)
- **Рекомендация:** Измерять контейнер (ResizeObserver) и передавать width/height в ComposableMap либо использовать projection.fitSize по bbox аэропортов; не полагаться на скалу 3000/span. Добавить проверку в визуальные тесты для expanded и мобильного размеров.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Просмотрены passport-populated-desktop, passport-map-expanded-desktop (Россия обрезана по прямой линии справа, нижняя часть карты обрезана), dashboard-populated-desktop. Причина (дефолтный viewBox react-simple-maps) выведена из кода и документации, не проверена в DevTools.
- **Источник:** `dashboard-passport-journey:map-viewbox-clips-world-edges`

<a id="own-private-profile-stats-section-empty-without-explanation"></a>

#### [P2] У владельца приватного профиля секция «Статистика» пустая, без объяснения и следующего шага

`own-private-profile-stats-section-empty-without-explanation` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/routes/ProfilePage.tsx:166`, `apps/web/src/routes/ProfilePage.tsx:171`, `apps/web/src/components/profile/ProfileSection.tsx:39`
- **Экраны:** [`profile-own-private-desktop`](../public-social/images/profile-own-private-desktop.png)
- **Влияние:** `{stats && <ProfileStats/>}` без emptyState: при stats=null раскрытая секция с заголовком остаётся пустой (на скриншоте — линия под «СТАТИСТИКА» и пустота). Владелец не получает пояснения «профиль закрыт — виден только вам / откройте в настройках». Кроме того, детекция пустоты `!children` не отличает «нет данных» от «ошибка загрузки».
- **Стандарт:** DESIGN.md: «Data serves the story»; empty states
- **Рекомендация:** Передать emptyState в секцию статистики; для isOwnProfile && !is_public — баннер «Профиль закрыт» + кнопка в Settings.
- **Команда:** `$impeccable onboard`
- **Доказательства:** Скриншот profile-own-private-desktop просмотрен; код ProfilePage.tsx:165-173.
- **Источник:** `social-settings:own-private-profile-stats-section-empty-without-explanation`

<a id="profile-section-wrong-voice-for-visitors"></a>

#### [P2] На чужом профиле секция названа «Ваше место», а пустое состояние советует «Добавьте больше рейсов»

`profile-section-wrong-voice-for-visitors` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/routes/ProfilePage.tsx:176`, `apps/web/src/routes/ProfilePage.tsx:181`, `apps/web/src/components/profile/ProfileRankings.tsx:55`
- **Экраны:** [`profile-sections-expanded-mobile`](../public-social/images/profile-sections-expanded-mobile.png), [`profile-public-test-traveler-mobile`](../public-social/images/profile-public-test-traveler-mobile.png), [`profile-public-guest-mobile`](../public-social/images/profile-public-guest-mobile.png)
- **Влияние:** Заголовок использует ключ leaderboard.yourRank («Ваше место»), текст пустого состояния — rankingsEmpty («Добавьте больше рейсов для участия в рейтинге»). Оба обращены к владельцу, но видны гостю/посетителю чужого профиля (скриншот: гость на профиле test-traveler). Вводит в заблуждение и выглядит как ошибка продукта. Сам test-traveler имеет opt-in, пустой рейтинг объясняется пустым cache (см. atlas gaps).
- **Стандарт:** DESIGN.md: «calm, precise»; контентная точность
- **Рекомендация:** Различать isOwnProfile: заголовок «Места в рейтинге», у посетителя — «Пока не в рейтинге» без совета; владельцу — подсказка + ссылка на Settings.
- **Команда:** `$impeccable clarify`
- **Доказательства:** Просмотрены profile-sections-expanded-mobile (guest, «ВАШЕ МЕСТО» + «Добавьте больше рейсов…») и текст snapshot; код ProfilePage.tsx:176-187.
- **Источник:** `social-settings:profile-section-wrong-voice-for-visitors`

<a id="rank-card-eligibility-flash-and-silent-hidden-state"></a>

#### [P2] Карточка «Ваше место»: ложное «Пока недоступно» во время загрузки и молчаливое исчезновение

`rank-card-eligibility-flash-and-silent-hidden-state` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/leaderboard/UserRankCard.tsx:95`, `apps/web/src/routes/LeaderboardPage.tsx:71`, `apps/web/src/components/leaderboard/UserRankCard.tsx:154`, `apps/web/src/components/leaderboard/UserRankCard.tsx:22`
- **Экраны:** [`leaderboard-flights-authenticated-desktop`](../public-social/images/leaderboard-flights-authenticated-desktop.png)
- **Влияние:** totalFlights приходит как `stats?.totalFlights ?? 0`, isLoading учитывает только позиции — пока useFlightStats не загрузился, подходящий пользователь видит «Пока недоступно / Log 5 more flights» (в ru ещё и по-английски). Для opted-in и eligible пользователя без записи в cache (`!position`) карточка просто возвращает null — нет ни «Ещё не посчитано», ни ссылки. MIN_FLIGHTS=5 дублирует серверное правило и текст локалей.
- **Стандарт:** DESIGN.md: accurate data; empty states
- **Рекомендация:** Передавать isLoading статистики, показывать скелетон; для !position — сообщение «Ваш результат появится после следующего пересчёта»; вынести MIN_FLIGHTS в @kuuki/shared.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код UserRankCard.tsx/LeaderboardPage.tsx; скриншот authenticated: у fixture-a 0 полётов (ветка notEligible видна и в ru-локали с английским текстом).
- **Источник:** `social-settings:rank-card-eligibility-flash-and-silent-hidden-state`

<a id="rank-improvement-celebration-repeats-every-visit"></a>

#### [P2] Празднование «+N мест» повторяется при каждом открытии рейтинга

`rank-improvement-celebration-repeats-every-visit` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/leaderboard/UserRankCard.tsx:58`, `apps/web/src/components/leaderboard/UserRankCard.tsx:64`, `apps/web/src/components/leaderboard/UserRankCard.tsx:75`, `apps/web/src/components/leaderboard/UserRankCard.tsx:189`
- **Экраны:** в атласе не снято
- **Влияние:** В ветке улучшения эффект делает return до storeRank(): сохранённый ранг остаётся старым, поэтому при любом следующем монтировании (или смене вкладки категории и возврате) снова срабатывает свечение perimeter-glow и бейдж +N. Анимация infinite 3 с (box-shadow), +N не объявляется, text-success на success/10 = 2.14:1 (light).
- **Стандарт:** DESIGN.md: motion with purpose; WCAG 2.1 SC 1.4.3, SC 4.1.3
- **Рекомендация:** Вызвать storeRank сразу после вычисления улучшения; свечение ограничить одним проходом; +N — role=status, цвет text-success-foreground-токен ≥4.5.
- **Команда:** `$impeccable polish`
- **Доказательства:** Код: единственный storeRank — после ветки с return внутри if; ss_contrast.py: success on success/10 = 2.14 (light), 3.70 (dark).
- **Источник:** `social-settings:rank-improvement-celebration-repeats-every-visit`

<a id="verify-password-collapses-all-errors-to-wrong-password"></a>

#### [P2] Любая ошибка verify-password показывается как «Неверный пароль»; сервер-ошибки — английскими строками

`verify-password-collapses-all-errors-to-wrong-password` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/lib/auth.ts:115`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:101`, `apps/web/src/components/settings/DeleteAccountDialog.tsx:111`, `apps/web/src/lib/auth.ts:136`, `apps/web/src/stores/authStore.ts:33`
- **Экраны:** [`settings-delete-wrong-password-desktop`](../public-social/images/settings-delete-wrong-password-desktop.png)
- **Влияние:** verifyPassword ловит все исключения и возвращает false, поэтому 429, 500, сетевая ошибка или отключённый интернет выглядят как «Неверный пароль. Попробуйте ещё раз» — пользователь перепечатывает пароль и упирается в rate-limit при необратимой операции. Ошибки deleteAccount приходят как ApiError.message/«Failed to delete account»/«Another account action is in progress. Please wait.» без перевода. Пароль проверяется дважды (verify + DELETE) — два запроса к rate-limited эндпоинту.
- **Стандарт:** WCAG 2.1 SC 3.3.1 (A); DESIGN.md i18n EN/RU
- **Рекомендация:** verifyPassword вернуть {ok, reason: wrong|rate|network}; для network/429 показывать отдельный локализованный текст; убрать предварительный verify (сервер уже проверяет в DELETE) или оставить только его; локализовать busyResult и fallback-ы.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код: lib/auth.ts:115-122 (`catch { return false }`), DeleteAccountDialog.tsx:101-106; authStore.ts:33 английская строка. manifest notes подтверждают два запроса (verify-password 200 + DELETE 200).
- **Источник:** `social-settings:verify-password-collapses-all-errors-to-wrong-password`

<a id="collapsible-uses-accordion-keyframes-height-jump"></a>

#### [P2] CollapsibleContent использует keyframes accordion-*: переменная высоты не определена, анимация height 0→auto прыгает

`collapsible-uses-accordion-keyframes-height-jump` · Производительность · уверенность: verified

- **Где:** `apps/web/src/components/profile/ProfileSection.tsx:81`, `apps/web/src/components/common/CollapsibleCard.tsx:94`, `apps/web/src/components/ui/accordion.tsx:58`
- **Экраны:** [`profile-sections-expanded-mobile`](../public-social/images/profile-sections-expanded-mobile.png)
- **Влияние:** tw-animate-css: accordion-down анимирует height до var(--radix-accordion-content-height, … auto). У Collapsible Radix задаёт --radix-collapsible-content-height, поэтому конечное значение = auto, а height 0→auto не интерполируется: контент скрыт до середины анимации и затем резко появляется (и наоборот при закрытии). Плюс сама анимация height — layout-свойство. Для Collapsible нужны animate-collapsible-down/up. CollapsibleCard.tsx в src не используется (мёртвый код).
- **Стандарт:** Playbook: Expensive animations; DESIGN.md: motion tokens
- **Рекомендация:** Заменить на animate-collapsible-down/up, а для плавной высоты использовать grid-template-rows 0fr→1fr (или оставить мгновенный reveal при reduce-motion).
- **Команда:** `$impeccable animate`
- **Доказательства:** Код ProfileSection/CollapsibleCard/accordion и определения keyframes в node_modules/tw-animate-css прочитаны (collapsible-down использует --radix-collapsible-content-height). Рендер не проверялся.
- **Источник:** `foundations:collapsible-uses-accordion-keyframes-height-jump`

<a id="eager-bundle-and-dev-tool-in-prod-chunk"></a>

#### [P2] Входной граф ≈270 KB gzip включает LandingPage/AuthPage/форму и dev-инструмент agentation

`eager-bundle-and-dev-tool-in-prod-chunk` · Производительность · уверенность: verified

- **Где:** `apps/web/src/App.tsx:5-6`, `apps/web/src/App.tsx:12`, `apps/web/src/App.tsx:142`, `apps/web/vite.config.ts:62-110`, `apps/web/package.json:56-57`
- **Экраны:** в атласе не снято
- **Влияние:** dist от 2026-10-04 00:30: входной чанк index--qN_E-Nb.js 435 KB (128 KB gzip) + modulepreload router 18, react-query 13, i18n 18, radix-ui 38, utils 20, forms 34 (zod+react-hook-form, нужны только форме входа), state — суммарно ≈270 KB gzip JS + 24 KB CSS до первого экрана любого маршрута, включая /dashboard. LandingPage и AuthPage импортируются статически (App.tsx:5-6), хотя /landing редкий, а для залогиненных AuthPage не нужен. App.tsx:12 импортирует agentation безусловно (devDependency): в production-чанке есть строка "__agentation_freeze" (verified grep), т.е. код dev-тулбара попадает в прод, хотя рендерится только при import.meta.env.DEV. Положительно: Dashboard/Flights/Import/Passport/Settings/Profile/Leaderboard/Journey lazy, recharts (317 KB) и react-simple-maps (96 KB) не в preload, русский словарь грузится отдельным чанком.
- **Стандарт:** Playbook: Bundle size
- **Рекомендация:** Сделать LandingPage/AuthPage lazy; загружать Agentation через React.lazy внутри import.meta.env.DEV (динамический import) либо вынести в отдельный dev-entry; убрать forms из manualChunks-preload (форма входа ленивая) или разделить; проверить размер agentation через rollup-plugin-visualizer.
- **Команда:** `$impeccable optimize`
- **Доказательства:** Измерены размеры и gzip файлов apps/web/dist/assets, прочитан dist/index.html (modulepreload) и vite.config.ts; размер agentation не измерен. dist собран после коммита 1303485 (в тот же день), но актуальность относительно рабочего дерева не гарантирована.
- **Источник:** `foundations:eager-bundle-and-dev-tool-in-prod-chunk`

<a id="flights-list-no-virtualization"></a>

#### [P2] Список рейсов рендерит все загруженные карточки/строки без виртуализации, подгрузка кнопкой

`flights-list-no-virtualization` · Производительность · уверенность: likely

- **Где:** `apps/web/src/components/flights/FlightList.tsx:262`, `apps/web/src/components/flights/FlightList.tsx:289`, `apps/web/src/components/flights/FlightTable.tsx:243`
- **Экраны:** [`flights-populated-desktop`](../flights-import/images/flights-populated-desktop.png)
- **Влияние:** useInfiniteQuery накапливает страницы по 20; все DOM-узлы остаются, каждая строка таблицы с hover-тенями и множественными Badge. При 500–1000+ рейсах ввод в фильтр и прокрутка тормозят, особенно на мобильном.
- **Стандарт:** Core Web Vitals (INP)
- **Рекомендация:** Подключить @tanstack/react-virtual для таблицы/списка (или хотя бы content-visibility:auto для строк), мемоизировать FlightCard/row через React.memo.
- **Команда:** `$impeccable optimize`
- **Доказательства:** Прочитан FlightList.tsx:262–289 (flights.map без windowing), FlightTable.tsx:243. Производительность при 1000+ рейсов не измерялась (untested).
- **Источник:** `flights-import:flights-list-no-virtualization`

<a id="import-progress-modal-forced-delay-blur"></a>

#### [P2] Искусственные задержки (300мс на рейс + 500 + 400) и backdrop-blur-lg вопреки DESIGN.md

`import-progress-modal-forced-delay-blur` · Производительность · уверенность: verified

- **Где:** `apps/web/src/components/import/FlightProgressModal.tsx:26`, `apps/web/src/components/import/FlightProgressModal.tsx:28`, `apps/web/src/components/import/FlightProgressModal.tsx:30`, `apps/web/src/components/import/FlightProgressModal.tsx:207`, `apps/web/src/components/import/FlightProgressModal.tsx:214`
- **Экраны:** [`import-parsing-text`](../flights-import/images/import-parsing-text.png)
- **Влияние:** Для 20 рейсов пользователь ждёт 6с + 0.9с чисто ради «театра» даже после готового ответа; нет пропуска при prefers-reduced-motion. backdrop-blur на полноэкранном оверлее — дорогой слой на слабых телефонах; DESIGN.md разрешает blur только для тостов.
- **Стандарт:** DESIGN.md: glass blur только для toast; reduced motion; WCAG 2.2.2
- **Рекомендация:** Убрать/сократить reveal (мгновенно при reduced-motion, максимум ~1с суммарно), заменить backdrop-blur на сплошную полупрозрачную заливку.
- **Команда:** `$impeccable quieter`
- **Доказательства:** Прочитаны константы 26–30 и таймеры 108–139; классы 207 и 214. Скриншот import-parsing-text.
- **Источник:** `flights-import:import-progress-modal-forced-delay-blur`

<a id="map-rerenders-on-every-filter-keystroke"></a>

#### [P2] Карта не мемоизирована: каждый ввод в поле фильтра перерисовывает 177 Geography

`map-rerenders-on-every-filter-keystroke` · Производительность · уверенность: likely

- **Где:** `apps/web/src/routes/DashboardPage.tsx:78-79`, `apps/web/src/routes/DashboardPage.tsx:255-261`, `apps/web/src/components/map/MapCard.tsx:21`, `apps/web/src/components/map/MapCard.tsx:8-10`, `apps/web/src/components/map/RouteMapWithCountries.tsx:299-319`, `apps/web/src/components/map/RouteMapWithCountries.tsx:380`
- **Экраны:** [`dashboard-origin-filter-tbs-desktop`](../dashboard-passport-journey/images/dashboard-origin-filter-tbs-desktop.png), [`dashboard-add-flight-origin-suggestions-desktop`](../dashboard-passport-journey/images/dashboard-add-flight-origin-suggestions-desktop.png)
- **Влияние:** originSearch/destSearch хранятся в DashboardPage, поэтому каждый символ ререндерит страницу → MapCard (не memo) → RouteMapWithCountries. memo(RouteMapWithCountries) объявлен как default export (380), но MapCard импортирует именованный (9), то есть мемоизация не работает; в рендере каждый из 177 Geography вызывает getCountryColor/getCountryData и создаёт новые объекты style; через 150ms debounce setFilters вызывает второй полный ререндер. Передаваемые пропсы стабильны (useMemo), т.е. фикс дешёвый. Не профилировалось.
- **Рекомендация:** Обернуть MapCard и содержимое Geographies в React.memo/useMemo по [visitedSet, showRoutes, heatmapMode], использовать default memo-экспорт, вынести поля поиска в FlightFilters (локальное состояние) и отдавать наверх только debounced-значение.
- **Команда:** `$impeccable optimize`
- **Доказательства:** Прочитан код цепочки пропсов; цена ререндера оценена по числу узлов (177 path + рёбра), реальный profiler не запускался.
- **Источник:** `dashboard-passport-journey:map-rerenders-on-every-filter-keystroke`

<a id="map-topojson-third-party-cdn-no-fallback"></a>

#### [P2] Геометрия карты тянется на каждый запуск со стороннего CDN без fallback и обработки ошибок

`map-topojson-third-party-cdn-no-fallback` · Производительность · уверенность: verified

- **Где:** `apps/web/src/components/map/RouteMapWithCountries.tsx:19`, `apps/web/src/components/journey/JourneyMap.tsx:15`, `apps/web/src/public/_headers:5`, `packages/data/src/index.ts:164`
- **Экраны:** [`dashboard-populated-desktop`](../dashboard-passport-journey/images/dashboard-populated-desktop.png), [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`dashboard-filtered-2025-desktop`](../dashboard-passport-journey/images/dashboard-filtered-2025-desktop.png), [`dashboard-map-expanded-desktop`](../dashboard-passport-journey/images/dashboard-map-expanded-desktop.png), [`dashboard-map-routes-off-desktop`](../dashboard-passport-journey/images/dashboard-map-routes-off-desktop.png), [`passport-populated-desktop`](../dashboard-passport-journey/images/passport-populated-desktop.png), [`passport-populated-mobile`](../dashboard-passport-journey/images/passport-populated-mobile.png), [`passport-map-expanded-desktop`](../dashboard-passport-journey/images/passport-map-expanded-desktop.png), [`passport-map-heatmap-desktop`](../dashboard-passport-journey/images/passport-map-heatmap-desktop.png), [`passport-map-routes-off-desktop`](../dashboard-passport-journey/images/passport-map-routes-off-desktop.png), [`passport-map-countries-off-desktop`](../dashboard-passport-journey/images/passport-map-countries-off-desktop.png), [`journey-initial-desktop`](../dashboard-passport-journey/images/journey-initial-desktop.png)
- **Влияние:** GEO_URL = cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json (без версии-пина патча, без SRI) запрашивается рантаймом на Dashboard, Passport и Journey; если CDN недоступен/заблокирован, карта остаётся пустой без сообщения об ошибке. Единственный внешний хост добавлен в CSP connect-src (Report-Only), а airline-логотипы Journey идут с airlabs.co — при переводе CSP в enforce img-src 'self' data: их заблокирует. Дополнительный DNS/TLS-хоп на критическом пути первой отрисовки карты.
- **Стандарт:** DESIGN.md/PRODUCT.md: «Success means … fast import»; CSP в public/_headers
- **Рекомендация:** Положить countries-110m.json в public/ (или импортировать через ?url), добавить <link rel="preload">, обработать ошибку загрузки (empty-state с retry); для логотипов — прокси/локальные ассеты или расширить img-src осознанно.
- **Команда:** `$impeccable optimize`
- **Доказательства:** Прочитан код и public/_headers. Сетевое поведение не измерялось (по правилам аудита браузер не запускался).
- **Источник:** `dashboard-passport-journey:map-topojson-third-party-cdn-no-fallback`

<a id="windloader-animates-left-infinite"></a>

#### [P2] WindLoader бесконечно анимирует left у 6+3+2+8 элементов и использует Math.random в render

`windloader-animates-left-infinite` · Производительность · уверенность: verified

- **Где:** `apps/web/src/components/common/WindLoader.tsx:47-60`, `apps/web/src/components/common/WindLoader.tsx:128-139`, `apps/web/src/components/common/WindLoader.tsx:165-227`
- **Экраны:** в атласе не снято
- **Влияние:** keyframes wind-streak/cloud-drift/particle-float меняют left (layout-свойство) постоянно — ~19 анимированных узлов на экране импорта, пока идёт разбор файла (самый тяжёлый момент для CPU на мобильном). top/left процент пересчитываются в layout. Math.random() в теле компонента меняет позиции частиц при каждом ререндере (родитель обновляет шаги). Нет role=status/aria-live для смены шага; радиальные #E8F4FC/#B8DDF0 фиксированы (допустимо как иллюстрация).
- **Стандарт:** Playbook: Expensive animations (layout properties); DESIGN.md: motion
- **Рекомендация:** Перевести на transform: translateX() (задавать left:0 и двигать через translate), посчитать случайные значения один раз в useMemo/useRef, добавить role="status" aria-live="polite" на текст шага.
- **Команда:** `$impeccable optimize`
- **Доказательства:** Прочитан WindLoader.tsx. Профилирование не выполнялось.
- **Источник:** `foundations:windloader-animates-left-infinite`

<a id="auth-mobile-no-language-toggle"></a>

#### [P2] На мобильном экране входа нет переключателя языка

`auth-mobile-no-language-toggle` · Адаптивность · уверенность: verified

- **Где:** `apps/web/src/routes/AuthPage.tsx:109-117`, `apps/web/src/lib/i18n.ts:10-12`
- **Экраны:** [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`auth-register-mobile`](../public-social/images/auth-register-mobile.png)
- **Влияние:** Язык определяется по navigator.language; русскоязычный пользователь с английским интерфейсом телефона не может переключить язык до входа в аккаунт (на лендинге и онбординге переключатель есть, на auth его нет).
- **Стандарт:** PRODUCT.md: i18n EN/RU; DESIGN.md: единообразие управления
- **Рекомендация:** Убрать hidden lg:flex у кнопки языка; на мобильном оставить три иконки (внешний вид, помощь, язык) с мин. 44px; при необходимости перенести в строку над формой.
- **Команда:** `$impeccable adapt`
- **Доказательства:** AuthPage.tsx:114 className="hidden lg:flex ...". Atlas snapshot auth-signin-mobile.txt / auth-register-mobile.txt: кнопки «Appearance» и «What is Kuuki?» есть, «Toggle language» нет; в desktop-снимках она есть. Смотрел auth-signin-mobile.png.
- **Источник:** `entry:auth-mobile-no-language-toggle`

<a id="badge-toast-motion-glow-and-overlaps-mobile-tab-bar"></a>

#### [P2] Toast наград: бесконечные pulse/sparkle, цветное свечение, перекрывает нижнюю панель на mobile

`badge-toast-motion-glow-and-overlaps-mobile-tab-bar` · Адаптивность · уверенность: likely

- **Где:** `apps/web/src/components/badges/BadgeNotificationToast.tsx:58`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:69`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:81`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:100`, `apps/web/src/components/layout/MobileTabBar.tsx:54`
- **Экраны:** [`settings-data-export-success-desktop`](../public-social/images/settings-data-export-success-desktop.png)
- **Влияние:** fixed bottom-6 z-50 при MobileTabBar fixed bottom-0 h≈64px+safe-area z-50: на mobile toast на 6 с накрывает вкладки навигации. animate-pulse и sparkle — infinite; свечение `shadow-[0_0_40px_rgba(234,179,8,.3)]` поверх border + shadow-md нарушает «один материал»; `rgba(var(--primary),0.4)` невалидно (--primary — oklch), у «Founding Crew» тень отбрасывается браузером; градиентные yellow→amber литералы; белая иконка на yellow-500 1.91:1. Общий reduced-motion схлопывает анимацию до 0.01ms (прогресс-бар исчезает мгновенно).
- **Стандарт:** DESIGN.md: one material; ease-out; tokens over literals; WCAG 2.1 SC 2.3.3 (AAA) / reduced-motion
- **Рекомендация:** Позиция: bottom: calc(var(--tab-bar)+safe+12px) на <sm; убрать infinite-анимации; тень — один слой или border; цвета из токенов (--primary/--warning); для prefers-reduced-motion — статичный прогресс.
- **Команда:** `$impeccable animate`
- **Доказательства:** Код + index.css:523-560 (keyframes) и 272-281/1069-1078 (reduced motion); MobileTabBar.tsx:54 (z-50 fixed). Столкновение на устройстве не проверялось (расчёт по CSS).
- **Источник:** `social-settings:badge-toast-motion-glow-and-overlaps-mobile-tab-bar`

<a id="journey-layout-timeline-offscreen-and-mobile-header-wrap"></a>

#### [P2] Journey: на десктопе 1440×1000 таймлайн вытесняется за экран (h-screen + overflow-hidden), на мобильном шапка ломается

`journey-layout-timeline-offscreen-and-mobile-header-wrap` · Адаптивность · уверенность: likely

- **Где:** `apps/web/src/routes/JourneyPlannerPage.tsx:33`, `apps/web/src/routes/JourneyPlannerPage.tsx:37-65`, `apps/web/src/routes/JourneyPlannerPage.tsx:67-68`, `apps/web/src/routes/JourneyPlannerPage.tsx:77`, `apps/web/src/components/journey/JourneyMap.tsx:58-64`
- **Экраны:** [`journey-initial-desktop`](../dashboard-passport-journey/images/journey-initial-desktop.png), [`journey-reordered-desktop`](../dashboard-passport-journey/images/journey-reordered-desktop.png), [`journey-initial-mobile`](../dashboard-passport-journey/images/journey-initial-mobile.png), [`journey-full-mobile`](../dashboard-passport-journey/images/journey-full-mobile.png)
- **Влияние:** main — h-screen overflow-hidden; карта в flex-1 h-full с SVG (ComposableMap, 100%×100%) вынуждает контейнер занять всю высоту, а таймлайн (h-80 shrink-0) уходит ниже края: на journey-initial-desktop его нет на экране (в DOM он есть), на journey-reordered-desktop страница оказалась прокручена. Пользователь с колесом/тачпадом не может прокрутить overflow-hidden-контейнер. На 390px шапка (absolute, pointer-events-none) схлопывает заголовок в 3 строки и дату в «Oct / 24 — / Nov / 12»; 100vh вместо dvh на мобильном Safari.
- **Стандарт:** WCAG 2.1 SC 1.4.10 Reflow (AA)
- **Рекомендация:** Сделать main grid/flex-col с min-h-0 у области карты (flex-1 min-h-0) и h-dvh; шапку — в потоке (sticky) с flex-wrap/сокращением даты; ограничить высоту карты.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Просмотрены journey-initial-desktop (таймлайна нет), journey-reordered-desktop, journey-initial-mobile (3-строчный заголовок). Причина выведена из CSS-классов и не подтверждена DevTools; поэтому confidence likely.
- **Источник:** `dashboard-passport-journey:journey-layout-timeline-offscreen-and-mobile-header-wrap`

<a id="map-touch-scroll-and-wheel-hijack"></a>

#### [P2] Карта перехватывает вертикальный свайп и колесо: прокрутка страницы застревает на карте

`map-touch-scroll-and-wheel-hijack` · Адаптивность · уверенность: likely

- **Где:** `apps/web/src/components/map/RouteMapWithCountries.tsx:281-287`, `apps/web/src/routes/DashboardPage.tsx:250`, `apps/web/src/routes/PassportPage.tsx:122`
- **Экраны:** [`dashboard-populated-mobile`](../dashboard-passport-journey/images/dashboard-populated-mobile.png), [`dashboard-filters-expanded-mobile`](../dashboard-passport-journey/images/dashboard-filters-expanded-mobile.png), [`passport-populated-mobile`](../dashboard-passport-journey/images/passport-populated-mobile.png)
- **Влияние:** ZoomableGroup подключает d3-zoom@2 к <svg>: touchmove вызывает preventDefault (noevent), а фильтр react-simple-maps пропускает wheel без ctrl — однопальцевый свайп по карте двигает карту, а не страницу, и колесо мыши зумит карту вместо скролла. На 390×844 карта занимает ≈360–400px (min-h-[400px]) почти половину экрана, подсказки «двумя пальцами»/ctrl+scroll нет.
- **Стандарт:** WCAG 2.1 SC 2.1.1/2.5.1 (gestures, косвенно); DESIGN.md mobile
- **Рекомендация:** Передать filterZoomEvent: на touch требовать два пальца (event.touches.length > 1), на wheel — ctrlKey/метакey; добавить touch-action: pan-y на svg; показывать hint; либо на мобильном сделать карту статичной с открытием на весь экран.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Прочитан код d3-zoom 2.0.0 (zoom.js:340-346 touchmoved → noevent) и react-simple-maps dist (filterFunc: !ctrlKey && !button). Реальный жест не синтезировался.
- **Источник:** `dashboard-passport-journey:map-touch-scroll-and-wheel-hijack`

<a id="profile-private-badge-detached-and-privacy-message-duplicated"></a>

#### [P2] Бейдж «Приватный» уплывает от аватара; сообщение о приватности показано дважды

`profile-private-badge-detached-and-privacy-message-duplicated` · Адаптивность · уверенность: verified

- **Где:** `apps/web/src/components/profile/ProfileHeader.tsx:56`, `apps/web/src/components/profile/ProfileHeader.tsx:72`, `apps/web/src/components/profile/ProfileHeader.tsx:146`, `apps/web/src/routes/ProfilePage.tsx:135`
- **Экраны:** [`profile-own-private-desktop`](../public-social/images/profile-own-private-desktop.png), [`profile-private-guest-mobile`](../public-social/images/profile-private-guest-mobile.png), [`profile-private-guest-desktop`](../public-social/images/profile-private-guest-desktop.png)
- **Влияние:** Контейнер `relative mb-6` занимает всю ширину, поэтому `absolute -bottom-1 -right-1` ставит бейдж у правого края колонки (на desktop ~600px от аватара, на mobile — справа от аватара в воздухе). Для гостя сообщение «Этот пользователь предпочитает приватность» выводится в плашке в шапке и ещё раз в размытой карточке ниже (backdrop-blur над декоративной «скелет»-подложкой).
- **Стандарт:** DESIGN.md: one material, blur только для toasts; чистота иерархии
- **Рекомендация:** Обернуть аватар в `relative w-fit`; оставить одно сообщение (в шапке или в карточке), убрать backdrop-blur и фиктивные плейсхолдеры либо пометить aria-hidden.
- **Команда:** `$impeccable layout`
- **Доказательства:** Скриншоты profile-own-private-desktop (бейдж справа у x≈1000) и profile-private-guest-mobile (две одинаковые строки) просмотрены; код ProfileHeader.tsx:56-80, ProfilePage.tsx:135-153.
- **Источник:** `social-settings:profile-private-badge-detached-and-privacy-message-duplicated`

<a id="settings-segmented-theme-control-overflows-card-on-mobile"></a>

#### [P2] На 390px сегмент «Светлая/Тёмная/Системная» вылезает за границу карточки

`settings-segmented-theme-control-overflows-card-on-mobile` · Адаптивность · уверенность: verified

- **Где:** `apps/web/src/components/settings/AppearanceSection.tsx:36`, `apps/web/src/components/settings/AppearanceSection.tsx:50`
- **Экраны:** [`settings-main-mobile`](../public-social/images/settings-main-mobile.png)
- **Влияние:** inline-flex без wrap/overflow: три кнопки px-4 + иконка + подпись ≈335px при ширине контента карточки ≈294px; на скриншоте «Системная» уходит к краю экрана за рамку карточки. В RU надписи длиннее EN, при увеличенном шрифте хуже.
- **Стандарт:** WCAG 2.1 SC 1.4.10 Reflow (AA)/DESIGN.md mobile 390
- **Рекомендация:** На <sm: display:grid grid-cols-3 w-full, подписи text-xs/без иконок, или вертикальный список; min-w-0.
- **Команда:** `$impeccable adapt`
- **Доказательства:** Скриншот settings-main-mobile просмотрен (кнопка «Системная» выходит за рамку карточки); расчёт ширины по px-6 страницы и карточки.
- **Источник:** `social-settings:settings-segmented-theme-control-overflows-card-on-mobile`

<a id="activate-page-off-system-theme-tokens"></a>

#### [P2] Страница /activate выпадает из системы: hex-литералы, бирюзовый бренд, system-ui, игнорирует тему приложения

`activate-page-off-system-theme-tokens` · Темы и токены · уверенность: verified

- **Где:** `apps/web/public/activate.html:9-21`
- **Экраны:** [`activation-token-form-desktop`](../public-social/images/activate-token-form-desktop.png), [`activation-no-token-desktop`](../public-social/images/activate-no-token-desktop.png), [`activation-no-token-mobile`](../public-social/images/activate-no-token-mobile.png), [`activation-password-mismatch-desktop`](../public-social/images/activate-password-mismatch-desktop.png)
- **Влияние:** Пользователь после регистрации в «красном» приложении видит бирюзовую кнопку #176782 и системный шрифт: выглядит как чужой/фишинговый сайт именно на экране ввода пароля. Выбранная в приложении тема (light/dark/system) и акцент не применяются, а граница поля в светлой теме 2.8:1.
- **Стандарт:** DESIGN.md: «токены вместо литералов», DM Sans, один акцент; WCAG 2.1 SC 1.4.11 (граница поля)
- **Рекомендация:** Подключить те же шрифты и токены (минимальный набор --background/--card/--primary/--border как CSS-переменные в activate.html, значения из index.css), читать kuuki-theme и kuuki-accent-color из localStorage, поднять границу поля до >=3:1, добавить <link rel="icon">.
- **Команда:** `$impeccable polish`
- **Доказательства:** activate.html:9-21 — цвета #f4f7f9, #17242b, #dbe5eb, #176782, #8c9da8, #101b22 и др. литералами; font-family: system-ui. Посчитал: граница поля #8c9da8 на белом = 2.8:1 (светлая схема); белый на #176782 = 6.37:1, ссылка 6.37:1 (проходят). Тема берётся только из prefers-color-scheme, чтение localStorage отсутствует. Нет <link rel="icon">. Снимки активации в тёмной схеме ОС: бирюзовая кнопка в окружении красного приложения.
- **Источник:** `entry:activate-page-off-system-theme-tokens`

<a id="journey-timeline-white-literals-invisible"></a>

#### [P2] Коннекторы и кнопка добавления сегмента в таймлайне Journey захардкожены bg-white/10, border-white/20, text-white/30 — на светлой карточке их нет

`journey-timeline-white-literals-invisible` · Темы и токены · уверенность: verified

- **Где:** `apps/web/src/components/journey/JourneyTimeline.tsx:54`, `apps/web/src/components/journey/JourneyTimeline.tsx:56`, `apps/web/src/components/journey/JourneyTimeline.tsx:68-69`, `apps/web/src/components/journey/JourneyTimeline.tsx:75-76`
- **Экраны:** [`journey-reordered-desktop`](../dashboard-passport-journey/images/journey-reordered-desktop.png), [`journey-initial-mobile`](../dashboard-passport-journey/images/journey-initial-mobile.png), [`journey-full-mobile`](../dashboard-passport-journey/images/journey-full-mobile.png)
- **Влияние:** Линии между сегментами и пунктирный круг «+» (text-white/30, border-white/20) почти не отличаются от светлого --card (контраст ≈1.01:1): на скриншотах между карточками нет соединителей, а кнопки добавления не видно. Комментарий в коде «Cinematic Style» указывает на перенос стиля из тёмной темы. DESIGN.md отдельно запрещает hard-coded цвета на journey/map страницах.
- **Стандарт:** WCAG 2.1 SC 1.4.11 (AA); DESIGN.md «Don't hard-code slate/indigo hex on journey or map pages»
- **Рекомендация:** Заменить на bg-border / border-border / text-muted-foreground и hover:text-foreground; подпись и aria-label добавить кнопке. JourneyMap/GanttBlock уже используют токены — выровнять.
- **Команда:** `$impeccable colorize`
- **Доказательства:** Расчёт: white/30 на --card = 1.009:1, white/20 = 1.006:1. На journey-reordered-desktop между карточками нет соединительных линий, в конце ряда нет кнопки «+».
- **Источник:** `dashboard-passport-journey:journey-timeline-white-literals-invisible`

<a id="selected-option-contrast-light"></a>

#### [P2] Выбранная опция автокомплита: primary-foreground при opacity 60–75 даёт 2.8–3.6:1 в светлой теме

`selected-option-contrast-light` · Темы и токены · уверенность: verified

- **Где:** `apps/web/src/components/flights/AirportAutocomplete.tsx:215`, `apps/web/src/components/flights/AirportAutocomplete.tsx:216`
- **Экраны:** [`flight-origin-suggestions`](../flights-import/images/flight-origin-suggestions.png)
- **Влияние:** Подстрока (город/название) на выбранной строке списка (bg-primary) с opacity-60/75: 2.83:1/3.55:1 при размере xs; чистый primary-foreground даёт 5.0:1.
- **Стандарт:** WCAG 2.1 SC 1.4.3 (AA)
- **Рекомендация:** Убрать opacity-модификаторы для текста на bg-primary, различать иерархию размером/весом.
- **Команда:** `$impeccable colorize`
- **Доказательства:** Рассчитано contrast_fi.py: pf/75 на primary 3.55, pf/60 2.83, solid 5.0 (light); dark 5.13/3.64/7.62.
- **Источник:** `flights-import:selected-option-contrast-light`

<a id="theme-bootstrap-theme-color-color-scheme-flash"></a>

#### [P2] Начальная инициализация темы: theme-color обновляется не тот meta, нет color-scheme и inline-скрипта до первой отрисовки

`theme-bootstrap-theme-color-color-scheme-flash` · Темы и токены · уверенность: likely

- **Где:** `apps/web/index.html:9-10`, `apps/web/src/hooks/useTheme.ts:7`, `apps/web/src/hooks/useTheme.ts:66-71`, `apps/web/src/main.tsx:13-16`, `apps/web/src/index.css:243-254`
- **Экраны:** [`settings-dark-theme-desktop`](../public-social/images/settings-dark-theme-desktop.png), [`settings-system-theme-desktop`](../public-social/images/settings-system-theme-desktop.png)
- **Влияние:** 1) updateThemeColor() делает querySelector("meta[name=theme-color]") — первый, это meta с media=(prefers-color-scheme: dark); второй meta (#fafafa, light) не трогается. Дефолтный режим — dark (DEFAULT_MODE), поэтому у пользователя с светлой ОС в браузере с тёмным приложением строка статуса остаётся светлой (#fafafa); обратная пара срабатывает. 2) color-scheme не объявлен нигде (rg): нативные контролы, автозаполнение, scrollbar в Firefox/Safari, date/select-попапы остаются светлыми в тёмной теме. 3) Тема применяется в main.tsx после загрузки бандла (~128 KB gz), в index.html нет inline-скрипта, поэтому пользователи dark (дефолт) видят белую вспышку до инициализации. 4) Цвета #FAFAFA/#08090A вшиты в useTheme.ts и расходятся с токенами (--background тёмной темы ≈ #17181b).
- **Стандарт:** DESIGN.md: токены; playbook: Theme switching issues
- **Рекомендация:** Добавить в index.html inline-скрипт (класс dark, color-scheme, theme-color) до CSS; в index.css задать :root{color-scheme:light} .dark{color-scheme:dark}; обновлять оба meta или один без media; брать цвет из getComputedStyle(--background).
- **Команда:** `$impeccable harden`
- **Доказательства:** Код useTheme.ts/main.tsx/index.html прочитан; rg color-scheme по src и index.html — пусто. Вспышка не наблюдалась в браузере (не запускался), поэтому п.3 likely.
- **Источник:** `foundations:theme-bootstrap-theme-color-color-scheme-flash`

<a id="toast-sonner-styles-unlayered-theme-not-set"></a>

#### [P2] Тосты sonner: Tailwind-классы проигрывают unlayered CSS sonner и не передан theme; статус-цвета ниже AA

`toast-sonner-styles-unlayered-theme-not-set` · Темы и токены · уверенность: likely

- **Где:** `apps/web/src/components/error/ToastProvider.tsx:17-51`
- **Экраны:** в атласе не снято
- **Влияние:** sonner@2.0.7 вставляет стили вне @layer ([data-sonner-toast][data-styled=true]{background:var(--normal-bg);color:var(--normal-text)…}), Tailwind v4 utilities лежат в @layer utilities, поэтому bg-card/text-foreground/border-border из classNames, скорее всего, не применяются; theme не передан (по умолчанию light) — в тёмной теме тост остаётся светлым или рассинхронизируется. Дополнительно error: text-destructive на destructive/5 = 3.23:1 (light), success: text-success на success/5 = 2.18:1 (light). closeButton у sonner — маленькая кнопка без 44px.
- **Стандарт:** WCAG 2.1 SC 1.4.3 (AA); DESIGN.md: тема токенами
- **Рекомендация:** Передать theme из useTheme().resolvedTheme и задать sonner-переменные через style: --normal-bg: var(--popover), --normal-text: var(--popover-foreground), --normal-border: var(--border), --success-*/--error-* через токены текстовых статусов; либо unstyled + classNames. Проверить в обеих темах.
- **Команда:** `$impeccable polish`
- **Доказательства:** Прочитан ToastProvider.tsx и CSS sonner в node_modules (нет @layer, data-sonner-theme=light/dark переменные). Тост не присутствует ни в одном состоянии атласа и не рендерился, поэтому уверенность likely.
- **Источник:** `foundations:toast-sonner-styles-unlayered-theme-not-set`

### P3 — 11

<a id="orphaned-components-and-dead-css"></a>

#### [P3] Осиротевший код: /landing без входящих ссылок, compare/*, legacy dashboard-компоненты, неиспользуемый CSS и AtmosphericCard

`orphaned-components-and-dead-css` · Целостность реализации · уверенность: verified · системная

- **Где:** `apps/web/src/App.tsx:5`, `apps/web/src/App.tsx:68`, `apps/web/src/components/landing/HeroSection.tsx:5-33`, `apps/web/src/components/landing/FeatureGrid.tsx:3-7`, `apps/web/src/components/landing/index.ts:1-2`, `apps/web/src/components/dashboard/index.ts:7-25`, `apps/web/src/components/dashboard/UpcomingFlightsCard.tsx:1`, `apps/web/src/components/dashboard/RecentFlights.tsx:1`, `apps/web/src/components/dashboard/StatsCards.tsx:1`, `apps/web/src/components/dashboard/TravelSummaryCard.tsx:1`, `apps/web/src/components/dashboard/DashboardCard.tsx:28`, `apps/web/src/components/map/MapCollapsible.tsx:28`, `apps/web/src/components/map/RouteMap.tsx:27`, `apps/web/src/components/passport/CountryClaimMap.tsx:212`, `apps/web/src/components/passport/PassportStamps.tsx:249`, `apps/web/src/components/compare/CompareModal.tsx:1`, `apps/web/src/components/profile/ProfileSettingsDialog.tsx:1`, `apps/web/src/components/profile/ThemeColorPicker.tsx:11`, `apps/web/src/components/badges/BadgeProgress.tsx:18`, `apps/web/src/hooks/useCompare.ts:8`, `apps/web/src/index.css:109-128`, `apps/web/src/index.css:370`, `apps/web/src/index.css:571-581`, `apps/web/src/index.css:693-712`, `apps/web/src/components/ui/AtmosphericCard.tsx:66`, `apps/web/src/components/badges/BadgeNotificationToast.tsx:69`
- **Экраны:** [`landing-desktop`](../public-social/images/landing-desktop.png), [`landing-features-desktop`](../public-social/images/landing-features-desktop.png)
- **Влияние:** Мёртвый UI тянет устаревшие стили и недостающие ключи, путает при редизайне и увеличивает бандл (LandingPage в основном чанке).
- **Рекомендация:** Удалить или явно пометить прототипы; /landing либо подключить к воронке, либо убрать маршрут. Использовать skill prune-dead-code.
- **Команда:** `$impeccable distill`
- **Доказательства:** Объединены находки четырёх срезов; импорты проверены по коду.
- **Источник:** `entry:landing-orphan-route-and-dead-components`, `dashboard-passport-journey:dead-legacy-components-and-prototype-map`, `social-settings:orphaned-compare-profile-settings-badge-progress-code`, `foundations:dead-css-invalid-rgba-and-unused-atmospheric-card`

<details><summary>Доказательства срезов</summary>

- [entry:landing-orphan-route-and-dead-components] grep по src: нет ссылок на /landing (кроме Route) и нет импортов HeroSection/FeatureGrid кроме barrel index.ts. App.tsx:5 статический import LandingPage, остальные страницы lazy. Смотрел landing-desktop.png: hero + featured-карточка + три компактные, без эмодзи (то есть актуальная LandingPage уже отличается от мёртвых компонентов).
- [dashboard-passport-journey:dead-legacy-components-and-prototype-map] grep по импортам: единственные упоминания — сами файлы и dashboard/index.ts.
- [social-settings:orphaned-compare-profile-settings-badge-progress-code] grep по импортам: единственные ссылки — внутри самих файлов; ProfilePage не использует compare.
- [foundations:dead-css-invalid-rgba-and-unused-atmospheric-card] rg по каждому имени класса/keyframes в *.tsx без тестов; прочитаны index.css и AtmosphericCard.tsx.

</details>

<a id="layout-property-animations"></a>

#### [P3] Анимации max-height / bottom / height при раскрытии строк, карты Passport и шторки

`layout-property-animations` · Производительность · уверенность: verified · системная

- **Где:** `apps/web/src/routes/PassportPage.tsx:116`, `apps/web/src/routes/PassportPage.tsx:122`, `apps/web/src/routes/PassportPage.tsx:136`, `apps/web/src/components/map/MapCard.tsx:81`, `apps/web/src/components/ui/sheet.tsx:81`, `apps/web/src/components/import/FlightEditRow.tsx:306`, `apps/web/src/components/ui/sheet.tsx:75-83`, `apps/web/src/components/ui/sheet.tsx:106-110`, `apps/web/src/components/error/CrashScreen.tsx:32`, `apps/web/src/routes/JourneyPlannerPage.tsx:33`
- **Экраны:** [`passport-map-expanded-desktop`](../dashboard-passport-journey/images/passport-map-expanded-desktop.png), [`passport-country-picker-mobile`](../dashboard-passport-journey/images/passport-country-picker-mobile.png), [`import-review-expanded`](../flights-import/images/import-review-expanded.png), [`flight-add-form-mobile`](../flights-import/images/flight-add-form-mobile.png)
- **Влияние:** Небольшие рывки на слабых телефонах и жёсткий лимит max-height 400px, который может обрезать контент.
- **Стандарт:** impeccable audit: layout-property animation
- **Рекомендация:** Перейти на grid-template-rows 0fr→1fr или transform/opacity; в sheet использовать dvh и transform.
- **Команда:** `$impeccable animate`
- **Доказательства:** Детектор: ui/sheet.tsx:81 (confirmed). Вручную: FlightEditRow.tsx:306, PassportPage.tsx:116/122.
- **Источник:** `dashboard-passport-journey:layout-property-transitions-on-expand`, `flights-import:import-row-layout-animation`, `foundations:sheet-keyboard-transition-vh-and-fake-drag-handle`

<details><summary>Доказательства срезов</summary>

- [dashboard-passport-journey:layout-property-transitions-on-expand] Код прочитан, фактический jank не измерялся.
- [flights-import:import-row-layout-animation] Детектор: sheet.tsx:81 transition max-height подтверждён; аналогичный паттерн найден вручную в FlightEditRow.tsx:306.
- [foundations:sheet-keyboard-transition-vh-and-fake-drag-handle] Код sheet.tsx прочитан; в скриншотах flight-add-form-mobile и passport-country-picker-mobile видна ручка. Жесты на устройстве не проверялись.

</details>

<a id="upcoming-banner-semantics-and-delete-icon"></a>

#### [P3] Баннер предстоящего рейса: нет региона/имени, десятипиксельный бейдж, удаление под значком «×»

`upcoming-banner-semantics-and-delete-icon` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/dashboard/UpcomingFlightsBanner.tsx:59-115`
- **Экраны:** [`dashboard-upcoming-banner-desktop`](../dashboard-passport-journey/images/dashboard-upcoming-banner-desktop.png), [`dashboard-upcoming-delete-confirm-desktop`](../dashboard-passport-journey/images/dashboard-upcoming-delete-confirm-desktop.png)
- **Влияние:** Баннер — безымянный div (не region/status), бейдж 10px uppercase, 28px иконки (на touch их поднимет глобальное правило до 44px), действие удаления нарисовано крестиком X, который читается как «закрыть баннер»; название рейса дублируется кнопкой и отдельным карандашом. Подтверждающий диалог защищает от случайного удаления (плюс).
- **Стандарт:** WCAG 2.1 SC 1.3.1, SC 3.3.4 (смягчено подтверждением)
- **Рекомендация:** Дать баннеру role="region" aria-label «Ближайший рейс», заменить X на иконку корзины, поднять бейдж до 12px.
- **Команда:** `$impeccable polish`
- **Доказательства:** Код прочитан; скриншоты dashboard-upcoming-banner-desktop и dashboard-upcoming-delete-confirm-desktop просмотрены (диалог подтверждения есть).
- **Источник:** `dashboard-passport-journey:upcoming-banner-semantics-and-delete-icon`

<a id="what-is-kuuki-dialog-a11y-gaps"></a>

#### [P3] WhatIsKuukiDialog: нет описания и видимого заголовка, кнопка закрытия 32px

`what-is-kuuki-dialog-a11y-gaps` · Доступность · уверенность: verified

- **Где:** `apps/web/src/components/auth/WhatIsKuukiDialog.tsx:41`, `apps/web/src/components/auth/WhatIsKuukiDialog.tsx:45-48`, `apps/web/src/components/auth/WhatIsKuukiDialog.tsx:40`
- **Экраны:** [`auth-about-dialog-desktop`](../public-social/images/auth-about-dialog-desktop.png)
- **Влияние:** Radix предупреждает об отсутствии Description; заголовок только sr-only, поэтому зрячий пользователь не видит, что это за окно; кнопка «×» p-2 + иконка 16px = 32px, на тёмном фоне без собственного фокус-стиля (опирается на глобальный :focus-visible).
- **Стандарт:** DESIGN.md: цели касания 44x44; WCAG 2.1 SC 2.5.5 (AAA) как ориентир
- **Рекомендация:** Добавить DialogDescription (sr-only) и видимый DialogTitle, сделать закрытие 44px, использовать t("common.close").
- **Команда:** `$impeccable polish`
- **Доказательства:** Читал WhatIsKuukiDialog.tsx: DialogTitle sr-only, DialogDescription нет, DialogClose p-2 rounded-full. Смотрел auth-about-dialog-desktop.png: заголовка в окне нет, только список. Положительно: фокус-ловушка, Esc и возврат фокуса обеспечивает Radix.
- **Источник:** `entry:what-is-kuuki-dialog-a11y-gaps`

<a id="import-review-index-keys-and-dup-actions"></a>

#### [P3] Строки ревью используют key={index}; состояние раскрытия/годов привязано к позиции

`import-review-index-keys-and-dup-actions` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/import/ImportReview.tsx:427`
- **Экраны:** [`import-review-expanded`](../flights-import/images/import-review-expanded.png)
- **Влияние:** При удалении строки React переиспользует состояние следующей строки (expanded, открытый popover подтверждения года), раскрытая форма «переезжает» на другой рейс.
- **Рекомендация:** Генерировать стабильные id (crypto.randomUUID при разборе) и использовать как key и ключ selectedIds.
- **Команда:** `$impeccable harden`
- **Доказательства:** Прочитан ImportReview.tsx:425–432 и локальное состояние в FlightEditRow.tsx.
- **Источник:** `flights-import:import-review-index-keys-and-dup-actions`

<a id="locale-less-dates-and-units-in-ru-profile"></a>

#### [P3] Даты и единицы не следуют языку приложения: «Участник с October 2026», «141,255 km»

`locale-less-dates-and-units-in-ru-profile` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/components/profile/ProfileHeader.tsx:32`, `apps/web/src/components/profile/ProfileBadges.tsx:107`, `apps/web/src/components/profile/ProfileStats.tsx:91`, `apps/web/src/components/profile/ProfileRankings.tsx:67`
- **Экраны:** [`profile-public-test-traveler-mobile`](../public-social/images/profile-public-test-traveler-mobile.png), [`profile-own-private-desktop`](../public-social/images/profile-own-private-desktop.png)
- **Влияние:** toLocaleDateString(undefined, …) и toLocaleString() берут язык браузера, а не i18n: при русском интерфейсе и английском браузере месяц английский («October 2026» в снимках), а lib/geo.formatDistance всегда пишет «km» с запятой-разделителем.
- **Стандарт:** DESIGN.md/PRODUCT.md: i18n EN/RU
- **Рекомендация:** Передавать i18n.language во все Intl-вызовы; формат расстояния через Intl.NumberFormat с unit: kilometer.
- **Команда:** `$impeccable clarify`
- **Доказательства:** Снимки profile-public-test-traveler-mobile и profile-own-private-desktop; geo.ts:280-282.
- **Источник:** `social-settings:locale-less-dates-and-units-in-ru-profile`

<a id="no-root-error-boundary-outside-routes"></a>

#### [P3] ErrorBoundary есть только вокруг маршрутов: ToastProvider, BadgeNotificationManager и SkipLink остаются без защиты

`no-root-error-boundary-outside-routes` · Целостность реализации · уверенность: verified

- **Где:** `apps/web/src/App.tsx:62-69`, `apps/web/src/App.tsx:134-146`, `apps/web/src/components/error/ErrorBoundary.tsx:35-85`
- **Экраны:** в атласе не снято
- **Влияние:** RouteErrorBoundary оборачивает только <Routes>; исключение при рендере ToastProvider/BadgeNotificationManager (читают данные бейджей) размонтирует всё дерево React — белый экран без CrashScreen. CrashScreen не получает фокус/role=alert, а в dev-ветке строки «Development Only:» не локализованы.
- **Стандарт:** Playbook: integrity / resilience
- **Рекомендация:** Добавить корневой ErrorBoundary в App (fallback CrashScreen) и role="alert" на CrashScreen.
- **Команда:** `$impeccable harden`
- **Доказательства:** Код App.tsx и ErrorBoundary.tsx прочитан.
- **Источник:** `foundations:no-root-error-boundary-outside-routes`

<a id="google-fonts-onload-inline-handler-breaks-under-csp"></a>

#### [P3] Загрузка шрифтов через media="print" onload="…" сломается, когда CSP из Report-Only станет принудительным

`google-fonts-onload-inline-handler-breaks-under-csp` · Производительность · уверенность: verified

- **Где:** `apps/web/index.html:26`, `apps/web/public/_headers:5`
- **Экраны:** в атласе не снято
- **Влияние:** Паттерн отложенной загрузки (media=print + inline onload) — нормальный приём без блокировки рендера. Но CSP в _headers: script-src 'self' без unsafe-inline и unsafe-hashes: inline-обработчик onload будет заблокирован, и таблица стилей навсегда останется media=print, шрифты не загрузятся. Сейчас политика Report-Only, поэтому дефект латентный. Preload woff2 нет, шрифты — два сторонних origin.
- **Стандарт:** Playbook: performance / CSP readiness
- **Рекомендация:** Самохостить шрифты (см. другой пункт) с preload и font-display:swap либо добавить хеш/nonce или отдельный внешний скрипт вместо inline onload.
- **Команда:** `$impeccable optimize`
- **Доказательства:** Прочитаны index.html и dist/_headers (Content-Security-Policy-Report-Only). Принудительный CSP не включён, поэтому не воспроизводилось.
- **Источник:** `foundations:google-fonts-onload-inline-handler-breaks-under-csp`

<a id="plane-animation-mounted-twice-always-running"></a>

#### [P3] PlaneAnimation монтируется дважды на странице входа; на мобильном 30 бесконечных анимаций

`plane-animation-mounted-twice-always-running` · Производительность · уверенность: verified

- **Где:** `apps/web/src/routes/AuthPage.tsx:47-60`, `apps/web/src/routes/AuthPage.tsx:69`, `apps/web/src/components/common/PlaneAnimation.tsx:31-87`, `apps/web/src/index.css:859-861`
- **Экраны:** [`auth-signin-mobile`](../public-social/images/auth-signin-mobile.png), [`auth-signin-desktop`](../public-social/images/auth-signin-desktop.png)
- **Влияние:** Обе копии (мобильная lg:hidden и десктопная hidden lg:flex) всегда в DOM: 60 svg, из них 30 с infinite-анимацией на любом брейкпоинте; на слабых телефонах это лишняя нагрузка и батарея при статичной форме.
- **Стандарт:** Производительность: лишний DOM и бесконечные анимации
- **Рекомендация:** Монтировать одну копию (matchMedia/useMediaQuery или CSS-контейнер, общий для обоих брейкпоинтов), снизить count до 12-16 на мобильном, ставить animation-play-state: paused при document.hidden.
- **Команда:** `$impeccable optimize`
- **Доказательства:** AuthPage.tsx:57-59 и :69 — два <PlaneAnimation />; PlaneAnimation count=30 по умолчанию, анимация transform/opacity (композиторная, дешёвая), поэтому P3. В reduced-motion анимация отключается (index.css:1108-1111). Профайлером не мерил.
- **Источник:** `entry:plane-animation-mounted-twice-always-running`

<a id="profile-duplicate-content-rendered-for-mobile-and-desktop"></a>

#### [P3] ProfileSection монтирует контент дважды (mobile-collapsible + desktop-блок)

`profile-duplicate-content-rendered-for-mobile-and-desktop` · Производительность · уверенность: verified

- **Где:** `apps/web/src/components/profile/ProfileSection.tsx:47`, `apps/web/src/components/profile/ProfileSection.tsx:90`, `apps/web/src/components/profile/ProfileSection.tsx:102`
- **Экраны:** [`profile-public-test-traveler-mobile`](../public-social/images/profile-public-test-traveler-mobile.png)
- **Влияние:** Оба варианта живут в DOM, скрытые только CSS (sm:hidden / hidden sm:block): ProfileStats/Rankings/Badges и их иконки рендерятся два раза (на mobile при открытой секции), удваивается скрытая часть доступного дерева и любые id/эффекты. Для небольших компонентов цена мала.
- **Рекомендация:** Один рендер контента + media-query хук или CSS-only (details/summary) для mobile.
- **Команда:** `$impeccable optimize`
- **Доказательства:** Код ProfileSection.tsx:44-105; снимки показывают только видимое дерево.
- **Источник:** `social-settings:profile-duplicate-content-rendered-for-mobile-and-desktop`

<a id="profile-mini-header-design-drift-and-landmark"></a>

#### [P3] Мини-шапка профиля: backdrop-blur, will-change в покое, второй banner, перекрывает MobileHeader

`profile-mini-header-design-drift-and-landmark` · Темы и токены · уверенность: likely

- **Где:** `apps/web/src/components/profile/ProfileMiniHeader.tsx:37`, `apps/web/src/components/profile/ProfileMiniHeader.tsx:41`, `apps/web/src/components/profile/ProfileMiniHeader.tsx:30`, `apps/web/src/routes/ProfilePage.tsx:36`
- **Экраны:** [`profile-sticky-header-mobile`](../public-social/images/profile-sticky-header-mobile.png)
- **Влияние:** DESIGN.md: sticky-шапки — solid bg-background/95 без blur; здесь backdrop-blur-lg и постоянный will-change-transform. При появлении это второй <header> (banner) с дублем имени, fixed z-50 закрывает sticky MobileHeader (z-40, те же 56px) вместе с переключателем темы. Появляется только когда весь блок статистики ушёл вверх (на скриншоте не проявилось — atlas gap).
- **Стандарт:** DESIGN.md: Elevation / sticky headers; WCAG 2.1 SC 1.3.1
- **Рекомендация:** Убрать blur и will-change, заменить <header> на <div aria-hidden>, сдвигать вместо перекрытия или встроить в MobileHeader.
- **Команда:** `$impeccable quieter`
- **Доказательства:** Код; скриншот profile-sticky-header-mobile — мини-шапка не видна (источник — код).
- **Источник:** `social-settings:profile-mini-header-design-drift-and-landmark`

## Что работает хорошо

- Двухуровневая система токенов OKLCH (light/dark + map-токены) с семантическими парами foreground; ~98% цветов в приложении идут через токены (всего 36 hex в src, 16 из них — список акцентов). _(foundations)_
- Skip-link «К основному содержимому» плюс <main id="main-content" tabIndex=-1> в AppPageShell и auth/journey; sr-only подписи у icon-кнопок (AppearanceToggle, FAB aria-label). _(foundations)_
- Button size=icon реально 44x44 (size-11 min-h-11 min-w-11), FAB 56px, пункты таб-бара min 44px, safe-area (pb-safe, h-tab-bar, bottom-safe-fab), viewport без запрета зума и с interactive-widget=resizes-content. _(foundations)_
- prefers-reduced-motion обработан осмысленно для декоративных элементов (planes → статичный фон, KuukiIcon → один символ, stagger/fade сохраняют видимость), motion-reduce:active:scale-100 у Button, useCountUp/FlightProgressModal проверяют matchMedia. _(foundations)_
- Ленивые маршруты через lazyWithRetry, ручные чанки (router/react-query/radix/forms/i18n/recharts/maps), русский словарь отдельным чанком, префетч TopoJSON карты, не блокирующая загрузка шрифтов, PWA с NetworkFirst для хешированных ассетов. _(foundations)_
- Единый AppPageShell задаёт landmarks и max-width по типам страниц; AppHeader/MobileHeader переключаются по breakpoint sm без дублирования в a11y-дереве. _(foundations)_
- Мобильный таб-бар с видимыми подписями, DESIGN-совместимые Note/Alert без боковых полос, sticky-шапки без backdrop-blur, Card/Note опираются на border-border/50. _(foundations)_
- Тема: initializeTheme/initializeAccentColor вызываются до рендера, слушатель prefers-color-scheme работает в режиме system, localStorage обёрнут в try/catch. _(foundations)_
- AuthPage: ровно один h1, skip-ссылка на #main-content, <main tabIndex=-1>; левый бренд и декоративное «くうき» в aria-hidden. _(entry)_
- Формы входа/регистрации на react-hook-form: Label связан через htmlFor, FormControl ставит aria-invalid и aria-describedby, общая ошибка в Alert с role="alert", RHF фокусирует первое невалидное поле. _(entry)_
- SignInForm содержит корректные autoComplete=email/current-password; активационная форма имеет label+autocomplete и role=alert/status. _(entry)_
- Глобальный prefers-reduced-motion в index.css возвращает видимость fade-in/fade-up/stagger-элементов (opacity:1, transform:none) и отключает летящие самолёты; Facehash-моргание гасится глобальным правилом. _(entry)_
- Лендинг: один h1, h2/h3 без пропусков, section с aria-label на русском, hasSeen-спиннер с role=status, CTA — настоящие ссылки (Button asChild + Link), LCP — текст без тяжёлых картинок. _(entry)_
- ShowcaseModal использует Radix Dialog с DialogTitle/Description, фокус-ловушкой и Esc; кнопки-иконки по умолчанию 44px (button.tsx size icon). _(entry)_
- Онбординг: корректный role=progressbar с aria-valuenow/min/max, нормализация username с превью и явной валидацией, пропуск на шаге импорта. _(entry)_
- activate.html: <label for>, autocomplete=new-password, role=status aria-live=polite, перенос токена из fragment в память до запроса, CSP default-src none, prefers-color-scheme и контраст ссылок/кнопки 6.37-9.11:1. _(entry)_
- RotatingTagline: таймеры очищаются на unmount, live-region отсутствует (нет спама скринридеру). _(entry)_
- ProfileSection на mobile — настоящий Collapsible с aria-expanded и aria-controls (Radix), на desktop раскрыт и с h2; триггер ≈44px. _(social-settings)_
- Состояния disabled у экспорта объяснены текстом на самой кнопке («Нет полётов для экспорта») и отдельным абзацем про лимит, а не только title. _(social-settings)_
- Диалог удаления: двухступенчатое подтверждение, предложение выгрузить данные, повторный ввод пароля, блокировка закрытия (Esc/клик вне) во время deleting, destructive-кнопка отделена от Cancel. _(social-settings)_
- Чекбоксы приватности — нативные Radix-checkbox с Label htmlFor, корректное checked/disabled в дереве доступности. _(social-settings)_
- prefers-reduced-motion учтён (motion-reduce:animate-none у perimeter-glow, глобальные fallback-и), анимации входа ease-out без bounce. _(social-settings)_
- Skip-link и `<main id="main-content">` на всех страницах среза; один h1 на страницу профиля/рейтинга/настроек. _(social-settings)_
- Пустые состояния рейтинга, профиля (не найден/приватный) и бейджей имеют осмысленный текст и иконку; приватный профиль не раскрывает данные. _(social-settings)_
- Rate-limit экспорта выводится видимо (остаток/исчерпан), а ссылки в таблице рейтинга ведут на профиль через настоящий <a>. _(social-settings)_
- Radix Dialog/AlertDialog для удаления и enrichment: корректный фокус и Escape. _(flights-import)_
- Идемпотентное сохранение и retry пакетного импорта (operationId, chunk-ack derived_state), честные статусы «Partially imported». _(flights-import)_
- FlightCardActions: aria-label на кнопке редактирования и ≥44px область нажатия. _(flights-import)_
- Кнопки очистки фильтров имеют aria-label; чекбоксы выбора в таблице имеют базовые метки. _(flights-import)_
- Глобальный :focus-visible в index.css:266 и ring-классы на интерактивных элементах. _(flights-import)_
- useCountUp уважает prefers-reduced-motion. _(flights-import)_
- Декоративные иконки помечены aria-hidden. _(flights-import)_
- Адаптивное переключение карточки/таблицы для списка рейсов. _(flights-import)_
- Подтверждение угаданного года, предупреждения о дубликатах и отдельный путь для отклонённых рейсов в ревью. _(flights-import)_
- FlightEditRow форматирует дату с T00:00:00 (локально), без UTC-сдвига. _(flights-import)_
- MapCard: toggle-кнопки слоёв — настоящие <button> с aria-label и aria-pressed, видимыми focus-visible кольцами. _(dashboard-passport-journey)_
- Тяжёлые части загружаются лениво: RouteMapWithCountries через lazy+Suspense, AnalysisDeck (recharts) через lazy с skeleton, manualChunks для recharts/maps. _(dashboard-passport-journey)_
- Passport-стамповая сетка использует IntersectionObserver для ленивого рендера секций и memo у CountryStamp; штампы — кнопки с осмысленным aria-label, SVG внутри aria-hidden. _(dashboard-passport-journey)_
- Статистика набрана JetBrains Mono (font-mono / font-data tabular-nums) в соответствии с DESIGN.md; значения на Passport/Dashboard не «прыгают». _(dashboard-passport-journey)_
- Удаление рейса, страны и визита идёт через подтверждение (диалог / inline confirm); ошибки мутаций passport сообщаются тостами, а не console. _(dashboard-passport-journey)_
- Карты используют --map-* токены (country, stroke, background), JourneyMap и Gantt применяют токены для маркеров и подписей; MapCard явно имеет motion-reduce у легенды. _(dashboard-passport-journey)_
- Мобильный Passport использует нижний лист (CountryListSheet) вместо диалога с поиском и аккордеоном, строки 48px+; пустые состояния Passport/Dashboard содержат понятные CTA. _(dashboard-passport-journey)_
- prefers-reduced-motion учтён глобально плюс локальные motion-reduce у вафли/полос; у ридж-графика 0.6s draw-in гасится глобальным правилом. _(dashboard-passport-journey)_

## Что не проверено

Аудит статический: код, скриншоты атласа и расчёты. Браузер, скринридер и реальные касания не запускались.

- Реальное поведение скринридеров (VoiceOver/NVDA): объявление смены маршрута, меню темы, прогресс-бары, live-регионы загрузки. _(foundations)_
- Реальные тач-жесты и эффект @media (pointer: coarse): скриншоты сняты без coarse pointer, растяжение Radix Checkbox/кнопок и margin-left между button не проверялись. _(foundations)_
- Тосты sonner в светлой/тёмной теме (ни одно состояние атласа их не содержит), CSS-приоритет unlayered vs @layer проверен только по коду. _(foundations)_
- Мерцание темы при первой загрузке, вспышка до initializeTheme, поведение theme-color на реальном мобильном браузере. _(foundations)_
- Фактический размер dev-тулбара agentation в прод-чанке (только факт присутствия), LCP/INP и профилирование анимаций WindLoader. _(foundations)_
- Отсечение высоких диалогов в ландшафте/при увеличении текста; цикл перезагрузки при недоступном чанке (требуют браузер/сеть). _(foundations)_
- Контраст цветов на реальной карте и в JourneyTimeline (text-white на --map-background) — рассчитан только по классам. _(foundations)_
- Состояния, изменившиеся после коммита 3156841 (Better Auth, импорт/статистика): скриншоты использованы как визуальное подтверждение, выводы подтверждены кодом текущего дерева. _(foundations)_
- Реальный вывод скринридера (VoiceOver/NVDA): объявления role=alert, смена режима форм, диалоги. _(entry)_
- Первый рендер RU в браузере: механизм отсутствия ре-рендера после addResourceBundle выведен из кода и снимков, не воспроизводился. _(entry)_
- Поведение bootstrap-блокировки формы при медленной/упавшей сети (/api/auth/me): только по коду authStore. _(entry)_
- Диалог «Что такое Kuuki?» и шоукейс на 390px: мобильных снимков нет, высота диалога оценена расчётом. _(entry)_
- Тёмная тема лендинга, онбординга и /activate при светлой схеме ОС; все 8 акцентов визуально (контраст считал, внешний вид не смотрел). _(entry)_
- Реальное касание и жесты (тапы по точкам шоукейса, мелким ссылкам), клавиатурная навигация, автозаполнение менеджеров паролей. _(entry)_
- Скорость загрузки (LCP, CLS при подмене шрифта DM Sans через media=print onload), профиль нагрузки от PlaneAnimation и blur-слоёв. _(entry)_
- Успешные ответы Better Auth (sign-up/sign-in) и activation complete: auth-register-success и auth-signin-success помечены source-only, фактический success-путь не наблюдался. _(entry)_
- Реальное экранно-читательское произношение (VoiceOver/NVDA): фокус после смены шага удаления, озвучивание toast/ошибок. _(social-settings)_
- Фактический порядок фокуса и поведение Radix FocusScope при размонтировании кнопки шага (выведено из кода). _(social-settings)_
- Реальные касания/жесты на mobile (hit-area, горизонтальный скролл ленты бейджей, перекрытие toast и tab bar по фактической высоте). _(social-settings)_
- Заполненный рейтинг из реального cache и профиль с бейджами/топ-рейтингами (в fixture пусто; состояние simulated или выведено из кода), включая светлую тему для рангов amber. _(social-settings)_
- Founding-user пилюля, мини-шапка профиля при скролле и серия toast наград — в атласе не сняты. _(social-settings)_
- Поведение при ошибках сети (429/500) в verify-password, при отказе clipboard, при битом localStorage. _(social-settings)_
- Скриншоты сняты на коммите 3156841; с тех пор Better Auth изменил auth-слой (lib/auth.ts, authStore) — выводы по delete-потоку подтверждены текущим исходником, визуальные — как likely. _(social-settings)_
- Реальный вывод скринридера (NVDA/VoiceOver) для автокомплитов, диалогов и прогресса. _(flights-import)_
- Жесты на реальном touch-устройстве и фактическое обрезание строки ревью на 390px кроме скриншота. _(flights-import)_
- Взаимодействие Escape в автокомплите внутри Radix Dialog/Popover. _(flights-import)_
- Тёмная тема: в атласе нет тёмных состояний, контраст dark посчитан только по токенам. _(flights-import)_
- Производительность списка при 1000+ рейсов и реальная работа виртуализации. _(flights-import)_
- Реальные коды ответов провайдера ИИ (квота, модель, таймаут) на проде. _(flights-import)_
- Клавиатурное поведение DatePicker/Calendar статически не проверялось. _(flights-import)_
- Скриншоты сняты на коммите 3156841; рабочее дерево изменилось (~66 файлов), финдинги подтверждены по текущему коду. _(flights-import)_
- Реальная работа с клавиатурой и скринридером (VoiceOver/NVDA): порядок Tab по 177 путям карты, озвучивание попапа штампа, aria-expanded у фильтров. _(dashboard-passport-journey)_
- Реальные touch-жесты: свайп по карте (d3-zoom), HTML5 drag-and-drop на Journey на iOS/Android, перетаскивание в переполненном таймлайне. _(dashboard-passport-journey)_
- Тёмная тема: в атласе нет тёмных состояний; контраст dominantColor/MANUFACTURER_COLORS посчитан по токенам, но визуально не подтверждён. _(dashboard-passport-journey)_
- Производительность: профилирование ререндеров карты при вводе в фильтры, время загрузки топоджсона с CDN, размер чанков (dist может быть устаревшим). _(dashboard-passport-journey)_
- Поведение cmdk при поиске по коду/родному названию страны не запускалось (вывод из кода и известного поведения библиотеки). _(dashboard-passport-journey)_
- Скриншоты сняты на коммите 3156841 (dirty); код в scope перечитан в текущем состоянии, но повторный прогон UI не делался; на 320px и при увеличенном шрифте не проверялось. _(dashboard-passport-journey)_
- Не просматривалось: баннер значков (BadgeNotificationToast) и CrashScreen (source-only), а также FlightForm внутри Dashboard (вне моего slice). _(dashboard-passport-journey)_

## Детектор `impeccable detect`

| Правило | Где | Вердикт | Комментарий |
| --- | --- | --- | --- |
| `design-system-radius` | `apps/web/src/index.css:973` | false-positive | border-radius:9999px у .after:animate-ripple::after — круговая «рябь» поверх круглых образцов цвета (ThemeColorPicker); для круга нужен полный радиус, это не карточка/кнопка, на которые рассчитана шкала rounded из DESIGN.md. Допустимо заменить на 50%. |
| `design-system-radius` | `apps/web/src/index.css:1018` | false-positive | border-radius:4px у ::-webkit-scrollbar-thumb (полоса шириной 8px): половина ширины даёт скруглённый «капсульный» ползунок; токены rounded применимы к карточкам/контролам, не к псевдоэлементу скроллбара. Побочное замечание: стили только для WebKit, Firefox их игнорирует. |
| `layout-transition` | `apps/web/src/components/ui/sheet.tsx:81` | confirmed | transition по bottom и max-height — layout-свойства; но срабатывает только при смене высоты клавиатуры, длится 150 мс, перекрывается reduced-motion. Реальный эффект мал (P3), см. finding sheet-keyboard-transition-vh-and-fake-drag-handle. Также вне детектора: keyframes WindLoader анимируют left, shrink-width в BadgeNotificationToast анимирует width, tw-animate accordion/collapsible анимируют height. |
| `layout-transition (transition: max-height)` | `apps/web/src/components/ui/sheet.tsx:81` | out-of-scope | Файл вне слайса entry (sheet используется в других зонах); не проверял, влияет ли он на экраны входа. |
| `design-system-radius (9999px)` | `apps/web/src/index.css:973` | out-of-scope | Это ::after ripple для кнопок (after:animate-ripple), в entry-экранах не используется; для круглой кнопки 9999px допустим. |
| `design-system-radius (4px)` | `apps/web/src/index.css:1018` | out-of-scope | Ползунок webkit-scrollbar-thumb; не относится к entry; косметическое расхождение со шкалой. |
| `(не поймано детектором) .aura-button / .aura-input rgba-литералы, градиент, backdrop-blur` | `apps/web/src/index.css:332-371` | confirmed | Детектор не отметил, но в коде нарушение DESIGN.md; оформлено как отдельные находки. |
| `design-system-radius` | `apps/web/src/index.css:973` | false-positive | border-radius:9999px — круговой ripple (`.after:animate-ripple`); единственный потребитель — осиротевший ThemeColorPicker. Полная окружность вне шкалы по определению. |
| `design-system-radius` | `apps/web/src/index.css:1018` | false-positive | Радиус 4px у ::-webkit-scrollbar-thumb — служебный элемент браузера, не карточка/контрол; вне области среза. |
| `layout-transition` | `apps/web/src/components/ui/sheet.tsx:81` | out-of-scope | transition: max-height у нижнего Sheet (FlightForm, CountryListSheet) — не в моём срезе. Для сравнения: layout-анимации в моём срезе — max-width/padding пилюли ProfileHeader.tsx:111-120 (детектор их не поймал, т.к. это Tailwind-классы). |
| `layout-property animation (transition: max-height)` | `apps/web/src/components/ui/sheet.tsx:81` | confirmed | Подтверждено; тот же паттерн вручную найден в FlightEditRow.tsx:306 (max-height + opacity). |
| `radius 9999px` | `apps/web/src/index.css:973` | out-of-scope | Глобальные стили скроллбара/утилит, вне среза flights-import; ложного срабатывания в сам срез не вносит. |
| `radius 4px` | `apps/web/src/index.css:1018` | out-of-scope | Глобальный index.css, не входит в срез; оставлено фундаментальному аудиту. |
| `layout-transition (components/ui/sheet.tsx:81 `transition: max-height`)` | `apps/web/src/components/ui/sheet.tsx:81` | confirmed | Срабатывает только при открытии экранной клавиатуры в нижнем листе (CountryListSheet со строкой поиска), 150ms; технически верно, практический эффект минимальный — учтено как P3 в layout-property-transitions-on-expand. |
| `design-system-radius (index.css:973 border-radius 9999px)` | `apps/web/src/index.css:973` | false-positive | Это `.after:animate-ripple::after` — круглая пульсация (pill/circle), не карточка; 9999px — стандартный способ круга. В моём scope (Dashboard/Passport/Journey) не используется напрямую. |
| `design-system-radius (index.css:1018 border-radius 4px)` | `apps/web/src/index.css:1018` | out-of-scope | Скроллбар webkit (::-webkit-scrollbar-thumb); к экранам Dashboard/Passport/Journey отношения не имеет, advisory. |

## Как пользоваться с картой

- Экран → находки: в [MAP.md](../MAP.md) колонка «Аудит» индекса экранов; в `manifest.json` поле `audit` у состояния; в галерее — бейджи на карточке и поиск по `P1` или ID.
- Находка → экраны: поле `states` в `findings.json` и ссылки «Экраны» выше открывают PNG.
- Раздел → находки: блок «Аудит интерфейса» в конце `flows.md` каждого раздела.
- После исправления удали или обнови находку в `findings.json`, пересними затронутые состояния и запусти `python3 docs/user-journeys/tools/build-atlas.py`.
