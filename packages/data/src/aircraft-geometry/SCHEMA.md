# Aircraft reference geometry schema (v1)

There is one JSON file per family group in this folder. Each file is an array of type records. All lengths are in metres and all angles in degrees.

**Coordinates.** `x` is measured aft from the nose tip (nose = 0, tail end = `length`). `y` is measured outward from the centreline. `z` is measured up from the fuselage bottom at the constant section.

Every value must come from a primary source:

- a manufacturer Airport Planning or Aircraft Characteristics document;
- a manufacturer spec page;
- or a measurement on a manufacturer three-view, scaled by a published dimension.

When you measure off a drawing, add the field name to `estimated` and note the drawing in `sources`. Never invent a value. If you can't find one, leave it `null` and list it in `gaps`.

```jsonc
{
  "icao": "B38M",
  "name": "Boeing 737 MAX 8",
  "family": "737",
  "reference": {
    // the one documented configuration this drawing represents
    "engine": "CFM LEAP-1B",
    "wingtip": "Advanced Technology winglet",
    "notes": "why this configuration",
  },
  "dims": { "length": 0, "span": 0, "height": 0, "fuselageWidth": 0, "fuselageHeight": 0 },
  "fuselage": {
    "noseLength": 0, // nose tip to the start of the constant section
    "tailconeLength": 0, // start of the tail taper to the tail end
    "tailUpsweep": 0, // how far the tail-cone end sits above the fuselage centreline, in m
    "cockpitWindowX": 0, // x of the aft edge of the cockpit glazing
    "decks": 1, // 2 = full-length upper deck (A380)
  },
  "wing": {
    "position": "low", // low | high
    "rootLEx": 0, // x of the leading edge at the side of the body
    "rootChord": 0, // chord at the side of the body
    "kinkY": 0, // y of the trailing-edge kink (Yehudi); null if none
    "tipChord": 0,
    "sweepLE": 0, // outboard leading-edge sweep
    "dihedral": 0,
  },
  "wingtip": {
    "type": "none", // none | fence | sharklet | blended | raked | at-winglet | curved
    "height": 0, // vertical extent above the wing tip (0 for none or raked)
    "below": 0, // lower-blade extent below the tip (fence, at-winglet), 0 if none
    "cant": 0, // outward lean from vertical, in degrees
    "rakeSpan": 0, // raked: spanwise length of the raked section
  },
  "htail": {
    "position": "fuselage", // fuselage | t-tail
    "rootLEx": 0,
    "span": 0,
    "rootChord": 0,
    "tipChord": 0,
    "sweepLE": 0,
    "dihedral": 0,
  },
  "vtail": {
    "rootLEx": 0, // x of the fin leading edge where it meets the fuselage
    "height": 0, // fin height above the fuselage crown
    "rootChord": 0,
    "tipChord": 0,
    "sweepLE": 0,
    "dorsalFin": false,
  },
  "engines": [
    // one entry per engine on ONE side (mirrored)
    {
      "y": 0, // centreline of the nacelle
      "fanX": 0, // x of the intake face
      "nacelleDiameter": 0, // max nacelle diameter (not fan diameter)
      "nacelleLength": 0,
      "dropBelowWing": 0, // nacelle centre below the wing lower surface, in m
      "section": "round", // round | flat-bottom
      "chevrons": false,
      "prop": null, // turboprop: { "diameter": 0 }
    },
  ],
  "sources": [{ "url": "", "doc": "", "page": "" }],
  "estimated": [], // field paths measured off drawings
  "gaps": [], // field paths left null
}
```

## Optional extensions

