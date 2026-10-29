# Модели аэропортов — implementation handoff

Status: W1–W4 и Thermos/Ponytail оптимизация проверены и зафиксированы коммитами `1674d0f4` и `305bc7a9`, оба опубликованы в origin/main с отдельного разрешения пользователя. Production release запрошен, но остановлен на failed native CI; production не изменён. Подготовлено сокращение тестового кода и исправление setup timeout; дополнительный owned commit/push разрешён. Ожидание треда справочника завершено; миграция нового commit `673bab68` требует отдельного допуска. BER performance goal остаётся открытым.

Plan: [2026-10-29-airport-models.md](2026-10-29-airport-models.md).
Checkout: `/Users/indi256/Documents/kuuki/kuuki`, shared branch `main`.
Planning baseline: `9a64ee9474629cab8c2c8bf1592b85afa0f1fac6`.
Date: 2026-10-29, Asia/Tbilisi.

## Текущее исполнение

Пользователь разрешил implementation, commit, глубокую оптимизацию, затем production deployment и push только двух готовых коммитов Airport Models. Этот push выполнен. Новое поручение — сократить бесполезные тесты; дополнительный commit/push подготовленного изменения отдельно разрешён. По поручению пользователя дождались завершения треда исправления справочника: новый локальный commit `673bab68` содержит миграцию `0017`. Разрешение на её production application и публикацию этого дополнительного commit запрошено отдельно. PR и remote D1 writes не разрешены. Прежние planning-only формулировки ниже — историческая запись.

Исходная реализация: commit `1674d0f437ed48aa1c7cf86442598356cb1724ae`. Evidence W1–W4 находится в `/tmp/plan-execution/airport-models-20261029/`; финальный optimization candidate, проверки, review snapshots и Git recovery records — `/tmp/airport-models-optimization-20261029/`. Проверки выполнены в общем checkout по прямому запрету создавать другой checkout. Коммиты используют private index, обычные hooks и проверку сохранности live files/staging. Чужие 20 tracked изменений и префиксы DESIGN/docs README сохраняются. Primary `gpt-6.1-sol/xhigh`; workers `gpt-6.1-sol/medium`; независимые reviewers `gpt-6.1-sol/high`.

- W1–W3 приняты: independent offline OSM preparation/provenance/ODbL, строгий scope codec и exact Worker allowlist; private raw-row history; lazy Three.js и physical flat comparison; private routes/один main/единая панель, Overview entry и entry-bound restoration. Новых коллекций, live simulation, миграций и runtime Overpass нет.
- Текущие assets: TBS `e29cc4e107a9c2163615f7c17dd2d12b674d6d043f551f710a78840d9afd5b6e`, BER `22781513d732768ff7191fcc20363db4ede08a364c7fef2676c26f222c0aed9d`. Полные модели содержат прежние 437/924 identities и совпадают с исходной реализацией кроме revision; previews побайтно совпадают. Plans исключают 67/299 недействующих записей, сохраняя displayed geometry и runway metadata. Старые неопубликованные outputs архивированы и остаются в исходном коммите; новые content-addressed assets не перезаписывались.
- Thermos дважды независимо проверил исходный commit: branch/security и code quality. После dedup — три P2: pending pagination после abort, потерянная invalidation закрытой History, cursor на legacy date boundary. Все воспроизведены до исправления и закрыты. Отдельный независимый recheck оптимизации не нашёл новых material P1/P2; 35 pinned paths совпали при финальном чтении. Последующая небольшая primary правка двух provenance formatter calls проверена финальными types/build/browser gates.
- Оптимизация: display batches по layer/material, точные CPU meshes для picking/outlines, cached bounds/pick list и один hover raycast на animation frame; неизменённое visual state не вызывает GPU frame. Unfiltered history получает LIMIT 51 и exact count в том же D1 batch с revisions/global ground presence; filtered path сохраняет canonical projection/matches. Opaque cursor v2 использует ID anchor без парсинга legacy dates. Proj4 converter создаётся один раз на аэропорт; используются общие UI formatters.
- Финальные checks PASS: pipeline 11 + deterministic check 20 outputs + script types; API 1008; Next 218 files / 1855 tests; lint 0 errors/15 существующих warnings; API/Next/Worker types; production build и composed Worker smoke. Полный navigation script — 61 PASS в обычной fixture, dock case условно пропущен там и отдельно PASS; дополнительный canvas trace — 1 PASS. Private/owner races, inherited scope, native Back после mobile reload, scroll/focus, picking/touch/layers, hidden/idle retirement, context-loss retry и equal comparison scale покрыты. Import dock fixture доказывает layout, не выполнение фоновых jobs.
- На финальном untraced software-GPU profile: draw calls TBS 440→10, BER 951→11; triangles остались 7639/36365; p95 CPU render work 1.0/2.1→0.3/0.3 ms, idle 0. BER plan 72 910→55 455 gzip bytes. Renderer chunk 144 966 gzip bytes при budget 307 200. Все payload budgets проходят; точные величины — [generated report](../../scripts/airport-models/report.generated.json).
- Ограничение сохранено: Chrome 156 / ANGLE Vulkan SwiftShader / DPR 1; TBS 390×844 normal motion, BER 320×700 reduced motion. Финальный p95 интервала между GPU submissions 17.6/34.2 ms; traced 17.4/34.3 ms. BER превышает цель ≤33 ms; это не device FPS, причина оставшегося интервала не доказана. Physical hardware-GPU mobile не проверен. Follow-up записан отдельным [issue file](../../.scratch/airport-models/performance-followup.md), цель не снижалась.
- Portability повторно PASS: все 20 outputs воспроизводятся в non-Git source/data bundle без `.scratch` и workspace links. Точная дата retrieval/state OSM snapshots остаётся unknown/null, dimensions estimates явно помечены; reference renderer не импортируется и не исполняется. Raw research/prototype inputs сохранены.

