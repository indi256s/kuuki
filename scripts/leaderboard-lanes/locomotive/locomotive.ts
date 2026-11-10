// Build-time locomotive artwork. Shares the airliner's pinned anatomy kit, material ramps and SVG serializer, and the
// car's way of deriving its camera from the lane scene, so the rails, wheel contacts and scale of the lane are kept.
import type { Draw } from '../airliner/draw'
import { loadKit } from '../airliner/kit'
import { laneCamera } from '../lane-camera'
import type { Item } from '../airliner/model'
import { serialize } from '../airliner/svg'
import { HW, LENGTH, RAIL, BOGIES, at } from './model'
import { bogie } from './bogie'
import { cabFront, cabSide, end, flankDetails, shell, underframe } from './body'
import { makeCtx } from './parts'
import { roof } from './roof'

export function locomotive(d: Draw): Item[] {
  const c = makeCtx(d)
  // Ground shadow.
  c.fill(
    [
      at(0.3, -HW + 0.2, 0.01),
      at(LENGTH - 0.3, -HW + 0.2, 0.01),
      at(LENGTH - 0.3, HW + 0.3, 0.01),
      at(0.3, HW + 0.3, 0.01),
    ],
    'shadow',
  )
  // Far to near: far bogies, the underframe, near bogies, the tail end (behind the shell), the shell and everything
  // drawn on it, the nose end (in front of it), the roof.
  for (const b of BOGIES) bogie(c, b, -1)
  underframe(c)
  for (const b of BOGIES) bogie(c, b, 1)
  end(c, 0)
  shell(c)
  flankDetails(c)
  cabSide(c, 0)
  cabSide(c, 1)
  cabFront(c)
  end(c, 1)
  roof(c)
  return c.out
}

export async function buildLocomotive(unit = 112) {
  const kit = await loadKit()
  // The kit camera is derived from the lane's actual projection (see the car): the rails, the wheel contacts and the
  // scale stay the lane's own.
  const { cam, draw, place } = laneCamera(kit, unit / LENGTH)
  const items = locomotive(draw)
  const built = serialize(items, place, 1)
  return {
    ...built,
    d: { key: 'rail', title: 'An electric locomotive' },
    gear: place(cam.project([0, RAIL + 0.08, 0]))[1],
    rail: { near: place(cam.project([0, RAIL, 0]))[1], far: place(cam.project([0, -RAIL, 0]))[1] },
  }
}
