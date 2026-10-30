# Leaderboard lane generation

Two families of lane vehicles viewed 30° down, then sheared to level their length
along the lane. Air uses the pinned kit's 62° azimuth; ground inherits the rotated
`LaneScene` iso basis (73° azimuth after rotation).

- Airliners: `scripts/leaderboard-lanes/airliner/`, one 1:N model per ICAO type
  from the measured geometry in `packages/data/src/aircraft-geometry/*.json`
  (fields per its `SCHEMA.md`), drawn with the pinned anatomy kit's camera,
  light and five tone bands. `model.ts` defines the record and drawing items;
  `airframe.ts` derives the geometry from the record,
  `wing.ts`, `tail.ts`, `engine.ts`, `gear.ts` and `fuselage.ts` build the parts
  with `draw.ts`'s helpers, `airliner.ts` assembles them far to near,
  `surface.ts` shades the parametric surfaces, `svg.ts` writes them with the
  material ramps, `build.ts` scales every type. The kit is the one the sign-in
  Concorde pins: install it as
  [scripts/concorde/README.md](../concorde/README.md) describes;
  `verify-kit.mjs` checks it before any kit code runs.
- Locomotive: `apps/next/src/client/leaderboard/lanes/draw/ground.ts` (Trains),
  with the app's iso `Scene` and ladder parts through `draw/lane-scene.ts`.
- Car: `scripts/leaderboard-lanes/car/` (Cars), a 993-inspired coupé with open
  wheel arches, curved body and cabin skins, sealed glazing, raised lamps,
  mirrors and detailed five-spoke wheels. The shell stays neutral; member colour
  is limited to the rocker stripe and mirror caps. `model.ts` defines the envelope and
  surfaces; `car.ts` builds with the pinned anatomy kit and the airliner's surface
  renderer, materials and serializer. Its camera is derived from `LaneScene`
  so the existing road projection, tyre contacts and car scale are retained.
  Model envelope: 4.245 × 1.735 × 1.30m and 2.272m wheelbase. Factory length,
  width and wheelbase are supported by the
  [FIA's Porsche 993 homologation form](https://historicdb.fia.com/sites/default/files/car_attachment/1601073601/homologation_form_number_4_group_gt2.pdf).
  Intermediate skin stations, trim and wheel details are illustrative estimates.
  `pnpm exec tsx scripts/leaderboard-lanes/car/preview.ts` writes offline,
  inline previews under `.scratch/car-anatomy/{light,dark}.html`, with a close-up
  and five liveries at desktop and phone sizes.

Run from the workspace root:

```sh
pnpm exec tsx scripts/leaderboard-lanes/scene-art.ts
```

It writes `apps/next/src/client/leaderboard/lanes/` (`art/<KEY>.svg`, one
`<symbol id="lane-KEY">` per vehicle; `vehicles.generated.css`;
`lanes.generated.ts`) and preview pages under `.scratch/leaderboard-lanes/scene/`:
`gallery-{light,dark}.html` (every vehicle at the desktop and phone lane unit)
and `zoom-{light,dark}.html` (`ZOOM="A21N rail …"` picks the 4× close-ups).
`scripts/leaderboard-lanes/shoot-scene.sh <tag>` serves that folder and
screenshots all four pages with `agent-browser`.
`pnpm exec tsx scripts/leaderboard-lanes/airliner/preview.ts [A320 …]` writes
inline airliner pages that open from disk (`ZOOMPX` sets the close-up width).

`lanes.generated.ts` carries each family's `laneGeometry` as fractions of its
shared viewBox: the nose and the ground centreline every vehicle is anchored on
(world y = 0, z = 0), the strip's half-width (`deck`, from the wheel track) and
the across-lane `skew` the strip is slanted by, plus the locomotive's rail
gauge. `laneSpots` holds each airliner's spotter-card data: full name, measured
length and span, its own drawn box and the upper beacon's position.

Paints are the theme's iso roles written as CSS variables, which inherit into
the `<use>` clone; the aircraft and car material ramps (`--a*`) are in
`vehicles.generated.css`, and the accent is the member's livery
(`--lane-livery`). Estimated in the drawing, not in the data: belly height,
nose shape between measured stations, airfoil thickness, wheel track and tyre
sizes, gear stations, door, exit and window stations, inlet internals, flap-track
fairing and antenna stations.
