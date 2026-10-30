# Leaderboard lane generation

Two families of lane vehicles, one camera: 30° down, turned 28° off the beam
towards the nose, then a shear that levels each vehicle's length along its lane.

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
- Ground vehicles: `apps/next/src/client/leaderboard/lanes/draw/ground.ts`, the
  locomotive (Trains) and the 993-type coupé (Cars), with the app's own iso
  `Scene` and the ladder figures' parts through `draw/lane-scene.ts`.

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
the `<use>` clone; the airliners' ramps (`--a*`) are in
`vehicles.generated.css`, and the accent is the member's livery
(`--lane-livery`). Estimated in the drawing, not in the data: belly height,
nose shape between measured stations, airfoil thickness, wheel track and tyre
sizes, gear stations, door, exit and window stations, inlet internals, flap-track
fairing and antenna stations.