Подробные изменения, метод измерений, результаты review и остаточные ограничения: [optimization report](../research/2026-10-29-airport-models-optimization.md). Source identity и commit results фиксируются во внешнем ledger без циклического включения собственного patch hash в документ.

## Production release — текущий gate

- Исходный candidate: `305bc7a99d4e9aa087daac7642cf347d4cb6b242`; Cloudflare Build `ac1ec346-1e73-4f9e-a249-765e2267860f` завершился fail: 1853 client tests PASS, 1007/1008 API PASS. Единственное падение — `import-runtime.test.ts:505`, initial extraction poll с Vitest default 1000 ms, до открытия subscriber. Повтор неизменённого failed source не запускался.
- Локальная чистая сборка из `git archive`, Worker types, composed smoke, deterministic check 20 outputs PASS; новый Git checkout не создавался. Все первоначальные 17 production migrations присутствуют. После завершения треда справочника локально добавилась `0017_airport_catalog_coverage.sql`; повторный read-only ledger подтверждает, что она ещё не применена (17/18). Remote writes не выполнялись. Import Worker существует, его source/config не менялись.
- Rollback targets: kuuki-next `7b5c1e43-678c-4092-9205-8be6ac0bcabb`, kuuki-activation `c58c87f6-1adb-49f8-8af6-581287e840d2`. Production baseline HTTP PASS; ни один Worker не переопубликован.
- По новому поручению удалены лишние profile-only browser probes, чтение внутреннего sessionStorage и повторные scale/cache assertions. Focus test больше не использует production helper для ожидаемых точек: fault injection показал прежний false PASS и новый FAIL на пустых bounds. Test-only export `featurePoints` закрыт. Initial extraction setup poll увеличен до 10 s; отдельный subscriber-close deadline 2 s сохранён. Задержка provider chunk 1500 ms воспроизводит исходный setup failure; после правки все три terminal-action сценария PASS. Причина замедления native CI не доказана.
- Проверки подготовленного изменения: airport units 12 PASS, import-runtime 35 PASS, чистая production build PASS, три затронутых browser journeys PASS. Новых тестовых сценариев не добавлено. Основной удалённый объём — наблюдательные probes, поэтому ускорение всего CI не заявляется. Существующие geometry, lifecycle, owner isolation и cursor regressions сохранены.
- Evidence/owned patch: `/tmp/kuuki-airport-release-20261029/`. Два assertion hunks общего import-теста вошли в commit `673bab68` своего владельца. Новый owned candidate строится поверх этого commit, сохраняя прочую незавершённую работу checkout. Source bundle проверяется отдельно; чужие изменения не публикуются этим релизом.

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

Зафиксировать только подготовленные owned hunks поверх `673bab68`. Перед publication/application deployment получить отдельный допуск нового справочного commit и migration release для `0017` по runbook; до него не выполнять remote writes. Затем пройти новый exact-SHA Cloudflare Build, deploy-kuuki для обоих production Workers и HTTP/asset/auth verification. До успешных release gates production не менять. Открытый performance goal ведётся в issue file выше; PR и remote D1 writes не входят в разрешение.
