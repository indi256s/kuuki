// Sheet-anatomy figures: every figure fitted to one stage box (FIG_W × FIG_H) by k, so strokes stay 1px.
import { fitBox, type IsoFigureData } from '../../apps/next/src/client/overview/iso/scene'
import { foldedMap, type MapPin } from '../../apps/next/src/client/overview/iso/map'
import { calendar } from '../../apps/next/src/client/overview/iso/calendar'
import { flapBoard } from '../../apps/next/src/client/overview/iso/board'
import { passStack } from '../../apps/next/src/client/overview/iso/passes'
import { globe } from '../../apps/next/src/client/overview/iso/globe'
import { uldTrain, uldSlots } from '../../apps/next/src/client/overview/iso/uld'
import { clock } from '../../apps/next/src/client/overview/iso/clock'

const FIG_W = 300, FIG_H = 160
const fit = (build: (k: number) => IsoFigureData) => () => build(Math.min(1.8, fitBox(FIG_W, FIG_H, build)))
const DOH: MapPin = { code: 'DOH', lat: 25.27, lon: 51.61 }, NRT: MapPin = { code: 'NRT', lat: 35.76, lon: 140.39 }
const MONTHS = [6, 2, 11, 6, 3, 2, 5, 0, 5, 6, 4, 7]
const OFFS = [3, 4, 2, 0, 5, 9, 1]
const SLOTS = uldSlots([{ key: 'airbus', flights: 59 }, { key: 'boeing', flights: 31 }, { key: 'other', flights: 10 }])

export const figures: Record<string, () => IsoFigureData> = {
  'clock-0020': fit((k) => clock('00:20', k)),
  'clock-2100': fit((k) => clock('21:00', k)),
  'cal-march': fit((k) => calendar(MONTHS, 3, 'March', k)),
  'board': fit((k) => flapBoard([{ code: 'PC', share: 1 }, { code: 'QR', share: 1 }, { code: '3F', share: 0.75 }], k)),
  'pass': fit((k) => passStack(0.74, 'ROV ↔ VKO', k)),
  'globe': fit((k) => globe(OFFS, { equator: true }, k)),
  'uld': fit((k) => uldTrain(SLOTS, k)),
  'map-doh-nrt': fit((k) => foldedMap(DOH, NRT, k)),
}
