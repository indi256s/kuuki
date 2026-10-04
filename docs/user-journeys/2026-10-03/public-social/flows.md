# Публичные страницы, авторизация и настройки Kuuki

Эта зона описывает гостевые маршруты, регистрацию и onboarding, запрос/завершение активации, настройки, рейтинги и публичный профиль. Каждый PNG имеет рядом `.txt` с доступным деревом страницы. Все экраны сняты на локальной fixture и текущей рабочей сборке; состояние каждой записи, размер окна, предусловия, действия и исходники сведены в [manifest.json](manifest.json).

Папка содержит 68 screenshot states плюс три переходных/результирующих `source-only` состояния. Статусы: `captured` — обычный UI; `simulated` — renderer с локальным browser mock 200 или синтетическая таблица рейтинга; `source-only` — переход или результат без отдельного PNG в этой зоне. В каждом мобильном снимке viewport 390×844, desktop — 1440×1000.

## Сценарии

### Стартовая страница и showcase

Гость открывает `/landing`, просматривает hero, три карточки showcase и блок возможностей, затем переходит на `/` для авторизации. Mobile-компоновка снята отдельно.

- [Стартовая — desktop](images/landing-desktop.png) · [mobile](images/landing-mobile.png) · [Возможности](images/landing-features-desktop.png)
- Showcase: [шаг 1](images/landing-showcase-step1-desktop.png) → [шаг 2](images/landing-showcase-step2-desktop.png) → [шаг 3](images/landing-showcase-step3-desktop.png).

### Вход, регистрация и onboarding

На вход можно попасть по `/?mode=signin`, регистрация открывается на `/`. Формы проверяют email/пароль на клиенте; неверная пара оставляет гостевую сессию. Успешный sign-in направляет в защищённую область (dashboard зафиксирован соседней зоной). После signup приложение проходит `/dashboard`, затем отправляет пользователя без username в `/onboarding`.

- Вход: [desktop](images/auth-signin-desktop.png) · [mobile](images/auth-signin-mobile.png) · [пустые/невалидные поля](images/auth-signin-validation-desktop.png) · [неверные данные](images/auth-signin-invalid-credentials-desktop.png).
- Регистрация: [desktop](images/auth-register-desktop.png) · [mobile](images/auth-register-mobile.png) · [ошибка полей](images/auth-register-validation-desktop.png).
- Дополнительные действия: [диалог «Что такое Kuuki?»](images/auth-about-dialog-desktop.png), [меню темы авторизации](images/auth-appearance-menu-desktop.png).
- Username: [пустой шаг](images/onboarding-username-desktop.png) · [слишком короткий](images/onboarding-username-validation-desktop.png) · [нормализация пробелов в дефисы](images/onboarding-username-normalized-desktop.png).
- Первый импорт: [пустое поле](images/onboarding-import-empty-desktop.png) · [показан prompt](images/onboarding-import-prompt-desktop.png) · [текст и включённая кнопка](images/onboarding-import-ready-desktop.png) · [mobile](images/onboarding-import-mobile.png).

После создания username профильный URL становится читабельным. Onboarding передаёт введённый текст в `/import`; распознавание, правка batch и сохранение документированы в соседней зоне импорта.

### Запрос и установка пароля прежнего аккаунта

На sign-in есть переход «Активировать прежний аккаунт». Request-form скрывает её после успешного ответа и сообщает, что ссылка будет отправлена, только если адрес относится к аккаунту для активации. В локальной fixture настоящий request и complete endpoint отвечают 503, а действующий одноразовый токен/письмо недоступны. Поэтому два happy renderer помечены `simulated`: браузер локально получил 200 `{ok:true}`; сервер активации и доставка письма не участвовали.

- [Форма запроса](images/auth-activation-request-desktop.png) → [реальная fixture-ошибка](images/auth-activation-unavailable-desktop.png); [успех запроса (simulated)](images/activation-request-success-simulated-desktop.png).
- Статическая страница `/activate`: [ссылки нет](images/activate-no-token-desktop.png) · [mobile](images/activate-no-token-mobile.png) · [форма синтетического token](images/activate-token-form-desktop.png) · [пароли не совпали](images/activate-password-mismatch-desktop.png) · [временная недоступность сервера](images/activate-server-unavailable-desktop.png) · [success renderer (simulated)](images/activation-success-simulated-desktop.png).

