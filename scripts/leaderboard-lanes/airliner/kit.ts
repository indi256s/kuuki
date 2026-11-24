import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
// @ts-expect-error The verifier is plain ESM without types.
import { verifiedAnatomyKit } from '../../concorde/verify-kit.mjs'
import type { Camera, Pt, V3 } from './surface'

export const AZIMUTH = 62
export const ELEVATION = 30
const BANDS = [0, 0.2, 0.42, 0.62] as const

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Kit = { k: any; G: any; cam: Camera; P: any; slope: number }

export async function loadKit(): Promise<Kit> {
  const dir: string = verifiedAnatomyKit()
  const k = await import(pathToFileURL(join(dir, 'iso-kit.mjs')).href)
  const G = await import(pathToFileURL(join(dir, 'lathe.mjs')).href)
  const P = { origin: [0, 0], scale: 1 / Math.sqrt(1.6), azimuth: AZIMUTH, elevation: ELEVATION }
  for (const s of [-0.5, 0, 0.1, 0.2, 0.3, 0.42, 0.5, 0.62, 0.9])
    if (G.bandOf(s) !== BANDS.filter((b) => s >= b).length)
      throw new Error('lane airliner: the kit band thresholds changed')
  const cam: Camera = {
    project: (p: V3) => k.iso(p, P) as Pt,
    V: G.viewOf(P) as V3,
    L: G.lightOf(P) as V3,
    bands: BANDS,
  }
  const a = (AZIMUTH * Math.PI) / 180,
    e = (ELEVATION * Math.PI) / 180
  const slope = (Math.cos(a) * Math.sin(e)) / Math.sin(a)
  return { k, G, cam, P, slope }
}
