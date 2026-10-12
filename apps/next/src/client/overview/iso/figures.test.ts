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

  it('keeps every part in one order and draws the accent overlays after every rest piece', () => {
    const draw = (lit: ContinentId | null) =>
      puzzle(1, { flown, lit, label: '5 OF 7 PIECES' }).nodes.filter((n) => n.kind === 'group')
    const names = (lit: ContinentId | null) => draw(lit).map((n) => n.part)
    const a = names('north-america'),
      b = names('europe')
    expect(a).toEqual(b)
    expect(a).toContain('socket-north-america')
    expect(a).toContain('piece-oceania')
    expect(a).toContain('lit-oceania')
    expect(Math.min(...a.flatMap((p, i) => (p.startsWith('lit-') ? [i] : [])))).toBeGreaterThan(
      a.lastIndexOf('piece-north-america'),
    )
    expect(names(null).some((p) => p.startsWith('lit-'))).toBe(false)
    const lits = (lit: ContinentId) =>
      draw(lit).flatMap((n) =>
        n.kind === 'group' && n.part.startsWith('lit-') ? [[n.part, n.vars?.['--lit']]] : [],
      )
    expect(lits('north-america').filter(([, on]) => on === '1')).toEqual([
      ['lit-north-america', '1'],
    ])
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
