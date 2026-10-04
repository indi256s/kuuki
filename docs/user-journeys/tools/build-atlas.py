#!/usr/bin/env python3
"""Validate captured area manifests and assemble the offline atlas."""
import collections
import datetime
import hashlib
import html
import json
from pathlib import Path
import struct
import sys

DATE = sys.argv[1] if len(sys.argv) > 1 else "2026-10-03"
ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "docs/user-journeys" / DATE
AREAS = ["public-social", "flights-import", "dashboard-passport-journey"]
states, journeys, gaps, seen = [], [], [], set()
for area in AREAS:
    document = json.loads((BASE / area / "manifest.json").read_text())
    if not (BASE / area / "flows.md").is_file():
        raise ValueError(f"Missing flow documentation: {area}")
    declared_images = {item.get("screenshot") for item in document["states"]}
    unindexed_images = {str(path.relative_to(BASE / area)) for path in (BASE / area / "images").glob("*.png")} - declared_images
    if unindexed_images:
        raise ValueError(f"Unindexed screenshots in {area}: {sorted(unindexed_images)}")
    for original in document["states"]:
        state = dict(original, area=area)
        if state["id"] in seen:
            raise ValueError(f"Duplicate state ID: {state['id']}")
        seen.add(state["id"])
        if state["status"] not in {"captured", "source-only", "simulated"}:
            raise ValueError(f"Unknown status for {state['id']}")
        for field in ["screenshot", "snapshot"]:
            relative = state.get(field)
            if not relative:
                if state["status"] == "captured":
                    raise ValueError(f"Captured state has no {field}: {state['id']}")
                continue
            path = (BASE / area / relative).resolve()
            if not path.is_relative_to((BASE / area).resolve()) or not path.is_file():
                raise ValueError(f"Missing or invalid {field}: {path}")
            if field == "screenshot":
                blob = path.read_bytes()
                if blob[:8] != b"\x89PNG\r\n\x1a\n" or b"IEND" not in blob[-12:]:
                    raise ValueError(f"Invalid PNG: {path}")
                width, height = struct.unpack(">II", blob[16:24])
                state["image_size"] = {"width": width, "height": height}
                state["screenshot_sha256"] = hashlib.sha256(blob).hexdigest()
                viewport = state.get("viewport", {})
                if viewport.get("width") and width != viewport["width"] and state.get("capture_mode") != "fullpage":
                    raise ValueError(f"PNG width differs from viewport: {state['id']}")
            elif not path.read_text().strip():
                raise ValueError(f"Empty snapshot: {path}")
            state[field] = str(path.relative_to(BASE))
        states.append(state)
    journeys.extend(dict(item, area=area) for item in document.get("journeys", []))
    gaps.extend(dict(item, area=area) for item in document.get("gaps", []))

for journey in journeys:
    unknown = set(journey.get("states", [])) - seen
    if unknown:
        raise ValueError(f"Unknown states in journey {journey['id']}: {sorted(unknown)}")

for state in states:
    for action in state.get("actions", []):
        target = action.get("to")
        if target and not target.startswith("/") and target not in seen:
            raise ValueError(f"Unknown action target in {state['id']}: {target}")

SEVERITIES = ["P0", "P1", "P2", "P3"]
DIMENSIONS = {"accessibility": "Доступность", "performance": "Производительность", "responsive": "Адаптивность",
              "theming": "Темы и токены", "integrity": "Целостность реализации"}
