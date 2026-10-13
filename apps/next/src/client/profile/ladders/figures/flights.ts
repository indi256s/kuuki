import { Scene } from '../../../overview/iso/scene'
import type { LadderFigureDef } from './types'

/** Placeholder: a plinth whose lit block grows by rung. Replaced by the real object (see .scratch/achievements-redesign/code-spec.md). */
export const flights: LadderFigureDef = {
  id: 'flights',
  rungs: 5,
  build(k, { rung }) {
    const s = new Scene(k)
    s.box(0, 0, 0, 40, 40, 4)
    s.group('lit', () =>
      s.lit([
        [10, 10, 4 + rung * 4],
        [30, 10, 4 + rung * 4],
        [30, 30, 4 + rung * 4],
        [10, 30, 4 + rung * 4],
      ]),
    )
    return s.done()
  },
}
