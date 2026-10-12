# Kuuki Figure Refinements (Round R3) — Review Notes

Design sub-agent pass by Gemini 3.8 Flash (High) refining the three Kuuki figures in Paper on file `01M48F4SHK61AZS2FH5P5JPRY7`, page `p-3-0` ("Sheet anatomy").

---

## 1. Visual & Anatomical Fixes

### Figure 1: Rankings — Sovereign Dual-Champion Trophy
* **Root critique addressed:** Looping handles looked flat; plaque was tiny (~8px print); coral barely registered versus Routes; cup felt thin and hollow.
* **Sculptural Volume & Chalice Rim:** Deepened the turned chalice cup bowl with substantial 3D rim wall thickness (`rx="48" ry="15"` outer lip, `rx="40" ry="11.5"` inner cavity, with a dark recess shadow at `y=17–35`). The bowl features clear lighting separation between `--color-journal-dark-iso-side` (`#2e2c2a`) on the shaded left and `--color-journal-dark-iso-front` (`#363432`) on the front-right, accented with engraved fluting rings.
* **Simplified 3D Bracket Handles:** Eliminated flat wireframe loops. Replaced with solid architectural bracket handles anchored firmly to the chalice lip and waist, featuring distinct top lit edges (`--color-journal-dark-iso-front`), side drop faces (`--color-journal-dark-iso-side`), and 1px line contours.
* **Confident Coral Selected Plaque:** Expanded the front-right plaque to a massive, bold solid coral block (`#ea846f`) measuring 34×34px in isometric projection with corner mounting rivets in dark `#292827`. Typography is rendered in high-contrast dark ink (`#292827`): `CHAMPION` (Commissioner 6.5px bold), `PC` (JetBrains Mono 13px bold), and `PEGASUS · 4` (JetBrains Mono 6px bold), matching the visual weight of Routes' boarding pass stub.
* **Dual-Champion Tie Preservation:** Left plinth face holds an engraved recessed plaque for `QR · 4` (Qatar 4 flights) in muted ink (`#c4beb7`), explicitly honoring the tie without implying podium hierarchy or rank disparity.

### Figure 2: Crossings — Padded Travel Sleep Sanctuary Mask
* **Root critique addressed:** Previous mask read like hollow goggles with concentric eye circles and circular nose mark; earplugs/lanyard/buckle introduced tiny outline clutter.
* **Single Padded Textile Silhouette:** Replaced all goggle eye-hole rings and circular marks with a single, generous ergonomic memory-foam silhouette. Features an 8px thick 3D drop cushion facet along the lower and side edges (`--color-journal-dark-iso-side`) showing physical textile depth.
* **Broad Soft Facets:** Gentle ergonomic chevron quilting and contour seam lines (`#5f5954`) across the top surface (`#403d3a`) provide tactile material cues without facial feature imitation.
* **Meaningful Coral Accent Panel:** The right temple wing is tailored with a solid Coral textile panel (`#ea846f`) with shaded drop edge (`#bb6a59`), dark perimeter stitching, and stamped `KUUKI TRANSIT` travel insignia in dark `#292827`. Upper perimeter features a tailored coral edge piping line.
* **Clean Occlusion & Clutter Removal:** Eliminated separate loose earplugs and tangled cord. Wide ribbed elastic headband emerges from under the left temple, loops smoothly across the ground plane behind the mask, and enters the right temple with clean, natural occlusion.
* **Contextual Metaphor Rule:** Sleep/jetlag remains strictly an evocative travel consequence metaphor for crossing timezones. The hero and chart continue to measure 82h total UTC clock shifts (+39 forward / -43 back) across 7 of 24 hourly offsets. No invented sleep loss, medical, or physiological data.

### Figure 3: Aircraft / Makers — Airframe Builder's Data Plate
* **Root critique addressed:** Wireframe model repeated rejected pedestal concept; needed a fresh, tactile physical object associated with aircraft making matching Routes' quality, causally linked to Airbus 59% chart selection without fake type counts or fabricated math.
* **Fresh Tactile Physical Object:** Crafted an authentic, heavy aerospace-alloy **Airframe Builder's Data Plate** (the legal, physical manufacturer identity plate riveted to every airliner at the assembly plant).
* **Machined Material & Layered Geometry:** 30° isometric alloy slab with a 10px beveled drop edge (`--color-journal-dark-iso-side` and `--color-journal-dark-iso-front`), 4 precision counter-bored hex-socket cap screws / rivets at the corners, and an engraved perimeter channel.
* **Readable Manufacturer Typography:** Recessed dark header window with bold, clean, letterspaced `AIRBUS` (Commissioner 800, 16px) and `AIRCRAFT DATA PLATE` (JetBrains Mono). Left half contains technical specification grid lines and stamped airframe serial rows (`AIRFRAME ID: F-WW`, `FACILITY: TOULOUSE`, `SERIES: A320/A350`).
* **Confident Coral Selected Acceptance Plate:** Right half features a large, bold solid coral acceptance plate (`#ea846f`) measuring 72×40px in isometric projection with corner rivets, circular manufacturer inspection seal (`AIRBUS ACCEPTANCE`), and `DELIVERED · 59%` in dark ink (`#292827`), directly grounding the chart's 59% selection without claiming arbitrary geometric proportions.

---

## 2. Interaction & Idle Contracts

* **Idle State:** Completely static at rest. No idle spin, float, glow pulsation, or parallax. The physical geometry carries the quality independently.
* **Tap Interaction (Proposed):**
  * *Rankings:* Tapping the trophy or plaque highlights/selects Pegasus in the ranking table; tapping Qatar would switch the active coral plaque to QR while keeping the same physical plinth.
  * *Crossings:* Pure grounding anchor; tapping the mask has no interaction (chart columns own offset filtering).
  * *Makers:* Tapping the builder plate toggles manufacturer view; selecting Boeing in the chart would swap the plate's stamped nameplate to Boeing without redrawing the frame.

---

## 3. Node Inventory & File Paths

| Artwork | Artboard | Node ID | Stage Coordinates | Native SVG File | Study PNG | Full Sheet PNG |
|---|---|---|---|---|---|---|
| **Rankings Trophy** | Study | `R1P-0` | (6000, 0) | `rankings-trophy-gemini.svg` | `rankings-gemini-study.png` | — |
| **Rankings Trophy** | Full Sheet | `RB0-0` (child `RTQ-0`) | (6000, 240) | — | — | `rankings-gemini-sheet.png` |
| **Crossings Sleep Mask** | Study | `RFN-0` | (6500, 0) | `crossings-sleepkit-gemini.svg` | `crossings-gemini-study.png` | — |
| **Crossings Sleep Mask** | Full Sheet | `RGI-0` (child `RVK-0`) | (6500, 240) | — | — | `crossings-gemini-sheet.png` |
| **Makers Builder Plate** | Study | `RLU-0` | (7000, 0) | `makers-aerosting-gemini.svg` | `makers-gemini-study.png` | — |
| **Makers Builder Plate** | Full Sheet | `RN0-0` (child `RX8-0`) | (7000, 240) | — | — | `makers-gemini-sheet.png` |

---

## 4. Residual Limits

* Rendered inside 300×160 native bounding boxes on Paper page `p-3-0` Sheet anatomy.
* Working indicators on all six artboards were released with `finish_working_on_nodes`.
* Main sheets (`NBN-0`, `NQV-0`, `O6L-0`), storyboard, and template were strictly preserved without modification.
* No application code, configuration edits, servers, or deployments were performed.
