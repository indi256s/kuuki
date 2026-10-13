# Проверка sparkgeo/geo-mcp-servers

13 октября 2026. Проверенный commit:
[`d4d546f62ff2326168b5fdf18d7609a68c106397`](https://github.com/sparkgeo/geo-mcp-servers/tree/d4d546f62ff2326168b5fdf18d7609a68c106397).
Ничего не установлено и не подключено. Проверены каталог/структура исходников
и README трёх наиболее релевантных проектов; полный аудит их кода не проводился.

**Вывод:** это каталог ссылок на MCP-серверы, не справочник городов и не
готовый backend Kuuki. Сохраняем выбранный GeoNames `cities500`, RU/EN
алиасы при импорте, ручное место с необязательными координатами и расстояние
по прямой. Значимый дополнительный источник для будущего исследования —
Overture Maps через PlaceRoot; подключать MCP ради текущей задачи не нужно.

## Что находится в репозитории

[README](https://github.com/sparkgeo/geo-mcp-servers/blob/d4d546f62ff2326168b5fdf18d7609a68c106397/README.md#L1-L37)
и [servers.yaml](https://github.com/sparkgeo/geo-mcp-servers/blob/d4d546f62ff2326168b5fdf18d7609a68c106397/servers.yaml#L1-L29):
100 внешних серверов, 11 категорий; таблицы генерируются из YAML.
Есть scripts проверки активности/генерации README, health.json,
CI и Claude skill для поиска/рекомендации серверов.
[Единственная зависимость каталога](https://github.com/sparkgeo/geo-mcp-servers/blob/d4d546f62ff2326168b5fdf18d7609a68c106397/requirements.txt#L1)
— `pyyaml>=6`. Сам каталог не предоставляет MCP transport, инструменты
геокодирования, ключи API или сервер для развёртывания.
[Лицензия каталога MIT](https://github.com/sparkgeo/geo-mcp-servers/blob/d4d546f62ff2326168b5fdf18d7609a68c106397/LICENSE)
не распространяется на лицензии данных и сервисов по ссылкам.

Релевантный [раздел geocoding](https://github.com/sparkgeo/geo-mcp-servers/blob/d4d546f62ff2326168b5fdf18d7609a68c106397/README.md#L53-L78):
Geoapify, geocode-mcp, HERE, MCP-Geo, mcp-nominatim, open-streetmap-mcp,
OpenCage, openstreetmap-mcp-server, OSM-GeoJSON, osmmcp, PlaceRoot,
Smarty, what3words, Wheremind, Zephr. Routing: OSRM и Valhalla.
Остальные категории — платформы карт, пространственные БД, спутниковые
данные, погода, desktop GIS, toolkit, каталоги данных, авиация/море, прочее.
Это список возможностей внешних проектов, не проверенная гарантия покрытия.

## Проверенные релевантные варианты

| Проект / источник | Инструменты и запуск по README | Что означает для Kuuki |
|---|---|---|
| [mcp-nominatim](https://github.com/pipeworx-io/mcp-nominatim#tools) / OSM Nominatim | `search_address`, `reverse_geocode`, `lookup`; API без auth, MIT-код; удалённый Pipeworx MCP endpoint | Обёртка над внешним геокодером, не поставка автономного city dataset. MCP не отменяет ограничения upstream. |
| [mcp-osrm](https://github.com/pipeworx-io/mcp-osrm#tools) / публичный OSRM demo | `route`, `table`, `nearest`, `match`, `trip`; без auth, MIT-код; gateway либо локальный Node/npm stdio; собственный OSRM для production load | Дорожные маршруты/матрицы. Железнодорожный профиль в README не заявлен. Не нужен при принятом расстоянии по прямой. |
| [PlaceRoot](https://github.com/chuofringer/placeroot#what-it-can-do) / Overture Maps, DuckDB | `geocode`, `find_places`, `place_details`, reverse, административные границы; route/isochrone; Python, stdio либо локальный HTTP, uvx/npm; без API key | Существенный альтернативный источник открытых данных, но MCP-ответы сами по себе не становятся каталогом городов. |

У mcp-osrm [источник прямо назван demo](https://github.com/pipeworx-io/mcp-osrm#data-source)
с fair-use ограничением; локальный stdio меняет транспорт, но не источник.
У Pipeworx gateway дополнительно публикуются общие meta-tools;
это более широкий интерфейс, чем несколько перечисленных geo-tools.
[Политика публичного Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
запрещает клиентское autocomplete и устанавливает максимум 1 запрос/с
на приложение. Поэтому Nominatim wrapper не заменяет наш локальный поиск.
Для коммерческих провайдеров каталог отмечает free-tier/commercial;
конкретные ключи, тарифы, лицензии и ограничения надо проверять у выбранного
провайдера. Их аккаунты/ключи и package lockfiles здесь не исследовались.

## Что заслуживает повторного использования

[PlaceRoot заявляет](https://github.com/chuofringer/placeroot#why-placeroot)
GERS IDs, локальный cache и запросы к публичным данным Overture на AWS S3.
В отличие от обычного API wrapper, underlying data доступны независимо
от MCP. Это полезная точка входа для будущих POI, границ или собственного
импорта дополнительной географии; не доказано покрытие маленьких городов
GE/AM/TR, наличие нужных RU/EN имён и timezone в требуемой форме.
Places у него преимущественно business listings; населённые пункты/границы
требуют выбора соответствующей темы, правил импорта и проверки качества.
[Лицензирование по README PlaceRoot](https://github.com/chuofringer/placeroot#license-and-attribution):
код MIT, places CDLA-Permissive-2.0; divisions/transportation/base ODbL.
MIT-код не означает MIT-данные. Перед импортом нужна проверка лицензии
конкретного release/theme непосредственно у Overture.

Практическая рекомендация: сохранить ссылку как каталог возможных источников;
не брать оттуда сервер, transport или routing в наземный журнал сейчас.
Overture рассматривать отдельно только при выявленном пробеле GeoNames.
Формы компактных результатов поиска и явные source IDs можно изучить как
идеи, но заимствование кода/данных этой проверкой не предлагается.
