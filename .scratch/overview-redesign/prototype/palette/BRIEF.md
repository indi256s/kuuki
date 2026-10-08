# Kuuki — category colour boards (shared brief for Paper agents)

Paper file id `01M48F4SHK61AZS2FH5P5JPRY7`, page `p-1-0`. Reference design: board "9.3 Overview — desktop, bento" (node `681-0`); its Fleet card is node `6IZ-0`. Run `get_jsx` on `6IZ-0` FIRST and copy its card shell exactly (background, border, radius, padding, header row, title type) so new cards match the bento.

## Paper rules
- Load Paper tools with ToolSearch (`select:mcp__paper__get_guide,mcp__paper__create_artboard,mcp__paper__write_html,mcp__paper__get_jsx,mcp__paper__get_screenshot,mcp__paper__update_styles,mcp__paper__set_text_content,mcp__paper__delete_nodes,mcp__paper__duplicate_nodes,mcp__paper__finish_working_on_nodes,mcp__paper__get_node_info,mcp__paper__get_children`). Call `get_guide({topic:"paper-mcp-instructions"})` once.
- Only create/edit YOUR artboards. Never touch any other node in the file.
- Artboards: `create_artboard` with `height: "fit-content"`, light boards background `#FBFAF8`, dark boards `#292827`. Width 1440 unless told otherwise.
- Build in small `write_html` calls (one visual group each). Screenshot after each section, fix issues, and at the end call `finish_working_on_nodes`.
- Images: `background-image: url(paper-asset:///tmp/kuuki-live/paper/<file>.png)` with `background-size: 100% 100%` on a div sized exactly to the image's CSS size (pixel size ÷ 2).
- Never show node IDs in text on the canvas.

## House style (hard rules)
- Fonts: figures and headings Commissioner 600 with `font-feature-settings:'tnum'`; body/labels Commissioner 400; codes, hex values, aircraft types JetBrains Mono. Units smaller than figures (e.g. 28px figure + 15px unit).
- Light: text `#302D2A`, muted `#66605B`, page `#FBFAF8`, card `#FFFFFF`, inset `#F2F0ED`, card border `#DEDAD5`. Dark: text `#F1EFEB`, muted `#C4BEB7`, page `#292827`, card `#353331`, inset `#403D3A`, card edge = 1px inner top highlight white 5% instead of a border.
- **No divider lines** anywhere inside content or page chrome (no hairlines between rows, under headers, above footers). Group with space. Only full outlines (cards, chips, buttons, inputs) are allowed.
- Shu `#C23417` is the brand/interactive accent ONLY — never a category colour. Use it only for links/selected toggles.
- Numbers and legend text are ALWAYS text ink (`#302D2A` / dark `#F1EFEB`), never the category colour. Identity is carried by a colour+shape chip beside the text.
- Muted text never below 12px; no italic narrator.

## Manufacturer palette (entity tokens; global, same for every user)
| Token | Maker | Shape | Light | Dark | Pigment name |
|---|---|---|---|---|---|
| `--cat-maker-airbus` | Airbus | rounded square | `#0F6390` | `#0685B6` | Hanada 縹 |
| `--cat-maker-boeing` | Boeing | rounded square | `#16A384` | `#04AC7B` | Tokusa 木賊 |
| `--cat-maker-embraer` | Embraer | rounded square | `#8C6D08` | `#A4770F` | Ōdo 黄土 |
| `--cat-maker-atr` | ATR | rounded square | `#9A52CF` | `#A36FFA` | Kikyō 桔梗 |
| `--cat-maker-other` | Other (Sukhoi, Bombardier, De Havilland, COMAC, Tupolev…) | rounded square | `#C2BAB0` | `#C9C1B7` | — |
| `--cat-maker-unknown` | aircraft not recorded ("empty slot") | rounded square | `#ECE9E5` | `#47433F` | — |