- `fuselage.end`: x of the fuselage tail end, when it differs from `dims.length`. Boeing ACAP lengths run to the stabiliser tip. Default: `dims.length`.
- `fuselage.mainDeckWindowZ`, `fuselage.upperDeckWindowZ`: window-row heights above the fuselage bottom (A380).
- `wingtip.rootY`: semi-span at the blade root, when documented or measured (A20N/A21N: 16.29 m; A359/A35K: `span/2 - 2.88`, the AC plan's 2.88 m planform reach of the curved device). The wing ends there and the device leans the remainder outward, so the device reaches exactly `span/2`. Without it the root is `span/2 - max blade lean` (`height*tan(cant)`, or the lower blade's lean for `at-winglet`), which understates the reach of a curved tip. `dims.span` is always the overall width including the device lean.
- `wing.leBreakY`, `wing.sweepLEInboard`: y of an inboard leading-edge break (Yehudi) and the leading-edge sweep from the body side up to it. `sweepLE` then applies outboard of the break. Both absent: one straight edge.
- `wingtip.rakeLE`, `wingtip.rakeTE` (raked tips): measured vertices of the raked tip as `[{x, y}]`, x aft from the nose (geometry convention, converted by `X = L - x`), y outward, ordered inboard to the tip, the last vertex at `y = span/2`. `rakeLE[0]` is where the leading edge leaves its straight sweep line (so `wing.sweepLE` and `wing.rootLEx` must reach it); `rakeTE[0]` is the trailing-edge rake break, and the trailing edge runs straight from the kink to it. Both lists are measured off the manufacturer plan view, with the documented tip LE/TE x (ACAP "tip LE x / tip TE x" labels) kept as exact vertices where they exist. The 787-8 tip is pointed (both lists end at the same corner), the 777-300ER tip has a short flat. When present they replace `rakeSpan`, `rakeSweepLE` and the tip-chord straight edge; `rakeSpan` is then informational (`span/2 - rakeLE[0].y`) and `wing.tipChord` is the chord at the very tip.
- `wingtip.rakeSweepLE`: leading-edge sweep of a raked tip that has no `rakeLE` list (from `half - rakeSpan` to the tip). Absent: `sweepLE + 20` (unverified default). Superseded by `rakeLE` wherever measured vertices exist.
- `htail.zBelowFinTop`: T-tail only. How far the stabiliser sits below the fin top, in m (DH8B 0.25).
- `htail.rootY`: the span station y where the measured `rootLEx` / `rootChord` apply (the fuselage side at the stabiliser root, read off the plan view; 0 for a T-tail whose stabiliser meets the fin on the centreline). The leading edge sweeps from `(rootLEx, rootY)` to the tip, so `sweepLE` is fitted, not free: `sweepLE = atan((tipLEx - rootLEx) / (span/2 - rootY))` with `tipTEx = tipLEx + tipChord`. Dihedral runs over `span/2 - rootY`. Absent: the old station `0.8 x modelled body radius`. If the modelled body is narrower than `rootY`, the drawn root starts at the body surface and the leading edge and chord extend inboard.
- `htail.tipLEx`, `htail.tipTEx`: stabiliser tip leading / trailing edge x (aft from the nose) at `span/2`, the anchors the sweep is fitted to. Documented where the manufacturer plan labels them (A330 AC p.61/64, A350 AC p.51/53 with overall length at the stabiliser tip, A380 AC p.35, Boeing ACAP overall length = stabiliser tip TE for the 737/777/787); otherwise measured on the plan view (straight leading edge extrapolated to the tip, `estimated`). `check-geometry.mjs` renders each type and requires the drawn tip LE/TE within +/-0.3 m of them. The drawn tip trailing edge is kept inside `dims.length` (clamped to `length - 0.01`), so an anchor beyond `length` by a hundredth is not an error.
- Stabiliser sweep and dihedral run over the exposed semispan `span/2 - rootY`. Overall `dims.length` must contain the stabiliser tip trailing edge.
- `vtail.rootLEx`/`rootChord` describe the fin proper at the crown (the fin leading edge extended down to the crown, not where the dorsal fillet starts). `vtail.dorsalLength` (fillet start ahead of the fin LE, m) and `vtail.dorsalHeight` (height of the fillet break above the crown, on the fin leading edge line, m) size the fillet drawn when `dorsalFin` is true. Both are measured from the side view and there are no defaults: `dorsalFin: true` without both numbers draws no fillet, and a fillet that can't be measured gets `dorsalFin: false`.
- `engines[].exhaustLength`: nozzle and plug length behind the cowl end (`nacelleLength`), drawn as a narrower aft cone. Underwing jets always get a pylon, clamped to the wing chord.
- `engines[].dropBelowWing` is measured from the wing's lower surface (drawn wing thickness is subtracted).
- `engines[].chevrons`: drawn only as a separate zig-zag line on the exhaust ring: axial notches at a constant ring radius (`0.3*d`), 13 vertices over the visible half, tooth depth `0.06*d` along x. A tooth of depth `dd` metres projects to exactly `dd*k` px, so the gate is the real depth: drawn only when `0.06*d*k >= 1` (off at k = 2.6 for every catalog type).
- `fuselage.noseExponent`: nose superellipse exponent (default 2.4). Lower is more pointed.
- `fuselage.tailEnd`: `cone` (default) or `blade`. A blade flattens the section width, not height, over the last 55% of the taper.
- `fuselage.cockpit`: `{ aftX, foreX, lowDeg, highDeg }`, glazing aft/forward edge x (from the nose) and the section angles of its lower/upper edge at the aft edge (the forward edge is 4 deg lower). Defaults: `cockpitWindowX`, 1.2 m ahead, 30 to 46 deg.
