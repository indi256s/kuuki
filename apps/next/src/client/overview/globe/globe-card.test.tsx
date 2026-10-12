// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { GlobeCard } from './globe-card'

it('titles the visit legend and lists every bucket in both languages', () => {
  const { unmount } = render(<GlobeCard locale="en">{() => null}</GlobeCard>)
  const en = screen.getByRole('list', { name: 'Visits per country' })
  expect(
    within(en)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['1', '2–3', '4–9', '10+'])
  unmount()
  render(<GlobeCard locale="ru">{() => null}</GlobeCard>)
  const ru = screen.getByRole('list', { name: 'Посещений на страну' })
  expect(within(ru).getAllByRole('listitem')).toHaveLength(4)
})