Страница `/activate` — отдельный статический HTML вне React SPA. В URL на этапе после загрузки token убирается из fragment до сетевого запроса; token и пароли в текстовые sidecar-файлы не записывались. Её исходный текст английский.

### Общая шапка

- [Меню пользователя](images/app-header-user-menu-desktop.png) даёт переход в настройки, переключение языка и выход.
- [Меню темы/акцентного цвета](images/app-header-appearance-menu-desktop.png) открывается прямо на публичном профиле.

### Настройки, видимость и удаление

`/settings` содержит внешнее оформление, язык, профиль/видимость, выгрузки и опасную зону. В mobile-версии вместо desktop navigation видна нижняя панель. Снимок `settings-public-profile-enabled` показывает включённую публичность и доступную опцию рейтинга; `settings-leaderboards-optin-enabled` — оба включённых флажка. Эти два переключения не сохранялись.

- Экспорт atlas-user: [кнопки 69 полётов и 16 стран](images/settings-data-export-populated-desktop.png) · [успешная выгрузка полётов](images/settings-data-export-success-desktop.png) · [экспорт двух стран, подтверждённый toast (source-only)](images/settings-country-export-success-source-only.txt).
- Общие настройки: [desktop](images/settings-main-desktop.png) · [mobile и нижняя панель](images/settings-main-mobile.png) · [system](images/settings-system-theme-desktop.png) · [dark](images/settings-dark-theme-desktop.png).
- Видимость (локальное несохранённое состояние): [публичный профиль](images/settings-public-profile-enabled-desktop.png) → [opt-in рейтинга](images/settings-leaderboards-optin-enabled-desktop.png).
- Удаление account a остановлено до успешного подтверждения: [preview](images/settings-delete-preview-desktop.png) → [предложение выгрузить](images/settings-delete-export-prompt-desktop.png) → [пароль](images/settings-delete-password-desktop.png) → [неверный пароль](images/settings-delete-wrong-password-desktop.png).
- Отдельный одноразовый пустой fixture account прошёл и удаление: [preview](images/settings-delete-preview-disposable-desktop.png) → [export prompt](images/settings-delete-export-prompt-disposable-desktop.png) → [пароль](images/settings-delete-password-disposable-desktop.png) → [после удаления](images/settings-delete-success-disposable-desktop.png).

В реальном локальном вызове удаления disposable account сервер вернул 200 для `verify-password` и `DELETE /api/auth/account`. Toast «Ваш аккаунт удалён.» был виден в immediate accessibility snapshot; к PNG он успел исчезнуть, поэтому скриншот показывает переход обратно к регистрации. Account a и профили с полётами не удалялись. Для пустых аккаунтов кнопки экспорта выключены; экспорт 69 полётов atlas-user проверен в UI и toast показал «Export Flights».

### Публичный профиль

Маршрут `/fly/:username` различает собственный профиль, публичный, приватный и not-found. Sample `test-traveler` — локальная synthetic history, подготовленная родительским агентом: 69 полётов, 29 аэропортов, 16 стран и 22 авиакомпании.

- Свой закрытый профиль: [владелец](images/profile-own-private-desktop.png) · [гость](images/profile-private-guest-desktop.png) · [mobile](images/profile-private-guest-mobile.png).
- Публичный профиль: [гость desktop](images/profile-public-guest-desktop.png) · [гость mobile](images/profile-public-guest-mobile.png) · [test-traveler desktop](images/profile-public-test-traveler-desktop.png) · [mobile](images/profile-public-test-traveler-mobile.png).
- Дополнительные варианты: [тёмная тема](images/profile-public-dark-theme-desktop.png) · [развёрнутые секции mobile](images/profile-sections-expanded-mobile.png) · [прокрутка mobile](images/profile-sticky-header-mobile.png) · [профиль не найден](images/profile-not-found-guest-desktop.png).

В текущем `ProfilePage.tsx` отдельного control сравнения нет. Состояние прокрутки профиля снято, но отдельная компактная sticky-шапка не проявилась в этом сценарии.

### Рейтинг

