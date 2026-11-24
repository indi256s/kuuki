import { Scene, type P3, type Pt } from '../../../overview/iso/scene'
import { D2R } from '../../../profile/ladders/figures/parts'

export const PHI = 28 * D2R
export const EL = 30 * D2R

const CP = Math.cos(PHI),
  SP = Math.sin(PHI)
const ISO_EL = Math.atan(Math.SQRT1_2)
const DEPTH = Math.sin(EL) / Math.sin(ISO_EL)
const RISE = Math.cos(EL) / Math.cos(ISO_EL)

export const W = ([x, y, z]: P3): P3 => [CP * x + SP * y, CP * y - SP * x, z]

const squash = (x: number, y: number, z: number): P3 => {
  const d = ((x + y) / 2) * (DEPTH - 1)
  return [x + d, y + d, z * RISE]
}

export class LaneScene extends Scene {
  P(x: number, y: number, z: number): Pt {
    const [a, b, c] = squash(x, y, z)
    return super.P(a, b, c)
  }
  project(p: P3): Pt {
    return super.project(squash(p[0], p[1], p[2]))
  }
  slope(): number {
    const [x0, y0] = this.project(W([0, 0, 0]))
    const [x1, y1] = this.project(W([1, 0, 0]))
    return (y1 - y0) / (x1 - x0)
  }
}