**SHAPE RULE (2026-10-07, replaces the old per-maker shapes):** ONE shape for every maker — a filled rounded square (radius = 20% of size; 12px legend chip = radius 3px). No circles, diamonds, rings, insets or dashed outlines anywhere. Colour is the only encoding; it passes colour-blind checks on its own (light worst ΔE 10.5 protan, dark 10.4 deutan, normal-vision ≥ 16.8). Other is a pale neutral and Unknown is a near-surface "empty slot" tint, so the two greys separate by lightness. Other in light is 1.9:1 on white — relief comes from the legend labels/numbers, which are always shown.

Validation (dataviz validator, OKLCH): light and dark both PASS lightness band, chroma ≥ 0.10, contrast ≥ 3:1 on card, and colour-blind separation on ALL pairs (light worst ΔE 10.5 protan, normal-vision worst 17.8; dark worst 10.4 deutan, normal 16.8).
Hue distance to the 5 user accents (Shu 33°, Ai 272°, Matcha 125°, Asagi 205°, Sakura 355°): nearest is ATR↔Ai 26°, Airbus↔Asagi 29°, Boeing↔Asagi 33°, Embraer↔Matcha 37°. Known trade-off: Airbus is 10° from info blue, Boeing 14° from success green, Embraer 16° from warning amber — acceptable because status colours always ship with an icon + label and never appear in charts.
Mapping rule: maker = current type designation (A220 = Airbus). Attributed by ICAO type in a typed repo table.

## Alliance inks (mark-first; never in the same chart as makers)
| Token | Alliance | Mark | Light | Dark |
|---|---|---|---|---|
| `--cat-alliance-star` | Star Alliance | ★ | `#6B5A2E` | `#CDB98A` |
| `--cat-alliance-oneworld` | Oneworld | ○ | `#6A3F55` | `#D3A6BC` |
| `--cat-alliance-skyteam` | SkyTeam | △ | `#3E5266` | `#A9BBD0` |
| — | Unaligned | none | — | — |
All ≥ 5.9:1 on their surfaces (text-grade). Membership counted at flight date; airlines that left get a note, e.g. "S7 · left Oneworld 2022". Operating carrier decides.
Charts map entity tokens onto TanStack `--ts-chart-n` slots at render.

## Sample data (69 flights, March 2014 – 2026)
Flights by maker: Airbus 38, Boeing 21, Embraer 3, ATR 2, Unknown 5.
Hours: total 216.7 h — Airbus 126.4 h (58%), Boeing 73.0 h (34%), Embraer 5.9 h (3%), ATR 2.4 h (1%), Unknown 9.1 h (4%). As 100 cells: Airbus 58, Boeing 34, Embraer 3, ATR 1, Unknown 4.
Distance: total 141,204 km — Airbus 82,861 (59%), Boeing 49,074 (35%), Embraer 3,446 (2%), ATR 998 (1%), Unknown 4,825 (3%). As 100 cells: Airbus 59, Boeing 35, Embraer 2, ATR 1, Unknown 3.
Types: A320 27, 737 16, A350 8, 777 5, A330 3, E190 3, ATR72 2, unknown 5.
Body: Narrowbody 48 (Airbus A320 27, Boeing 737 16, Embraer E190 3, ATR72 2) · Widebody 16 (Airbus A350 8 + A330 3 = 11, Boeing 777 5) · Unknown 5.
"Other" variant (for the expanded-Other state only, label it "Variant: RU traveller"): Airbus 31, Boeing 18, Other 7 (Sukhoi Superjet 4, Bombardier CRJ 2, De Havilland Dash 8 1), Embraer 3, ATR 2, Unknown 3 = 64.

## Waffle generator
`node /tmp/kuuki-pal/waffle2.mjs <light|dark> '<[["Airbus",38],["Boeing",21],["Embraer",3],["ATR",2],["Unknown",5]]>' <cell> <gap> <cols>` prints ready HTML (shapes kept when cell ≥ 8px). Paste its output into `write_html`. Order is always Airbus, Boeing, Embraer, ATR, Other, Unknown.

## Chart images
- `fleet-ridge-light.png` / `fleet-ridge-dark.png` — 1104×568 px → place at 552×284. Ridgeline for types with ≥ 8 flights (A320, 737, A350), actual shaped dots for smaller types; narrow types first, then wide; log-hour axis.