Гость и авторизованный пользователь могут выбрать пять категорий: полёты, расстояние, страны, города и авиакомпании.

- Account a: [полёты](images/leaderboard-flights-authenticated-desktop.png) · [расстояние](images/leaderboard-distance-authenticated-desktop.png) · [страны](images/leaderboard-countries-authenticated-desktop.png) · [города](images/leaderboard-cities-authenticated-desktop.png) · [авиакомпании](images/leaderboard-airlines-authenticated-desktop.png).
- Гость: [desktop](images/leaderboard-flights-guest-desktop.png) · [mobile](images/leaderboard-guest-mobile.png).

Live `GET /api/leaderboard` вернул `{entries:[],total:0}`: локальный fixture cache пуст, потому что `functions/api/_services/leaderboard.ts` обновляет его cron-перестроением. У test-traveler opt-in включён, но свежего cache entry нет; пустая таблица не означает отсутствия opt-in. Отдельный `simulated` снимок показывает пять синтетических записей, сформированных browser-only mock по DTO API; база и приложение не изменялись.

## Ограничения и достоверность

- Реальные success-ответы activation не подтверждены; оба success состояния помечены `simulated`.
- Проверена выгрузка 69 полётов atlas-user. В отдельной авторизованной сессии atlas-dashboard кнопка экспорта двух посещённых стран, показала toast «Экспорт стран»; sidecar доступного дерева сохранён, CSV сразу удалён. Проверка израсходовала один суточный export slot (5→4). Результат помечен `source-only`, так как PNG capture подвисал.
- Сравнение профилей отсутствует в текущем `ProfilePage`; не моделируется.
- Русский выбран для основных SPA-снимков, но часть подписей и весь статический `/activate` остаются на английском.
- Не снимались все комбинации языка, accent color, theme и ширины экрана; выбраны различающиеся состояния и desktop/mobile layouts.

## Исходники

Основные route-компоненты: `apps/web/src/routes/AuthPage.tsx`, `LandingPage.tsx`, `OnboardingPage.tsx`, `SettingsPage.tsx`, `LeaderboardPage.tsx`, `ProfilePage.tsx`. Ключевые UI-компоненты: `apps/web/src/components/auth/ActivationRequestForm.tsx`, `apps/web/src/components/settings/*`, `apps/web/src/components/common/AppHeader.tsx`, `apps/web/src/components/layout/MobileTabBar.tsx`. Отдельная активация: `apps/web/public/activate.html` и `activate.js`. Полный список source refs и actions дан в manifest.

<!-- audit:start -->
## Аудит интерфейса (2026-10-04)

Находки `$impeccable audit`, видимые на экранах этого раздела: 59. Общая оценка 11/20, системные находки без снимков и подробности — в [отчёте](../audit/AUDIT.md). Блок генерируется `build-atlas.py`.

