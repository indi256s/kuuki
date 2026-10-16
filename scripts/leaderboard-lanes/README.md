# Leaderboard lane generation

The lane vehicles are drawn with the app's own iso `Scene` and the ladder
figures' parts (`apps/next/src/client/profile/ladders/figures/parts.ts`), so they
share the Overview and achievement figures' tones, line weights and shading. No
external kit is needed.

- `apps/next/src/client/leaderboard/lanes/draw/lane-scene.ts`: the lane camera.
  The Scene's iso view lowered to 30° and turned 28° off the beam, then a shear
  that levels each vehicle's length along its lane.
- `draw/airliner.ts`: one airliner per ICAO type from the measured geometry in
  `packages/data/src/aircraft-geometry/*.json` (fields per its `SCHEMA.md`).
- `draw/ground.ts`: the locomotive (Trains) and the 993-type coupé (Cars).

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

Paints are the Scene's theme roles written as the CSS variables `IsoFigure`
uses; the accent ramp is the member's livery (`--lane-livery`). Estimated in the
drawing, not in the data: belly height, gear stations and wheels, door and
window stations, wing and tail thickness.
