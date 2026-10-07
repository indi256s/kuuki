// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CountryPreview, previewArcPath } from './preview'

describe('country preview evidence', () => {
  it.each(['en', 'ru'] as const)('keeps awaiting countries unpressed and separate from visited counts in %s', locale => {
    const { container } = render(<CountryPreview locale={locale} period="2026" countryIds={['US']} visits={[{ countryCode: 'US', count: 3 }, { countryCode: 'PT', count: 1, pending: true }]} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(locale === 'en' ? '1 map countries in 2026; 1 waiting for a stamp' : 'Стран на карте за 2026: 1; ждут отметки: 1')
    expect(container.querySelector('[data-country="PT"]')).toHaveAttribute('fill', 'none')
    expect(container.querySelector('[data-country="PT"]')).toHaveAttribute('stroke-dasharray', '2 2')
    expect(container.querySelector('[data-country="US"]')).not.toHaveAttribute('fill', 'none')
  })
  it('keeps independently claimed evidence pressed even with pending flights', () => {
    const { container } = render(<CountryPreview locale="en" countryIds={['PT']} visits={[{ countryCode: 'PT', count: 0, pending: true, claimed: true }]} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('1 countries visited')
    expect(container.querySelector('[data-country="PT"]')).not.toHaveAttribute('fill', 'none')
  })
  it('draws one great-circle arc per drawable undirected pair beneath the country dots', () => {
    const pair = { aCountry: 'US', bCountry: 'US', count: 1, forward: 1, reverse: 0, lastDate: '2026-01-03' }
    const routes = [
      { ...pair, a: 'BOS', b: 'JFK', from: [-71, 42.4] as [number, number], to: [-73.8, 40.6] as [number, number] },
      { ...pair, a: 'LAX', b: 'NRT', from: [-118.4, 33.9] as [number, number], to: [140.4, 35.8] as [number, number] },
      { ...pair, a: 'XXX', b: 'JFK', from: null, to: [-73.8, 40.6] as [number, number] },
    ].map(pair => ({ a: pair.a, b: pair.b, d: previewArcPath(pair) }))
    const { container } = render(<CountryPreview locale="en" countryIds={['US']} visits={[{ countryCode: 'US', count: 3 }]} routes={routes} />)
    const arcs = [...container.querySelectorAll('path[data-route]')]
    expect(arcs.map(arc => arc.getAttribute('data-route'))).toEqual(['BOS-JFK', 'LAX-NRT'])
    expect(arcs[0].getAttribute('d')).toMatch(/^M218,95\.2L/)
    expect(arcs[0]).toHaveAttribute('stroke', 'var(--map-route)')
    // The Pacific crossing splits at the seam instead of a straight line across the map.
    expect(arcs[1].getAttribute('d')!.match(/M/g)).toHaveLength(2)
    expect(arcs[0].compareDocumentPosition(container.querySelector('[data-country="US"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
