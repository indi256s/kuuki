import { describe, expect, it } from 'vitest'
import type { IsoNode } from '../../../overview/iso/scene'
import { LADDER_FIGURES } from './index'
import type { LadderLod } from './types'

const ACCENT = new Set(['accent', 'accent-side', 'accent-plate', 'on-accent'])

type Walk = { lit: number; strayAccent: number; texts: string[]; size: number }
function walk(
  nodes: readonly IsoNode[],
  inLit = false,
  out: Walk = { lit: 0, strayAccent: 0, texts: [], size: 0 },
) {
  for (const node of nodes) {
    out.size++
    if (node.kind === 'group') {
      if (node.part === 'lit') out.lit++
      walk(node.children, inLit || node.part === 'lit', out)
    } else if (node.kind === 'glow') walk(node.children, inLit, out)
    else {
      if (node.kind === 'text') out.texts.push(node.text)
      const paints = node.kind === 'text' ? [node.fill] : [node.fill, node.stroke]
      if (!inLit && paints.some((p) => ACCENT.has(p))) out.strayAccent++
    }
  }
  return out
}

const LODS: LadderLod[] = ['hero', 'thumb']

describe.each(Object.values(LADDER_FIGURES))('$id ladder figure', ({ id, rungs, build }) => {
  it('lights exactly one part per rung, draws no stray accent and no text, and is deterministic', () => {
    for (const lod of LODS)
      for (let rung = 1; rung <= rungs; rung++) {
        const fig = build(1, { rung, lod })
        const w = walk(fig.nodes)
        expect({ id, lod, rung, lit: w.lit, stray: w.strayAccent, texts: w.texts }).toEqual({
          id,
          lod,
          rung,
          lit: 1,
          stray: 0,
          texts: [],
        })
        expect(build(1, { rung, lod })).toEqual(fig)
      }
  })

  it('draws every rung differently, and the thumb no denser than the hero', () => {
    for (const lod of LODS) {
      const drawn = Array.from({ length: rungs }, (_, i) =>
        JSON.stringify(build(1, { rung: i + 1, lod }).nodes),
      )
      expect(new Set(drawn).size).toBe(rungs)
    }
    for (let rung = 1; rung <= rungs; rung++)
      expect(walk(build(1, { rung, lod: 'thumb' }).nodes).size).toBeLessThanOrEqual(
        walk(build(1, { rung, lod: 'hero' }).nodes).size,
      )
  })
})

describe('flights initials', () => {
  it('paints the initials on the top rung only', () => {
    const { build, rungs } = LADDER_FIGURES.flights
    expect(walk(build(1, { rung: rungs, lod: 'hero', initials: 'AK' }).nodes).texts).toEqual(['AK'])
    expect(walk(build(1, { rung: rungs - 1, lod: 'hero', initials: 'AK' }).nodes).texts).toEqual([])
  })
})
