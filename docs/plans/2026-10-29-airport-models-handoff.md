# Модели аэропортов — implementation handoff

Status: W1–W4 реализованы; локальная функциональная интеграция принята primary 29 октября 2026. Независимые findings закрыты. Ограничение performance приведено ниже; hosted release не выполнялся.

Plan: [2026-10-29-airport-models.md](2026-10-29-airport-models.md).
Checkout: `/Users/indi256/Documents/kuuki/kuuki`, shared branch `main`.
Planning baseline: `9a64ee9474629cab8c2c8bf1592b85afa0f1fac6`.
Date: 2026-10-29, Asia/Tbilisi.

## Текущее исполнение

Пользователь явно разрешил реализацию всех волн с субагентами в этом общем root checkout. Прежние planning-only формулировки ниже — историческая запись предыдущего этапа; они не ограничивают текущую реализацию. Коммит, push, PR, deployment и удалённые записи не разрешены.

Execution evidence: `/tmp/plan-execution/airport-models-20261029/`. `ledger.md` содержит приёмку волн, `owned.patch` и `owned-sha256.json` — текущий scoped candidate относительно baseline выше; его SHA-256 записан в `identity.txt` и ledger. Проверки выполнялись в общем checkout; private Git index использован только для формирования patch. Настоящий staging сохранён, HEAD не изменён; 20 исходных чужих tracked изменений и исходные префиксы общих DESIGN/docs README сохранены. Primary: `gpt-6.1-sol/xhigh`; workers: `gpt-6.1-sol/medium`; независимые reviewers: `gpt-6.1-sol/high`.

- W1 принят: независимый offline pipeline и self-contained source extracts, метрическая геометрия с holes/parts/units, provenance/ODbL, exact immutable Worker allowlist и строгий scope codec. Финальные модели: TBS `565da61816f1e8a27d130e7a3f8752598157df89748a5c833cf669cefcc326a3`, BER `a9b6a374d36cbd48c58e57a74858dfb3345f71581bad7b8376faa46e54e9dde1`. 11 pipeline tests, deterministic prepare/check и script types PASS.
- W2-H принят: точная история исходных owner rows до Overview aggregation, все inherited facets/suppressions, глобальное ground presence, awaiting/logged без upcoming, readiness без ложного нуля и привязанный cursor. Focused 64 и full API 1007 tests PASS. Повтор full API после геометрических/browser правок не требовался: hashes зависимостей сверены в `api-evidence-reuse.json`.
- W2-R принят: lazy Three.js, controlled camera/layers/selection, holes/vertical volumes, picking и доступный DOM list; north-up comparison с общими метрами на пиксель. 6 focused renderer/comparison tests PASS. Browser доказал mouse/drag, stationary second touch и pinch zoom по GPU projection matrix, idle/hidden retirement, снятие listeners, context-loss fallback/retry и keyboard focus.
- W3 принят: приватный `/airports/[iata]`, один shell-owned main, одна контекстная панель, EN/RU copy, Overview previews/entry и entry-bound restoration. Browser journeys на 1440×900 и 390×844 покрывают полный scope при отказе prefs save, историю/объекты/сравнение, native Back после mobile reload, sheet scroll/focus, явный Overview, Forward/Back после нового выбора и independent entry. Owner switch с удержанным старым ответом не публикует чужие данные. Asset failure, invalid scope и direct comparison проходят.
- W4 принят: полный navigation script завершился exit 0 — 61 case PASS в обычной fixture, один dock case условно пропущен там и отдельно PASS с `KUUKI_NEXT_DOCK_FIXTURE=1`. Dock проверяет layout через HTTP doubles и optional synthetic binding presence; выполнение фоновых jobs этим не доказывается. Сохранены traces и screenshots. Ручной agent-browser spot-check: BER preview/loaded/history на desktop, TBS object detail на 390 px, на 320 px нет overflow, один main и основные controls ≥44 px. Свои browser session и preview остановлены.
- Остальные gates PASS: lint (0 errors, 15 существующих warnings), API/Next/Worker types, Next 217 files / 1853 tests, production build и composed Worker smoke. Smoke проверяет private/member границы, maintenance и exact asset GET/HEAD/304/MIME/missing-path safeguards; API inventory — 85 routes. Все актуальные логи имеют префикс `final-` рядом с ledger.
- Независимое полное review обнаружило P1 duplicate terminal envelopes и P2 tower layer; geometry recheck — P1 потерю нижнего объёма под elevated part и P2 циклы сравнения близких площадей. Исправлены generic vertical `volumeSlices`, semantic-envelope replacement, строгий total rank и observed control-tower tags; добавлены actual-source BER/TBS и near-equal регрессии. Финальный независимый recheck: все findings CLOSED, новых material findings нет. Небольшая последующая primary правка закрывает detail panel при пустом pick; повторные build/navigation/lifecycle checks её покрывают.
- Payload budgets соблюдены: geometry gzip TBS 24 617 / BER 80 851 bytes; plans 23 635 / 72 910; крупнейшие previews 29 388 / 139 540; catalog 4 874 raw. Точные величины — [report.generated.json](../../scripts/airport-models/report.generated.json); финальный lazy chunk, versions, lockfile и fixture hashes — `chunks.json` в evidence.
- Portability PASS: `prepare.ts --check` воспроизвёл все 20 outputs в отдельном временном source/data bundle без `.scratch`, `.git` и workspace package links; скопированы только объявленные production inputs и шесть pinned npm dependencies. Использован установленный pinned tsx как инструмент. Новый Git checkout не создавался по прямому указанию пользователя. `portability.json` и `final-portability.log` фиксируют доказательство.
- Ограничение performance: выбранный headless mobile profile — Chrome 156 / ANGLE Vulkan SwiftShader, DPR 1, 390×844 TBS и 320×700 BER/reduced motion. Итоговый untraced p95 интервала между GPU submissions: TBS 18.1 ms, BER 34.2 ms; p95 CPU render work 1.0/1.7 ms, idle frames 0. BER превышает цель ≤33 ms; цель не снижена и не объявлена достигнутой. Отдельный traced прогон 18.5/34.3 ms сохранён; более ранний traced прогон имел 50.2 ms BER. Это не измерение FPS физического телефона; hardware-GPU/device performance остаётся непроверенной.
- Provenance limits: точная дата retrieval/state исходных OSM snapshots неизвестна (`null`); элементные timestamps не выдаются за дату snapshot. Высоты/ширины estimates явно помечены. Runtime не обращается к Overpass/OSM, reference renderer не импортируется и не исполняется. Scratch inputs сохранены, кроме явно обновлённого spec.

