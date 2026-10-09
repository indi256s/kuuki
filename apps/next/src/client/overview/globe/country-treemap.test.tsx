// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { CountryTreemap } from './country-treemap'

it('drills the country hierarchy without changing scope; an explicit region action adds the filter', () => {
  function Scene() {
    const { filter } = useOverview()
    return (
      <>
        <CountryTreemap />
        <output aria-label="Current filters">{JSON.stringify(filter)}</output>
      </>
    )
  }
  render(
    <OverviewProvider
      payload={fixture as OverviewPayload}
      prefs={DEFAULT_PREFS}
      ownerKey="owner"
      locale="en"
      live={false}
    >
      <Scene />
    </OverviewProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Countries from completed flights' }))
  const asia = screen.getByRole('button', { name: /^Asia:/ })
  fireEvent.click(asia)
  expect(screen.getByLabelText('Current filters')).toHaveTextContent('{}')
  expect(screen.getByRole('button', { name: 'All regions' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))
  expect(screen.getByLabelText('Current filters')).toHaveTextContent('"regions":["asia"]')
  fireEvent.click(screen.getByRole('button', { name: 'All regions' }))
  expect(screen.getByLabelText('Current filters')).toHaveTextContent('"regions":["asia"]')
})
