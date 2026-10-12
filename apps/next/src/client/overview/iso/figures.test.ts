import { describe, expect, it } from 'vitest'
import { gateSign } from './gate-sign'
import { hangars, shedSize } from './hangars'
import { CONTINENT_IDS, puzzle, type ContinentId } from './puzzle'
import type { IsoNode } from './scene'
import { stamper } from './stamper'

const parts = (nodes: readonly IsoNode[], out: string[] = []): string[] => {
  for (const node of nodes) {
    if (node.kind === 'group') out.push(node.part)
    if (node.kind === 'group' || node.kind === 'glow') parts(node.children, out)
  }
  return out
}

describe('hangars', () => {
  it('sizes the sheds by share, and draws the approved split at the approved sizes', () => {
    const [airbus, boeing, other] = [0.59, 0.31, 0.1].map(shedSize)
    expect([airbus.w, boeing.w, other.w]).toEqual([60, 44, 24])
    expect(airbus.h).toBeGreaterThan(boeing.h)
    expect(boeing.h).toBeGreaterThan(other.h)
  })

  it('keeps the geometry when the light moves', () => {
    const sheds = [
      { key: 'airbus', name: 'AIRBUS', share: 0.6 },
      { key: 'boeing', name: 'BOEING', share: 0.4 },
    ]
    const draw = (lit: string | null) =>
      hangars(1, { sheds, lit, shareLabel: (share) => `${share * 100}%` })
    const a = draw('airbus'),
      b = draw(null)
    expect(parts(a.nodes)).toEqual(parts(b.nodes))
    expect(a.viewBox).toBe(b.viewBox)
  })
})

describe('puzzle', () => {
  const flown = Object.fromEntries(
    CONTINENT_IDS.map((id) => [id, id !== 'oceania' && id !== 'antarctica']),
  ) as Record<ContinentId, boolean>

  it('draws the lit piece last', () => {
    const fig = puzzle(1, { flown, lit: 'north-america', label: '5 OF 7 PIECES' })
    const groups = fig.nodes.filter((n) => n.kind === 'group').map((n) => n.part)
    expect(groups.at(-1)).toBe('piece-north-america')
    expect(groups).toContain('socket-north-america')
    expect(groups).toContain('piece-oceania')
  })
})

describe('stamper', () => {
  it('exposes the band, the head and the impression as parts', () => {
    const fig = stamper(1, {
      month: 2,
      flights: 11,
      monthLabel: 'MAR',
      flightsLabel: '11 FLIGHTS',
    })
    expect(parts(fig.nodes)).toEqual(expect.arrayContaining(['band', 'head', 'impression']))
  })
})

describe('gateSign', () => {
  it('puts the code on the sign part', () => {
    const sign = gateSign(1, { code: 'ROV–VKO' }).nodes.find(
      (node) => node.kind === 'group' && node.part === 'sign',
    )
    expect(sign?.kind === 'group' && sign.children).toContainEqual(
      expect.objectContaining({ kind: 'text', text: 'ROV–VKO' }),
    )
  })
})