Минимальные уточнения к плану: dev-only polygon-clipping для physical volume reconciliation; shared `buildingVolumes` + `volumeSlices` для preview/Three, без высотных slices в flat plan. Next external comparison push/replace не переносит internal `__NA` short-circuit. Retry notice расположен над сценой, вне нижней object panel. Существенные production-правки приняты независимым review; последующие fixture/copy/empty-pick изменения полностью проверены primary.

## Историческая authority и состояние планирования

Запрошен полный план реализации с `$writing-wave-plans`. Действующие авторизации: исследование, макеты и план. Коммиты, implementation waves, push/PR/deploy не запрошены. Не считать исходный HTML или SVG-макет встроенной функцией Kuuki.

В текущем checkout уже есть не принадлежащие задаче staged/unstaged/untracked изменения. В этой planning iteration разрешены записи только в plan и этот handoff. После возобновления прочитать live AGENTS.md и повторно установить владельцев путей; не восстанавливать checkout к planning baseline.

Принято в обсуждении: отдельный airport screen из Обзора, model-first, history on demand с полным inherited scope, возврат состояния, инспекция объектов, сравнение в общем масштабе. Пользователь ответил «отлично» на UX-направление V2 перед запросом плана. План формализует production-решения; это не команда начинать исполнение.

## Исходный planning inventory

Таблица фиксирует SHA256 входов **до исполнения**. Spec обновлён в рамках W4; остальные research/prototype входы сохраняются. Production generation/build используют только self-contained `scripts/airport-models/sources` и больше не зависят от `.scratch`. Текущая scoped identity и hashes фиксируются отдельно в execution ledger.

### Inputs needed to resume planning

Production code/config — tracked source в owning checkout, проверять актуальный HEAD при старте. Следующие research/prototype inputs сейчас **checkout-local и untracked**, что проверено `git ls-files`; переносить в новую изоляцию только этот явный inventory, предварительно сверяя hash. Первые два official OSM snapshots достаточны для independent production preparation; авторский renderer нужен только для исследования/повторения старого макета.