| P | Находка | Экраны раздела |
| --- | --- | --- |
| P1 | [Номера мест в «Вашем месте» окрашены Tailwind amber-500: 1.99:1 в светлой теме](../audit/AUDIT.md#amber-literal-rank-text-fails-contrast-light) | `profile-sections-expanded-mobile` |
| P1 | [Текстовые цвета ниже 4.5:1: destructive, success, warning и muted-foreground с opacity /40–/80](../audit/AUDIT.md#contrast-text-tokens-below-aa) | `auth-signin-mobile`, `settings-main-mobile`, `auth-signin-validation-desktop`, `auth-register-validation-desktop`, `auth-signin-invalid-credentials-desktop`, `onboarding-username-validation-desktop`, `settings-delete-preview-desktop`, `settings-delete-wrong-password-desktop`, `settings-main-desktop`, `profile-public-test-traveler-mobile`, `profile-sections-expanded-mobile` |
| P1 | [Границы полей, select и чекбоксов 1.2–1.4:1 вместо 3:1](../audit/AUDIT.md#control-borders-below-3-to-1) | `settings-main-mobile`, `settings-dark-theme-desktop`, `settings-public-profile-enabled-desktop`, `settings-data-export-success-desktop`, `settings-main-desktop` |
| P1 | [`<html lang>` всегда «en», даже когда интерфейс русский](../audit/AUDIT.md#html-lang-static-en) | `auth-signin-desktop`, `landing-desktop`, `onboarding-username-desktop`, `settings-main-mobile`, `app-header-user-menu-desktop` |
| P1 | [Смена маршрута и режима не меняет document.title и не переносит фокус](../audit/AUDIT.md#spa-route-change-no-title-no-focus) | `settings-main-mobile`, `auth-signin-desktop`, `auth-register-desktop`, `landing-desktop`, `onboarding-username-desktop` |
| P1 | [При первой загрузке в RU части экрана остаются на английском до случайного ре-рендера](../audit/AUDIT.md#i18n-first-paint-english-until-rerender) | `auth-signin-mobile`, `auth-signin-invalid-credentials-desktop`, `auth-register-validation-desktop`, `auth-signin-desktop`, `landing-mobile`, `landing-showcase-step1-desktop`, `landing-showcase-step2-desktop`, `landing-showcase-step3-desktop` |
| P1 | [В русском интерфейсе остаются английские строки: зашитые литералы, отсутствующие ключи, ошибки валидации и сервера](../audit/AUDIT.md#i18n-hardcoded-english-and-missing-keys) | `auth-signin-desktop`, `auth-register-mobile`, `auth-about-dialog-desktop`, `landing-showcase-step1-desktop`, `onboarding-username-validation-desktop`, `landing-desktop`, `auth-signin-validation-desktop`, `auth-register-validation-desktop`, `auth-signin-invalid-credentials-desktop`, `auth-activation-unavailable-desktop`, `settings-main-mobile`, `profile-own-private-desktop`, `settings-delete-wrong-password-desktop`, `settings-dark-theme-desktop`, `settings-system-theme-desktop` |
| P1 | [В ru.json нет plural-форм `_many`: 0, 5–20, 25–30… показываются по-английски](../audit/AUDIT.md#i18n-ru-plural-many-missing) | `settings-main-mobile`, `settings-delete-wrong-password-desktop`, `leaderboard-flights-authenticated-desktop` |
| P1 | [На mobile нет пути в рейтинг, а ссылки на собственный публичный профиль нет нигде](../audit/AUDIT.md#mobile-nav-missing-leaderboard-and-own-profile) | `settings-main-mobile`, `profile-own-private-desktop`, `leaderboard-guest-mobile` |
| P1 | [Акцент перекрывает OKLCH-токены одним hex для обеих тем; дефолтный red не проходит AA](../audit/AUDIT.md#accent-picker-overrides-tokens-fails-contrast) | `app-header-appearance-menu-desktop`, `settings-dark-theme-desktop`, `settings-main-mobile`, `auth-signin-mobile`, `auth-signin-desktop`, `auth-register-mobile`, `landing-desktop`, `landing-mobile`, `landing-showcase-step2-desktop`, `onboarding-username-normalized-desktop` |
| P1 | [`.aura-input` / `.aura-button` на входе и регистрации ломаются в светлой теме: rgba-литералы, стекло, градиент](../audit/AUDIT.md#aura-auth-inputs-broken-light-theme) | `auth-signin-mobile`, `auth-register-mobile`, `auth-signin-desktop`, `auth-register-desktop` |
| P1 | [В диалоге удаления аккаунта ошибка пароля и шаг «Удаляем…» не озвучиваются](../audit/AUDIT.md#delete-flow-error-and-progress-not-announced) | `settings-delete-wrong-password-desktop`, `settings-delete-password-desktop`, `settings-delete-success-disposable-desktop` |
| P1 | [Вкладки категорий рейтинга на mobile — безымянные кнопки без состояния](../audit/AUDIT.md#leaderboard-category-tabs-icon-only-unnamed-on-mobile) | `leaderboard-guest-mobile`, `leaderboard-flights-authenticated-desktop` |
| P1 | [Места 1–3 в таблице рейтинга выражены только иконкой без текста](../audit/AUDIT.md#leaderboard-top3-rank-icon-only-no-text) | `leaderboard-flights-populated-simulated-desktop` |
| P1 | [Поля и кнопка входа блокируются на время проверки сессии; при недоступном API форма заблокирована бессрочно](../audit/AUDIT.md#auth-form-disabled-during-session-bootstrap) | `auth-signin-desktop`, `auth-register-desktop`, `auth-signin-mobile` |
| P1 | [Авторизованный пользователь на «/» видит форму регистрации (в том числе при старте PWA)](../audit/AUDIT.md#authpage-no-redirect-for-signed-in-user) | `auth-register-desktop`, `auth-signin-success-source-only` |
| P1 | [Шаг имени пользователя обещает адрес kuuki.app/@имя, которого в приложении нет](../audit/AUDIT.md#onboarding-profile-url-preview-wrong) | `onboarding-username-normalized-desktop`, `onboarding-username-desktop` |
| P2 | [Иерархия заголовков: h4 без h2/h3 на Dashboard, нет h1 у пустого Passport, одинаковый h1 «Kuuki» у всех режимов входа](../audit/AUDIT.md#heading-structure-gaps) | `settings-main-mobile`, `leaderboard-flights-populated-simulated-desktop`, `auth-signin-desktop`, `auth-register-desktop`, `auth-activation-request-desktop` |
| P2 | [DM Sans не содержит кириллицы: весь русский интерфейс рисуется системным шрифтом, а не брендовым](../audit/AUDIT.md#dm-sans-has-no-cyrillic-fallback-system-font) | `settings-main-mobile`, `profile-public-dark-theme-desktop` |
| P2 | [Сбой загрузки выглядит как пустые данные: журнал «нет рейсов», рейтинг «Станьте первым!»](../audit/AUDIT.md#fetch-errors-shown-as-empty-state) | `leaderboard-flights-guest-desktop`, `leaderboard-flights-authenticated-desktop` |
| P2 | [DialogContent без max-height и прокрутки: высокие диалоги («Что такое Kuuki?», удаление аккаунта) обрезаются на телефоне](../audit/AUDIT.md#dialog-no-max-height-no-scroll) | `auth-about-dialog-desktop` |
| P2 | [Касательные цели меньше 44×44: свотчи, вкладки, крестики, чекбоксы, слои карты, точки шоукейса, текстовые ссылки](../audit/AUDIT.md#touch-targets-below-44px) | `settings-main-mobile`, `profile-own-private-desktop`, `leaderboard-guest-mobile`, `auth-signin-mobile`, `auth-activation-request-desktop`, `landing-showcase-step1-desktop`, `landing-showcase-step2-desktop`, `landing-showcase-step3-desktop` |
| P2 | [Цвета вне токенов: 36 hex, 27 классов палитры Tailwind (blue-500, amber-500…), rgba/white в карте и журнале](../audit/AUDIT.md#hardcoded-color-literals) | `profile-public-dark-theme-desktop` |
| P2 | [Страница /activate: ошибки не привязаны к полям, фокус теряется, подсказка в ошибке вводит в заблуждение](../audit/AUDIT.md#activate-page-errors-not-associated-and-misleading) | `activation-password-mismatch-desktop`, `activation-server-unavailable-desktop`, `activation-success-simulated-desktop` |
| P2 | [Переключатели темы и акцента в шапке — обычные button внутри Radix DropdownMenu: Tab заблокирован, стрелки их не достигают](../audit/AUDIT.md#appearance-menu-controls-unreachable-by-keyboard) | `app-header-appearance-menu-desktop`, `settings-main-mobile`, `settings-dark-theme-desktop` |
| P2 | [Диалог удаления: нет управления фокусом между шагами, нет <form>, Enter не подтверждает](../audit/AUDIT.md#delete-dialog-focus-and-submit-semantics) | `settings-delete-preview-desktop`, `settings-delete-export-prompt-desktop`, `settings-delete-password-desktop` |
| P2 | [Фокус теряется при переключении «вход / регистрация / активация» и шагов онбординга; режим не отражён в URL](../audit/AUDIT.md#focus-lost-on-mode-and-step-switch) | `auth-signin-desktop`, `auth-register-desktop`, `auth-activation-request-desktop`, `activation-request-success-simulated-desktop`, `onboarding-username-desktop`, `onboarding-import-empty-desktop` |
| P2 | [Таблица рейтинга без caption/имени; смена категории и загрузка не объявляются](../audit/AUDIT.md#leaderboard-table-unnamed-and-category-change-silent) | `leaderboard-distance-authenticated-desktop`, `leaderboard-flights-populated-simulated-desktop` |
| P2 | [LoadingScreen: английский текст в RU и без объявления состояния загрузки](../audit/AUDIT.md#loading-screen-english-and-silent) | `onboarding-import-mobile` |
| P2 | [Навигация без aria-current и aria-label, кнопка пользователя подписана инициалами](../audit/AUDIT.md#nav-landmarks-missing-aria-current-and-labels) | `app-header-user-menu-desktop`, `settings-system-theme-desktop` |
| P2 | [Бейджи профиля: описание и дата — только в title, тир — только цветом, лента не фокусируется](../audit/AUDIT.md#profile-badges-tooltip-only-details-and-color-tier) | `profile-public-test-traveler-desktop` |
| P2 | [На mobile заголовки секций профиля — кнопки без heading-семантики](../audit/AUDIT.md#profile-mobile-section-triggers-not-headings) | `profile-public-test-traveler-mobile`, `profile-sections-expanded-mobile` |
| P2 | [Регистрация: нет autocomplete=email/new-password, нет подсказки про 8 символов и показа пароля](../audit/AUDIT.md#register-form-autocomplete-and-password-affordances) | `auth-register-desktop`, `auth-register-mobile`, `auth-register-validation-desktop` |
| P2 | [Слоган меняется каждые 6 секунд без возможности остановить; в reduced-motion продолжает меняться](../audit/AUDIT.md#rotating-tagline-no-pause) | `auth-signin-desktop`, `auth-signin-mobile`, `auth-register-mobile` |
| P2 | [Сохранение профиля: статус кнопки и ошибка не озвучиваются; «Failed to save» на английском](../audit/AUDIT.md#settings-save-result-and-form-errors-not-announced-or-localized) | `settings-main-desktop` |
| P2 | [Переключатель темы: role=radio без стрелочной навигации; подписи <label> без связи; язык без aria-pressed](../audit/AUDIT.md#settings-segmented-control-radio-keyboard-and-label) | `settings-main-desktop`, `settings-main-mobile`, `settings-system-theme-desktop` |
| P2 | [Чекбокс «Показывать в рейтинге» отключён без объяснения причины; снятие «Публичный» молча снимает рейтинг](../audit/AUDIT.md#settings-visibility-leaderboard-disabled-reason-hidden) | `settings-main-desktop`, `settings-public-profile-enabled-desktop` |
| P2 | [Кнопка «Share»: результат не озвучивается, сбой clipboard не обрабатывается](../audit/AUDIT.md#share-button-feedback-silent-and-unhandled-clipboard-failure) | `profile-own-private-desktop` |
| P2 | [Ошибки выбора имени пользователя не связаны с полем и не озвучиваются](../audit/AUDIT.md#username-picker-errors-not-announced) | `onboarding-username-validation-desktop`, `onboarding-username-normalized-desktop` |
| P2 | [Страница /activate целиком на английском и не знает язык приложения](../audit/AUDIT.md#activate-page-english-only) | `activation-no-token-desktop`, `activation-no-token-mobile`, `activation-token-form-desktop`, `activation-password-mismatch-desktop`, `activation-server-unavailable-desktop`, `activation-success-simulated-desktop` |
| P2 | [Кнопки экспорта показывают «Нет полётов/стран» пока статистика грузится; экспорт стран может молча ничего не делать](../audit/AUDIT.md#data-export-disabled-looks-empty-while-stats-load) | `settings-data-export-populated-desktop`, `settings-data-export-success-desktop` |
| P2 | [useTheme/useAccentColor хранят состояние локально в каждом экземпляре: иконка темы и точка акцента в шапке устаревают](../audit/AUDIT.md#header-appearance-state-stale-duplicate-hooks) | `settings-dark-theme-desktop`, `settings-system-theme-desktop` |
| P2 | [У владельца приватного профиля секция «Статистика» пустая, без объяснения и следующего шага](../audit/AUDIT.md#own-private-profile-stats-section-empty-without-explanation) | `profile-own-private-desktop` |
| P2 | [На чужом профиле секция названа «Ваше место», а пустое состояние советует «Добавьте больше рейсов»](../audit/AUDIT.md#profile-section-wrong-voice-for-visitors) | `profile-sections-expanded-mobile`, `profile-public-test-traveler-mobile`, `profile-public-guest-mobile` |
| P2 | [Карточка «Ваше место»: ложное «Пока недоступно» во время загрузки и молчаливое исчезновение](../audit/AUDIT.md#rank-card-eligibility-flash-and-silent-hidden-state) | `leaderboard-flights-authenticated-desktop` |
| P2 | [Любая ошибка verify-password показывается как «Неверный пароль»; сервер-ошибки — английскими строками](../audit/AUDIT.md#verify-password-collapses-all-errors-to-wrong-password) | `settings-delete-wrong-password-desktop` |
| P2 | [CollapsibleContent использует keyframes accordion-*: переменная высоты не определена, анимация height 0→auto прыгает](../audit/AUDIT.md#collapsible-uses-accordion-keyframes-height-jump) | `profile-sections-expanded-mobile` |
| P2 | [На мобильном экране входа нет переключателя языка](../audit/AUDIT.md#auth-mobile-no-language-toggle) | `auth-signin-mobile`, `auth-register-mobile` |
| P2 | [Toast наград: бесконечные pulse/sparkle, цветное свечение, перекрывает нижнюю панель на mobile](../audit/AUDIT.md#badge-toast-motion-glow-and-overlaps-mobile-tab-bar) | `settings-data-export-success-desktop` |
| P2 | [Бейдж «Приватный» уплывает от аватара; сообщение о приватности показано дважды](../audit/AUDIT.md#profile-private-badge-detached-and-privacy-message-duplicated) | `profile-own-private-desktop`, `profile-private-guest-mobile`, `profile-private-guest-desktop` |
| P2 | [На 390px сегмент «Светлая/Тёмная/Системная» вылезает за границу карточки](../audit/AUDIT.md#settings-segmented-theme-control-overflows-card-on-mobile) | `settings-main-mobile` |
| P2 | [Страница /activate выпадает из системы: hex-литералы, бирюзовый бренд, system-ui, игнорирует тему приложения](../audit/AUDIT.md#activate-page-off-system-theme-tokens) | `activation-token-form-desktop`, `activation-no-token-desktop`, `activation-no-token-mobile`, `activation-password-mismatch-desktop` |
| P2 | [Начальная инициализация темы: theme-color обновляется не тот meta, нет color-scheme и inline-скрипта до первой отрисовки](../audit/AUDIT.md#theme-bootstrap-theme-color-color-scheme-flash) | `settings-dark-theme-desktop`, `settings-system-theme-desktop` |
| P3 | [Осиротевший код: /landing без входящих ссылок, compare/*, legacy dashboard-компоненты, неиспользуемый CSS и AtmosphericCard](../audit/AUDIT.md#orphaned-components-and-dead-css) | `landing-desktop`, `landing-features-desktop` |
| P3 | [WhatIsKuukiDialog: нет описания и видимого заголовка, кнопка закрытия 32px](../audit/AUDIT.md#what-is-kuuki-dialog-a11y-gaps) | `auth-about-dialog-desktop` |
| P3 | [Даты и единицы не следуют языку приложения: «Участник с October 2026», «141,255 km»](../audit/AUDIT.md#locale-less-dates-and-units-in-ru-profile) | `profile-public-test-traveler-mobile`, `profile-own-private-desktop` |
| P3 | [PlaneAnimation монтируется дважды на странице входа; на мобильном 30 бесконечных анимаций](../audit/AUDIT.md#plane-animation-mounted-twice-always-running) | `auth-signin-mobile`, `auth-signin-desktop` |
| P3 | [ProfileSection монтирует контент дважды (mobile-collapsible + desktop-блок)](../audit/AUDIT.md#profile-duplicate-content-rendered-for-mobile-and-desktop) | `profile-public-test-traveler-mobile` |
| P3 | [Мини-шапка профиля: backdrop-blur, will-change в покое, второй banner, перекрывает MobileHeader](../audit/AUDIT.md#profile-mini-header-design-drift-and-landmark) | `profile-sticky-header-mobile` |
<!-- audit:end -->