audit_path = BASE / "audit/findings.json"
audit = json.loads(audit_path.read_text()) if audit_path.is_file() else None
if audit:
    audit_ids = set()
    for finding in audit["findings"]:
        if finding["id"] in audit_ids:
            raise ValueError(f"Duplicate audit finding: {finding['id']}")
        audit_ids.add(finding["id"])
        if finding["severity"] not in SEVERITIES or finding["dimension"] not in DIMENSIONS:
            raise ValueError(f"Invalid severity or dimension in audit finding {finding['id']}")
        unknown = set(finding.get("states", [])) - seen
        if unknown:
            raise ValueError(f"Unknown states in audit finding {finding['id']}: {sorted(unknown)}")
    for state in states:
        linked = [f for f in audit["findings"] if state["id"] in f.get("states", [])]
        if linked:
            linked.sort(key=lambda f: SEVERITIES.index(f["severity"]))
            state["audit"] = [{"id": f["id"], "severity": f["severity"], "title": f["title"]} for f in linked]

counts = dict(collections.Counter(state["status"] for state in states))
captured = [state for state in states if state.get("screenshot")]
manifest = {"date": DATE, "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "environment": "environment.json", "counts": counts,
            "states": states, "journeys": journeys, "gaps": gaps}
if audit:
    manifest["audit"] = {"findings": "audit/findings.json", "report": "audit/AUDIT.md", "date": audit["date"],
                         "git_head": audit["git_head"], "total": audit["total"],
                         "severity_counts": dict(collections.Counter(f["severity"] for f in audit["findings"]))}
