# Airline color evidence — 9 October 2026

The [source ledger](2026-10-09-airline-color-sources.csv) covers all 321 catalog rows. This pass supports 185 colors: 181 observed in matched logos, two from official site CSS, one published specification and one shared-brand inference (Jetstar Pacific). Another 79 existing colors remain unverified; 57 unresolved seed placeholders are now `null`. The [full list of these 136 rows](2026-10-09-airline-color-gaps.md) separates retained values from unknown colors. The first pass left 142 rows; the six-carrier follow-up below supplied evidence for six more.

The color pass changed only `primaryColor` in the catalog: 174 sourced color corrections and 57 placeholder removals. Names, codes, alliances, callsigns and row order remain unchanged. Rankings uses the existing theme lightness/chroma adjustment; missing colors use `--mark-ghost`. JetBlue's observed `#003876` remains valid even though the seed reused that value for unknown airlines.

## Evidence and selection

- Match the named catalog airline to its logo before sampling. IATA and ICAO alone are insufficient: some catalog codes are stale, reused or incorrect. Uncertain mappings were excluded rather than assigned another carrier's color.
- Read SVG fills or render cached raster/SVG logos, exclude transparent/white pixels, and inspect identifying hues. Raster samples are image colors, sometimes quantized, rather than official brand specifications. Logo pixel area cannot establish tail dominance.
- Prefer the identifying symbol over a neutral wordmark where supported: Royal Flight red, El Al navy and Akasa orange. Retain existing Cebu Pacific and Pegasus yellow pending tail evidence. China Eastern navy comes from the English wordmark on page 1 of its official 2024 interim results; its red emblem and Chinese wordmark are also prominent.
- Treat monochrome backgrounds separately from lettering. Mesa's downloaded black-background logo was excluded. The older Japan Transocean Air logo was also excluded from current-color confirmation.
- Preserve historical catalog identities. Travel Service uses successor Smartwings branding, SATA International uses Azores Airlines branding, and Jetstar Pacific's orange is a shared Jetstar brand inference; these choices are noted in the ledger.

The ledger's `observed_logo` status means that the selected color was observed in the cited matched artwork, not that the logo is current or the color dominates every livery. `observed_site` records an exact identifying color in official site CSS; it is not a logo or livery measurement. `published_spec` records an explicit numerical color in the cited official guideline, with its context and age noted. `shared_brand` is explicit inference. `legacy_unverified` preserves an existing non-placeholder value without new confirmation. `unresolved` means no reliable matched color was established.

Wikimedia download throttling prevented complete source coverage. Cached artifacts were inspected; guessed colors and unsupported research-agent recollections were excluded. Remaining work is tracked in [the follow-up issue](../../.scratch/airline-colors/issues/01-complete-source-coverage.md). The legacy OpenFlights importer preserves existing catalog colors and nulls when merging rows.

## Journal logo assets

118 matched logos are packaged as local PNGs (609,375 bytes total, at most 144×72), with catalog `logoUrl` paths and a separate [asset source ledger](2026-10-09-airline-logo-sources.csv). The first 113 came from cached artwork; five more came from the official sources below. Logo and color evidence are independent: Pegasus and Cebu Pacific have matched logos while their retained yellow colors still need tail evidence. Air China uses an alternate cached named wordmark. China Eastern restores the original PDF logo soft mask; Endeavor and United use their official navy header backings for white lettering. All remaining 203 catalog logos, including Air Canada, are absent and use a color or neutral fallback in Journal. Historical/successor branding remains identified in the source notes.

## Six-carrier follow-up

| Airline | Selected color | Evidence and limitation |
| --- | --- | --- |
| American (AA) | `#0D72AE` | Exact offset .4 stop in the blue symbol gradient of the [official standard newsroom SVG](https://s202.q4cdn.com/986123435/files/design/logo.svg). Selected identifying interior blue, not a measured dominant color or formal primary specification; the standard source remains linked in the commented header alongside centennial artwork. |
| Air Canada (AC) | `#F01428` | The official [Foundation usage guideline](https://www.aircanada.com/content/dam/aircanada/portal/Legacy/foundation/ACF_Guidelines_en.pdf) explicitly lists AC Red as HEX F01428 / RGB 240.20.40. Historical foundation context; this does not establish current tail dominance. No standalone airline logo was packaged. |
| British Airways (BA) | `#2E5C99` | Exact blue fills in the [official Media Centre SVG](https://mediacentre.britishairways.com/assets/britishairways__site_v2/images/logo.svg), confirming the retained value. |
| ANA (NH) | `#00146E` | `st1` fills the ANA letters and tagline in the [official header SVG](https://www.ana.co.jp/common-layout2/images/www2/logo_ana_tagline.svg); the narrow accent stripe is a different blue. |
| United (UA) | `#0C2340` | Exact `#wd_header_blue` background in [official newsroom CSS](https://united.mediaroom.com/css/wdcontent.css), paired with its linked white logo. Official header navy, not a formal primary or dominant-livery specification. |
| Wizz Air (W6) | `#C6007E` | Exact magenta primary-button declarations on the [official homepage](https://wizzair.com/en-gb), confirming the retained value separately from the corporate gradient logo. The small 92×41 logo stays at source resolution; sparse antialias pixels were not treated as a palette specification. |

No browser, screenshot or layout inspection was performed during this follow-up, at the user's request. Source checks used text, SVG declarations, PDF text and programmatic asset decoding.

Technical verification passed: Next/OpenNext build, app and Worker typechecks, the 20 focused Journal/Rankings tests, and the composed-Worker smoke including local PNG transport and access boundaries. All 118 compiled PNG assets match their source bytes. The full browser navigation suite, which includes visual geometry checks, was deferred under the user's instruction.
