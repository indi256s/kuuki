// Motion keyframes for the chosen figures (board "15 Motion"). Every frame reuses its rest pose's scale and viewBox,
// so frames overlay exactly and the motion is only what changed between them.
import { fitBox, type IsoFigureData } from '../../apps/next/src/client/overview/iso/scene'
import { FIG_W, FIG_H } from './figures'
import { stamper, type StampOpts } from './figures2'
import { hangars2 } from './figures3'
import { puzzle, type PuzzleOpts } from './figures4'

/** Frames of one figure, all at the rest pose's k and in its box. */
function frames<O>(build: (k: number, o?: O) => IsoFigureData, keys: Record<string, O>) {
  const k = Math.min(1.8, fitBox(FIG_W, FIG_H, (kk) => build(kk)))
  const rest = build(k)
  return Object.fromEntries(Object.entries(keys).map(([key, o]) => [key, () => {
    const fig = build(k, o)
    return { ...fig, viewBox: rest.viewBox, width: rest.width, height: rest.height }
  }]))
}

export const figures: Record<string, () => IsoFigureData> = {
  // Rhythm: pick October. The band rolls, the head presses, the impression is re-inked.
  ...frames<StampOpts>(stamper, {
    'kf-rhythm-0-rest': {},
    'kf-rhythm-1-roll': { month: 9, flights: 6, printed: [2, 11] },
    'kf-rhythm-2-press': { month: 9, flights: 6, ink: 0, press: 3 },
    'kf-rhythm-3-set': { month: 9, flights: 6 },
  }),
  // Continents: pick Asia. Its piece lifts out of the tray, takes the coral, and is pressed back in.
  ...frames<PuzzleOpts>(puzzle, {
    'kf-continents-0-rest': {},
    'kf-continents-1-lift': { lit: 'asia', lift: 5 },
    'kf-continents-2-set': { lit: 'asia' },
    'kf-continents-3-empty': { lit: 'none' as never, socket: 'oceania' },
  }),
  // Aircraft: pick Boeing. Lighting only: the coral door, name and stand marking move to its hangar.
  ...frames<string>(hangars2, {
    'kf-aircraft-0-rest': 'AIRBUS',
    'kf-aircraft-1-boeing': 'BOEING',
  }),
  // Aircraft empty state: no aircraft known, so no door is lit and the stands read "—".
  ...frames<boolean>((k, blank) => hangars2(k, 'NONE', blank ?? false), {
    'kf-aircraft-2-empty': true,
  }),
}