(BASE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

routes = [
    ("/", "Регистрация, переключение на вход и запрос активации", "public-social"),
    ("/?mode=signin", "Вход", "public-social"),
    ("/landing", "Описание приложения и showcase", "public-social"),
    ("/onboarding", "Username, первый импорт или пропуск", "public-social"),
    ("/dashboard", "Обзор, карта, фильтры и статистика", "dashboard-passport-journey"),
    ("/flights", "Журнал, формы, фильтры и удаление рейса", "flights-import"),
    ("/import", "Загрузка, распознавание, проверка и сохранение", "flights-import"),
    ("/passport", "Страны, штампы и посещения", "dashboard-passport-journey"),
    ("/settings", "Профиль, видимость, настройки и выход", "public-social"),
    ("/leaderboard", "Публичные рейтинги", "public-social"),
    ("/fly/:username", "Профиль: собственный, публичный, приватный и не найден", "public-social"),
    ("/journey", "Прототип планировщика, вход по прямому URL", "dashboard-passport-journey"),
    ("/activate", "Отдельная страница установки пароля, вне SPA", "public-social"),
]
lines = ["# Карта экранов и пользовательских путей Kuuki", "",
         f"Съёмка начата {DATE}. Скриншотов: {len(captured)}. Состояний в индексе: {len(states)}. "
         f"Пользовательских сценариев: {len(journeys)}. Статусы: " + ", ".join(f"{k}={v}" for k, v in counts.items()) + ".", "",
         "[Галерея с поиском](gallery.html) · [JSON для агентов](manifest.json) · [Версия и окружение](environment.json) · [Проверки](verification.json) · [Как пользоваться](../README.md) · [Тестовый пользователь](test-user/README.md)", "",
         "Снята локальная fixture с реальными компонентами и API, тестовыми аккаунтами и подменённым провайдером распознавания. Это снимок изменённого рабочего дерева. Доступность в production и качество настоящего OCR этим обходом не проверены.", "",
         "## Навигация", "", "```mermaid", "flowchart TD",
         '  landing["/landing • showcase"] --> auth["/ • регистрация / вход"]',
         '  auth --> onboard["/onboarding • username / первый импорт"]',
         '  auth --> dash["/dashboard • обзор"]',
         '  auth --> activation["Запрос ссылки → /activate"]',
         '  onboard --> imp["/import • загрузка"]', '  onboard --> dash',
         '  dash --> flights["/flights • журнал"]', '  dash --> passport["/passport • страны и штампы"]',
         '  dash --> imp', '  dash --> settings["/settings • настройки"]',
         '  imp --> review["Проверка / правка / сохранение"]', '  review --> flights',
         '  flights --> form["Добавление / правка / удаление"]', '  form --> dash',
         '  settings --> profile["/fly/:username • профиль"]',
         '  dash --> board["/leaderboard • рейтинг"]', '  board --> profile',
         '  passport --> claim["Добавление страны / посещения / удаление"]',
         '  direct["Прямой URL, после входа"] --> journey["/journey • прототип"]',
         '  journey --> dash', "```", "",
         "Защищённые маршруты отправляют гостя на `/`; аккаунт с `username === null` отправляется на `/onboarding`. Пустая строка username в проверенной версии этот редирект не вызывает. `/leaderboard` и `/fly/:username` публичны. Планировщик скрыт из основной навигации; его неработающие кнопки описаны в разделе путей.", "",
         "| Маршрут | Назначение | Путь и состояния |", "| --- | --- | --- |"]
for route, title, area in routes:
    lines.append(f"| `{route}` | {title} | [{area}]({area}/flows.md) |")
lines.extend(["", "## Пользовательские сценарии", "", "| ID | Сценарий | Шаги | Результат |", "| --- | --- | --- | --- |"])
def cell(value):
    return str(value).replace("|", "\\|").replace("\n", " ")
for journey in journeys:
    steps = "; ".join(str(step) for step in journey.get("steps", []))
    lines.append(f"| `{journey['id']}` | [{cell(journey['title'])}]({journey['area']}/flows.md) | {cell(steps)} | {cell(journey.get('outcome', ''))} |")
if audit:
    by_severity = collections.Counter(f["severity"] for f in audit["findings"])
    lines.extend(["", "## Аудит интерфейса", "",
                  f"Аудит `$impeccable audit` от {audit['date']} по исходникам `{audit['git_head'][:7]}`: **{audit['total']}/20** ({audit['band']}). "
                  + ", ".join(f"{s}={by_severity[s]}" for s in SEVERITIES) + ". "
                  "Скриншоты атласа служат визуальным доказательством; источник истины для находок — код на указанном коммите. "
                  "[Полный отчёт](audit/AUDIT.md) · [JSON находок](audit/findings.json). В индексе экранов колонка «Аудит» показывает находки, видимые в состоянии.", "",
                  "| Измерение | Оценка | Главное |", "| --- | --- | --- |"])
    for key, label in DIMENSIONS.items():
        score = audit["scores"][key]
        lines.append(f"| {label} | {score['score']}/4 | {cell(score['why'])} |")
    lines.extend(["", "| ID | P | Измерение | Проблема | Состояний |", "| --- | --- | --- | --- | --- |"])
    for finding in sorted(audit["findings"], key=lambda f: SEVERITIES.index(f["severity"])):
        lines.append(f"| [`{finding['id']}`](audit/AUDIT.md#{finding['id']}) | {finding['severity']} | {DIMENSIONS[finding['dimension']]} | {cell(finding['title'])} | {len(finding.get('states', []))} |")
lines.extend(["", "## Индекс экранов", "",
              "Одному маршруту соответствует несколько состояний. Для выбора используй условия входа и признаки из JSON или `flows.md`; текстовый снимок содержит доступные подписи интерфейса.", ""])
if audit:
    lines.extend(["| ID | Подпись | URL | Статус | Скриншот / текст | Аудит |", "| --- | --- | --- | --- | --- | --- |"])
else:
    lines.extend(["| ID | Подпись | URL | Статус | Скриншот / текст |", "| --- | --- | --- | --- | --- |"])
for state in states:
    links = []
    if state.get("screenshot"):
        links.append(f"[PNG]({state['screenshot']})")
    if state.get("snapshot"):
        links.append(f"[текст]({state['snapshot']})")
    row = f"| `{state['id']}` | {cell(state['title'])} | `{cell(state['route'])}` | {state['status']} | {' · '.join(links) or 'См. причину ниже'} |"
    if audit:
        row += " " + (", ".join(f"[{f['severity']}](audit/AUDIT.md#{f['id']})" for f in state.get("audit", [])) or "—") + " |"
    lines.append(row)
lines.extend(["", "## Пробелы и ограничения", ""])
for gap in gaps:
    lines.append(f"- **{cell(gap.get('state', 'Состояние'))}.** {cell(gap.get('reason', ''))} Источник: `{cell(gap.get('source', ''))}`.")
lines.append("\nДругие языки и все комбинации тем, акцентов, фильтров и размеров окна не снимаются отдельно. Мобильные варианты фиксируют различия компоновки и навигации. Различай отсутствие снимка, недоступность в fixture и функцию, которая пока не реализована.")
(BASE / "MAP.md").write_text("\n".join(lines) + "\n")

AUDIT_START, AUDIT_END = "<!-- audit:start -->", "<!-- audit:end -->"
if audit:
    state_by_id = {state["id"]: state for state in states}

    def state_link(state_id, prefix):
        state = state_by_id[state_id]
        return f"[`{state_id}`]({prefix}{state['screenshot']})" if state.get("screenshot") else f"`{state_id}`"

    report = [f"# Аудит интерфейса Kuuki — {audit['date']}", "",
              f"{audit['method']} Исходники: `{audit['git_head'][:7]}`; снимки атласа: `{audit['atlas_capture_head'][:7]}`. {audit['evidence_rule']}", "",
              "[Карта экранов](../MAP.md) · [JSON находок](findings.json) · [Галерея](../gallery.html). "
              "Этот файл собирается `docs/user-journeys/tools/build-atlas.py` из `findings.json`; правь JSON, а не Markdown.", "",
              "## Оценка", "", "| # | Измерение | Оценка | Главное |", "| --- | --- | --- | --- |"]
    for number, (key, label) in enumerate(DIMENSIONS.items(), 1):
        report.append(f"| {number} | {label} | {audit['scores'][key]['score']}/4 | {cell(audit['scores'][key]['why'])} |")
    report.append(f"| | **Итого** | **{audit['total']}/20** | **{audit['band']}** |")
    by_severity = collections.Counter(f["severity"] for f in audit["findings"])
    findings_by_id = {f["id"]: f for f in audit["findings"]}
    report.extend(["", "## Вердикт целостности реализации", "", f"**{audit['verdict']['result'].upper()}.** {audit['verdict']['text']}", "",
                   "## Кратко", "",
                   f"- Оценка **{audit['total']}/20** ({audit['band']}). Находок: {len(audit['findings'])} — " + ", ".join(f"{s}: {by_severity[s]}" for s in SEVERITIES) + ".",
                   "- P0 нет: ни одна находка не блокирует основной путь полностью. P1 — в основном нарушения WCAG AA и системные пробелы локализации.",
                   "- Главное:"])
    report.extend(f"  - [`{i}`](#{i}) — {findings_by_id[i]['title']}" for i in audit["top"])
    report.extend(["", "## Системные проблемы", ""])
    report.extend(f"- {p}" for p in audit["patterns"])
    report.extend(["", "## Рекомендуемый порядок", "", "| # | P | Команда | Что сделать |", "| --- | --- | --- | --- |"])
    for number, action in enumerate(audit["actions"], 1):
        report.append(f"| {number} | {action['severity']} | `{action['command']}` | {cell(action['text'])} |")
    report.extend(["", "## Находки"])
    for severity in SEVERITIES:
        group = [f for f in audit["findings"] if f["severity"] == severity]
        if not group:
            continue
        report.extend(["", f"### {severity} — {len(group)}"])
        for f in group:
            screens = ", ".join(state_link(s, "../") for s in f.get("states", [])) or "в атласе не снято"
            report.extend(["", f'<a id="{f["id"]}"></a>', "", f"#### [{f['severity']}] {f['title']}", "",
                           f"`{f['id']}` · {DIMENSIONS[f['dimension']]} · уверенность: {f['confidence']}" + (" · системная" if f.get("systemic") else ""), "",
                           f"- **Где:** " + ", ".join(f"`{loc}`" for loc in f["locations"]),
                           f"- **Экраны:** {screens}",
                           f"- **Влияние:** {f['impact']}"])
            if f.get("standard"):
                report.append(f"- **Стандарт:** {f['standard']}")
            report.extend([f"- **Рекомендация:** {f['recommendation']}", f"- **Команда:** `{f['command']}`",
                           f"- **Доказательства:** {f['evidence']}", f"- **Источник:** " + ", ".join(f"`{s}`" for s in f["sources"])])
            if f.get("slice_evidence"):
                report.extend(["", "<details><summary>Доказательства срезов</summary>", ""])
                report.extend(f"- {item}" for item in f["slice_evidence"])
                report.extend(["", "</details>"])
    report.extend(["", "## Что работает хорошо", ""])
    report.extend(f"- {p['text']} _({p['slice']})_" for p in audit["positives"])
    report.extend(["", "## Что не проверено", "", "Аудит статический: код, скриншоты атласа и расчёты. Браузер, скринридер и реальные касания не запускались.", ""])
    report.extend(f"- {u['text']} _({u['slice']})_" for u in audit["untested"])
    report.extend(["", "## Детектор `impeccable detect`", "", "| Правило | Где | Вердикт | Комментарий |", "| --- | --- | --- | --- |"])
    report.extend(f"| `{d['rule']}` | `{d['location']}` | {d['verdict']} | {cell(d['note'])} |" for d in audit["detector"])
    report.extend(["", "## Как пользоваться с картой", "",
                   "- Экран → находки: в [MAP.md](../MAP.md) колонка «Аудит» индекса экранов; в `manifest.json` поле `audit` у состояния; в галерее — бейджи на карточке и поиск по `P1` или ID.",
                   "- Находка → экраны: поле `states` в `findings.json` и ссылки «Экраны» выше открывают PNG.",
                   "- Раздел → находки: блок «Аудит интерфейса» в конце `flows.md` каждого раздела.",
                   "- После исправления удали или обнови находку в `findings.json`, пересними затронутые состояния и запусти `python3 docs/user-journeys/tools/build-atlas.py`."])
    (BASE / "audit/AUDIT.md").write_text("\n".join(report) + "\n")

for area in AREAS:
    flows_path = BASE / area / "flows.md"
    flows = flows_path.read_text()
    if AUDIT_START in flows:
        flows = flows[:flows.index(AUDIT_START)].rstrip() + "\n"
    if audit:
        area_findings = [f for f in audit["findings"] if area in f.get("areas", [])]
        block = ["", AUDIT_START, f"## Аудит интерфейса ({audit['date']})", "",
                 f"Находки `$impeccable audit`, видимые на экранах этого раздела: {len(area_findings)}. Общая оценка {audit['total']}/20, "
                 "системные находки без снимков и подробности — в [отчёте](../audit/AUDIT.md). Блок генерируется `build-atlas.py`.", "",
                 "| P | Находка | Экраны раздела |", "| --- | --- | --- |"]
        for f in area_findings:
            screens = ", ".join(f"`{s}`" for s in f["states"] if state_by_id[s]["area"] == area)
            block.append(f"| {f['severity']} | [{cell(f['title'])}](../audit/AUDIT.md#{f['id']}) | {screens} |")
        block.append(AUDIT_END)
        flows = flows.rstrip() + "\n" + "\n".join(block) + "\n"
    flows_path.write_text(flows)

e = html.escape
cards = []
for state in states:
    searchable = json.dumps(state, ensure_ascii=False).lower()
    picture = f'<a href="{e(state["screenshot"])}"><img loading="lazy" src="{e(state["screenshot"])}" alt="{e(state["title"])}"></a>' if state.get("screenshot") else '<p class="missing">Снимка нет. Состояние описано по коду.</p>'
    details = {k: state.get(k) for k in ["auth", "fixture", "theme", "viewport", "image_size", "capture_mode", "preconditions", "recognition", "actions", "source", "notes"]}
    if state.get("audit"):
        details["audit"] = state["audit"]
    details = json.dumps(details, ensure_ascii=False, indent=2)
    snapshot_link = f' · <a href="{e(state["snapshot"])}">Текст интерфейса</a>' if state.get("snapshot") else ''
    audit_badges = "".join(f'<a class="audit" href="audit/AUDIT.md#{e(f["id"])}" title="{e(f["title"])}">{e(f["severity"])} {e(f["id"])}</a>' for f in state.get("audit", []))
    audit_line = f'<p class="audits">{audit_badges}</p>' if audit_badges else ''
    cards.append(f'<article data-search="{e(searchable, quote=True)}"><h2>{e(state["title"])}</h2><p><code>{e(state["id"])}</code></p><p><code>{e(state["route"])}</code> · {e(state["status"])}</p>{audit_line}{picture}<details><summary>Условия и переходы</summary><pre>{e(details)}</pre></details><a href="{state["area"]}/flows.md">Карта раздела</a>{snapshot_link}</article>')
gallery = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kuuki — карта экранов</title><style>
body{margin:0;background:#f5f6f7;color:#17212b;font:16px/1.5 system-ui,sans-serif}header{position:sticky;top:0;background:#fff;padding:18px 24px;border-bottom:1px solid #ddd;z-index:1}h1{margin:0;font-size:24px}header p{margin:6px 0}input{box-sizing:border-box;width:min(650px,100%);padding:12px;border:1px solid #999;border-radius:6px;font:inherit}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px;padding:24px}article{padding:16px;background:#fff;border:1px solid #ddd;border-radius:10px;min-width:0}article[hidden]{display:none}h2{font-size:18px;margin:0 0 8px}article p{margin:4px 0;overflow-wrap:anywhere}img{width:100%;height:260px;object-fit:contain;object-position:top;background:#eee;display:block;margin:12px 0}code{font-size:13px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer;padding:8px 0}a{color:#006a70}.missing{padding:50px 10px;background:#eee}label{display:block}.count{font-size:14px}.audits{display:flex;flex-wrap:wrap;gap:6px}.audit{font-size:12px;padding:2px 8px;border:1px solid #b5651d;border-radius:999px;color:#7a3e0c;text-decoration:none}@media(max-width:420px){main{grid-template-columns:1fr;padding:12px}}
</style><header><h1>Kuuki — карта экранов</h1><p>DATE · COUNT скриншотов · <a href="MAP.md">Markdown-карта</a> · <a href="manifest.json">JSON</a>AUDITLINK</p><label for="search">Найти по URL, экрану, кнопке или состоянию</label><input id="search" type="search" placeholder="/import, паспорт, review, mobile…"><div class="count" id="count"></div></header><main>CARDS</main><script>
const input=document.getElementById('search'),cards=[...document.querySelectorAll('article')],count=document.getElementById('count');function filter(){const q=input.value.trim().toLowerCase();let shown=0;for(const card of cards){card.hidden=!card.dataset.search.includes(q);if(!card.hidden)shown++;}count.textContent=`Показано ${shown} из ${cards.length} состояний`;}input.addEventListener('input',filter);filter();
</script></html>'''.replace("DATE", DATE).replace("COUNT", str(len(captured))).replace("AUDITLINK", f' · <a href="audit/AUDIT.md">Аудит {audit["total"]}/20</a> · поиск «P1» находит экраны с находками' if audit else "").replace("CARDS", "\n".join(cards))
(BASE / "gallery.html").write_text(gallery)
print(json.dumps({"states": len(states), "screenshots": len(captured), "journeys": len(journeys), "counts": counts, "gaps": len(gaps)}, ensure_ascii=False))