| Local input                                                                            | SHA-256                                                            | Назначение                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| [Spec](../../.scratch/airport-models/spec.md)                                          | `393a8ef26765345c5510b62893665480605b9124093b7d712bfd436678fb3a68` | Направление до включения UX V2 в план                    |
| [Исследование](../research/2026-10-27-airport-osm-models.md)                           | `5a17ef310a9b63798f012b9be234efed669774cf47401256a906eaa1bfd29270` | Источники, методы и ограничения                          |
| [UGTB raw OSM](../../.scratch/airport-osm-research/UGTB.osm-map.json)                  | `02af65920d233978564435baf1ea7af6b7cef874d22061853bb6f47f07b50d56` | Official map API bbox, 2 725 941 bytes                   |
| [EDDB raw OSM](../../.scratch/airport-osm-research/EDDB.osm-map.json)                  | `2fa4485ed21f0f63c7bd043dc5a041d348b6407418b6b5e235e3dfed8202f1cc` | Merged official bbox, 27 070 960 bytes                   |
| [V1 template](../../.scratch/airport-models/ui-concept.template.html)                  | `f44dcc8fb5adfc791e8a94e0181212f389de3d5599af845e98b3c0c64d578cac` | Только discussion prototype                              |
| [V1 generator](../../.scratch/airport-models/build-ui-concept.mjs)                     | `9ab26554f4ddf191cc1d10f7d658e8a8bc003dec46a2884f0a36c360f052482b` | Первый шаг генерации макета                              |
| [V2 generator](../../.scratch/airport-models/build-ui-concept-v2.mjs)                  | `8a9fd3cddd3189b9291d69c4af04d890bb3140eb78dbe6215aa8b1d3380207a6` | Второй шаг; читает generated V1 HTML                     |
| [V2 HTML](../../.scratch/airport-models/ui-concept-v2.html)                            | `2943b4171e229d44a523d02b32a4b3939774de30592ad01a81e17332a6e96853` | Согласованный визуальный ориентир, 475 319 bytes         |
| [UGTB features](../../.scratch/airport-osm-research/UGTB.features.json)                | `4ad9bad103db90aa8db24f7f4f24960d020b0da7dbefe993f8596a74ac3024f6` | Только старый отбор для V1; не точный Overpass результат |
| [Reference renderer](../../.scratch/airport-osm-research/reference/renderer.js)        | `819e986bc6dea1b913dd7f929e1a898a4616f66d80644b3519ee6f34b9350597` | Research; reuse licence не установлена                   |
| [Reference BER SAMPLE](../../.scratch/airport-osm-research/reference/EDDB.sample.json) | `3e87eb7cd0346d5d4d49cede9d718bef85d3086a05fb99c16e986ecb683fcc96` | Данные старого макета, не обязательный production input  |

Для старого макета нужны все prototype inputs из таблицы и tracked fonts `apps/next/public/fonts/{Commissioner-Regular,Commissioner-SemiBold,PaperMono-latin}.woff2` из соответствующего source checkout. Генерация от root: `node .scratch/airport-models/build-ui-concept.mjs`, затем `node .scratch/airport-models/build-ui-concept-v2.mjs`. Это воспроизводимость обсуждения; генераторы с `vm`/string replacements не являются production pipeline.

При переносе production W1 должен сохранить небольшие самостоятельные source extracts/config/licence records в tracked `scripts/airport-models/sources/` и обновить inventory с containing revision. Если local inputs недоступны, сообщить конкретный недостающий файл; не заменять снимок текущими данными без явной записи обновления.

## Evidence до исполнения

- В прошлых итерациях проверены синтаксис prototype scripts и интерактивные состояния через HTML preview: stable scene scale, одна context panel, object focus, history scope return, comparison Back/Escape/focus, desktop/phone layouts. Это не доказательство production auth, API, Worker cache или performance.
- В planning iteration проверены текущие scripts/config/contracts и наличие/хэши локальных inputs. Команды `pnpm next:build`, API tests и navigation suite не запускались: production source не менялся.
- Независимое read-only plan review выполнено через native dispatch `gpt-6.1-sol` / `high` (`airport_wave_plan_review`). Найденный P2: source Overview entry не имела явной привязки return token для native Back после reload. Primary добавил namespaced history.state binding, entry-specific restoration и соответствующий browser scenario. Также уточнены effective travel scope, нециклический hash preimage и exclusive dependency-install slot. Reviewer не указал других blockers; финальные исправления внесены и проверены primary после review, второго review round не было.
- Node в planning environment: `v26.12.1`; repository package manager: `pnpm@9.15.9`. Повторно проверить executor environment; это не требование менять проектную версию Node.
- Final prose validation: PASS — 21 локальная ссылка плана и 12 ссылок handoff, все 11 input hashes, обязательные поля `wave-plan/v1`, четыре волны и final evidence gate; existing check commands сверены с root/app package.json. Application gates не выполнялись.

## Историческое следующее действие (planning)

При отдельной команде на исполнение: проверить plan/handoff и input inventory, зафиксировать live ownership/patch identity и начать W1. До такой команды остановиться на согласованном плане. Зафиксированные проверки документа — prose-only evidence, не выполнение implementation gates.

## Следующее действие исполнения

Авторизованная локальная реализация завершена. Для оценки mobile performance нужен отдельный прогон на физическом устройстве с аппаратным GPU; текущее превышение BER не скрыто. Коммит, push, PR, deployment и remote writes требуют отдельного поручения; автоматически не выполняются.
