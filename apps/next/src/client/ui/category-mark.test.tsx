// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { MAKER_SLOTS } from '@kuuki/data/aircraft-makers'
import { AllianceMark, MakerSwatch } from './category-mark'

it.each([
  ['star', 'Star Alliance', '★'],
  ['oneworld', 'oneworld', '○'],
  ['skyteam', 'SkyTeam', '△'],
] as const)('alliance mark has accessible name: %s', (alliance, name, symbol) => {
  render(<AllianceMark alliance={alliance} />)
  const mark = screen.getByRole('img', { name })
  expect(mark).toHaveTextContent(symbol)
  expect(mark.style.color).toBe(`var(--cat-alliance-${alliance})`)
  expect(mark).toHaveStyle({ width: '12px', height: '12px', fontSize: '12px' })
})

it.each(MAKER_SLOTS)('uses the canonical %s maker token as a decorative square', maker => {
  const { container } = render(<MakerSwatch maker={maker} />)
  const mark = container.firstElementChild as HTMLElement
  expect(mark).toHaveAttribute('aria-hidden', 'true')
  expect(mark.style.backgroundColor).toBe(`var(--cat-maker-${maker})`)
  expect(mark).toHaveStyle({ width: '12px', height: '12px' })
})

it('sizes both marks from the requested size', () => {
  const { container } = render(<><MakerSwatch maker="airbus" size={24} /><AllianceMark alliance="star" size={24} /></>)
  expect(container.firstElementChild).toHaveStyle({ width: '24px', height: '24px' })
  expect(screen.getByRole('img', { name: 'Star Alliance' })).toHaveStyle({ width: '24px', height: '24px', fontSize: '24px' })
})
