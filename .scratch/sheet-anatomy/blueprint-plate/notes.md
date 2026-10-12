# Blueprint plate

Paper file: 01M48F4SHK61AZS2FH5P5JPRY7, page p-3-0 (Sheet anatomy).

## Nodes

- QJX-0: Blueprint plate — A320neo study, 420 × 280 at (500, 3000).
- QRB-0: native 300 × 160 figure group, inside the study.
- QRC-0: exported plate SVG.
- QJY-0: Blueprint plate — Aircraft sheet, 390 × 844 at (500, 3360).
- QL3-0: native figure group in the sheet, at (45, 209).
- QRV-0: plate SVG in the sheet.
- QWH-0: selected A320neo Fleet row.

## Aircraft and sources

Explicit variant: Airbus A320neo with Sharklets.

- Airbus product specification confirms overall length 37.57 m and geometric wingspan 35.80 m: https://www.aircraft.airbus.com/en/aircraft/a320-family/a320neo
- Airbus A320 Aircraft Characteristics, March 2022 revision, section 2-2-0, page 7 (PDF page 49): https://aircraft.airbus.com/sites/g/files/jlcbta126/files/2023-02/Airbus-techdata-AC_A320_0322.pdf
- Current accessible May 2023 document gives the same dimensions in section 2-2-0 pages 6–7: https://www.airbus.com/sites/g/files/jlcbta136/files/2023-05/Airbus-techdata-AC-A320_0523.pdf

The outline is a simplified plan-view drawing made from the manufacturer reference. Length is 132 px; geometric span is 125.8 px, maintaining the verified 35.80 / 37.57 proportion. Large nacelles, swept wings, Sharklet tips, and horizontal tail remain visible. No generic isometric pedestal is used. Both dimension values are 13 px JetBrains Mono, label text is 13–14 px Commissioner.

## Data semantics

Airbus 59% is the supplied maker-share headline. No personal model, maker coverage, or flight count has been fabricated. The displayed A320neo, 737 MAX 8, and 787-9 roster is explicitly illustrative. The Boeing variants are labels only, with no dimension or performance claims. A production roster must come from the actual saved aircraft evidence.

## Idle and tap

At rest, the diagram is still. There is no spin, glow, pulse, parallax, or automatic type switching. These snapshots show the selected A320neo state.

From Makers, tapping the A320neo silhouette enters Fleet and selects the matching A320neo row. In Fleet, tapping a model row selects that aircraft type, updates the drawing and its dimensions, and brings the row into view. The selection changes exploration state only: it does not create a flight or imply a personal count. Tapping the current silhouette again is idempotent. Type selection uses stable aircraft keys, not its maker share. Keyboard selection is immediate; a labelled 44 px minimum target accompanies the outline so selection does not require hitting a 1 px stroke.

If implemented later, a row selection may use a short 160 ms opacity change to replace the plate; reduced motion swaps immediately. No simulated interaction is implemented by these Paper nodes.

## Review

Reviewed the figure at native 300 × 160 and sheet at native 390 × 844. Spacing, typography, contrast, alignment, clipping, and repetition pass. Fleet rows use fixed indicator, name, and right-hand metadata slots. Existing source frames and other studies were preserved.

Artifacts: a320neo-plate.svg, a320neo-plate.png, study.png, sheet.png, airbus-top-view.png.

Skipped: application code, browser interaction, tests, deployments, and simulated motion. Risk: this is a static design study with an illustrative roster; actual model availability and type-specific drawings need real journal evidence before implementation.
