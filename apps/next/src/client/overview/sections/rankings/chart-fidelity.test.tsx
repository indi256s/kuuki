import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ArcDonut } from '../../charts/arc-donut'

it('keeps every airline identity, including tiny shares beyond the upstream grouping limit', () => {
  const values = [10000000, 1, 1, 1, 1, 1, 1, 1]
  const rows = values.map((value, index) => ({ point: { key: `airline-${index}`, datum: value, label: `Airline ${index}` }, value, color: 'var(--mark-1)' }))
  const html = renderToStaticMarkup(<ArcDonut rows={rows} mark={point => ({ 'aria-label': point.label })} totalLabel="Flights" formatValue={String} />)
  for (let index = 0; index < values.length; index++) expect(html).toContain(`aria-label="Airline ${index}"`)
  expect(html).not.toContain('d=""')
  expect(html).toContain('10000007')
})
