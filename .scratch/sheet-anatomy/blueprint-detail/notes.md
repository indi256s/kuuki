# Blueprint + detail

Proposed Paper study only; no app implementation or journal data assertion.

Paper file: 01M48F4SHK61AZS2FH5P5JPRY7, page p-3-0 (Sheet anatomy).
Study: QNW-0 at 1000,3000, 420×300.
Sheet: QGJ-0 at 1000,3360, 390×844.
Sheet figure: QHO-0 (300×160), SVG QPV-0.
Study figure: QQE-0, SVG QQF-0.
Selected fleet row: QWY-0. Fleet selector: QW8-0.

## Shape and evidence

The illustration shows a simplified A320neo plan view beside an enlarged, upward-curving Sharklet and part of the outer wing. Coral marks the plan-view right tip and the cap of the corresponding enlarged detail. Warm gray faces express tangible curvature without gradients, glow, drop shadows, or a pedestal. The drawing is interpretive, not a scale engineering drawing. No dimensions are displayed.

Primary sources:

- Airbus, A320 Aircraft Characteristics, 15 July 2025: https://aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-07/AC_A320_20250715.pdf — PDF pages 48–49 give front, side and plan views for A320neo. Download retained as airbus-a320-reference.pdf; the two 1000px reference renders are airbus-reference-048.png and airbus-reference-049.png.
- Airbus, Winglets: a tip-top solution for more efficient aircraft: https://www.airbus.com/en/newsroom/news/2017-02-winglets-a-tip-top-solution-for-more-efficient-aircraft — identifies A320-family Sharklets as 2.4m units and standard on A320neo. The broader A330neo detail in this article is not the illustrated variant.
- Boeing, Advanced Technology Winglet for 737 MAX: https://boeing.mediaroom.com/2012-05-02-Boeing-Designs-Advanced-Technology-Winglet-for-737-MAX — identifies the dual-feather winglet concept. UI short label is “Split tip”.
- Boeing, 787 Airport Planning: https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/787_Rev_P.pdf — primary plan-view reference for the unselected 787 choice. No 787 illustration is drawn in this state.

The 59% Airbus share is supplied in the brief. Fleet rows demonstrate aircraft/detail pairings; no personal type counts, unknown totals, or coverage totals are invented. Visible caption says “Illustrative aircraft types”.

## Selection semantics

The Fleet selector uses three 48px rows with fixed 24px indicator, 144px aircraft-name, 132px detail-name and 18px trailing-icon lanes. The selected A320neo row has a flat inset surface, coral dot, coral detail label and check. Selection must update the plan silhouette, focus point, enlarged detail and caption together. The image is a single described figure; illustrative details never imply a type recorded in the user's journal. Makers remains the aggregate view; the shown Fleet detail state carries the known Airbus share as context.

Implementation should use a keyboard-operable single-selection group, keep selected state explicit, retain focus on the row, and provide one concise description of the selected image. The drawing itself is not an extra unlabeled tap target.

## Motion

No idle spin, parallax, drawing reveal or tip pulse. Pointer selection may crossfade the figure in 150ms, using opacity only; row selection and caption change immediately. Keyboard and reduced-motion selection swap immediately. Honor the existing sheet gesture, focus return and close-button behavior. These are design notes, not implemented or tested behavior.

## Assets and review

figure.tokens.svg retains Paper token references. figure.svg is the Paper SVG export. figure.png is the 300×160 actual-size figure. sheet.png is 390×844. study.png is 420×300.

Actual-size Paper screenshot review: clear figure hierarchy and silhouette-to-tip connection; all text fits; rows share alignment lanes; no divider lines were introduced; no clipping. Only the new owned artboards were changed.
