// @vitest-environment jsdom
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gateSign } from './gate-sign'
import { hangars, shedSize } from './hangars'
import { passStack } from './passes'
import { CONTINENT_IDS, puzzle, type ContinentId } from './puzzle'
import { fitBox, type IsoNode } from './scene'
import { IsoFigure } from './iso-figure'
import { stamper } from './stamper'
import { bladeLength, tape } from './tape'

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

  it('draws small shares to scale down to a floor, and marks the floor as "<N%"', () => {
    expect(shedSize(0.02).w).toBeLessThan(14)
    expect(shedSize(0.02).floor).toBe(false)
    expect(shedSize(0.003)).toMatchObject({ w: 6, floor: true })
    const texts = (nodes: readonly IsoNode[], out: string[] = []): string[] => {
      for (const n of nodes) {
        if (n.kind === 'text') out.push(n.text)
        else if (n.kind === 'group' || n.kind === 'glow') texts(n.children, out)
      }
      return out
    }
    const fig = hangars(1, {
      sheds: [
        { key: 'airbus', name: 'AIRBUS', share: 0.997 },
        { key: 'other', name: 'OTHER', share: 0.003 },
      ],
      lit: null,
      shareLabel: (share) => `${Math.round(share * 100)}%`,
    })
    expect(texts(fig.nodes)).toContain('<1%')
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

describe('tape', () => {
  it('pays the blade out by distance and keeps the figure box whatever it is', () => {
    expect(bladeLength(2_000)).toBeLessThan(bladeLength(141_204))
    expect(bladeLength(141_204)).toBeLessThan(bladeLength(400_000))
    expect(bladeLength(0)).toBe(bladeLength(1_000))
    expect(bladeLength(5_000_000)).toBe(bladeLength(1_000_000))
    expect(tape('km', 1, 2_000).viewBox).toBe(tape('km', 1, 400_000).viewBox)
  })
})

describe('passes', () => {
  it('lights the displayed route only when that route repeats', () => {
    const topGlows = (repeat: boolean) => {
      const top = passStack(0.5, 'ROV ↔ VKO', 1, repeat).nodes.find(
        (node) => node.kind === 'group' && node.part === 'top-pass',
      )
      return top?.kind === 'group' ? top.children.filter((node) => node.kind === 'glow').length : 0
    }
    expect(topGlows(false)).toBe(0)
    expect(topGlows(true)).toBe(1)
  })
})

describe('puzzle weight', () => {
  it('stays well under 600 polygons with every piece raised and one lifted', () => {
    const all = Object.fromEntries(CONTINENT_IDS.map((id) => [id, true])) as Record<
      ContinentId,
      boolean
    >
    const count = (nodes: readonly IsoNode[]): number =>
      nodes.reduce(
        (n, node) =>
          n +
          (node.kind === 'polygon'
            ? 1
            : node.kind === 'group' || node.kind === 'glow'
              ? count(node.children)
              : 0),
        0,
      )
    expect(
      count(puzzle(1, { flown: all, lit: 'asia', label: '7 OF 7 PIECES' }).nodes),
    ).toBeLessThan(520)
  })
})

describe('tile figure sizing', () => {
  it('fits the rendered object to the tile while preserving its feathered shadow', () => {
    const build = (k: number) => passStack(0.5, 'ROV ↔ VKO', k)
    const figure = build(fitBox(137, 112, build))
    const { container } = render(createElement(IsoFigure, { figure }))
    const svg = container.querySelector('svg')!
    expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(137)
    expect(Number(svg.getAttribute('height'))).toBeLessThanOrEqual(112)
    const shadow = svg.querySelector('polygon[filter]')!
    const filterId = shadow.getAttribute('filter')!.slice(5, -1)
    const filter = document.getElementById(filterId)!
    const x = Number(filter.getAttribute('x'))
    const y = Number(filter.getAttribute('y'))
    const right = x + Number(filter.getAttribute('width'))
    const bottom = y + Number(filter.getAttribute('height'))
    const reach = 2 * Number(filter.querySelector('feGaussianBlur')!.getAttribute('stdDeviation'))
    for (const point of shadow.getAttribute('points')!.split(' ')) {
      const [px, py] = point.split(',').map(Number)
      expect(x).toBeLessThanOrEqual(px - reach)
      expect(y).toBeLessThanOrEqual(py - reach)
      expect(right).toBeGreaterThanOrEqual(px + reach)
      expect(bottom).toBeGreaterThanOrEqual(py + reach)
    }
    const [vx, , vw] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    expect(right).toBeGreaterThan(vx + vw)
  })
})
