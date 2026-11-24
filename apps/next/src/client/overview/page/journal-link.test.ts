import { expect, it } from 'vitest'
import type { OverviewPayload, OverviewRow } from '@kuuki/shared/overview/model'
import { journalLinkFor } from './journal-link'

const row = (patch: Partial<OverviewRow>) =>
  ({ origin: 'LHR', destination: 'TBS', suppressed: 0, ...patch }) as OverviewRow
const payload = (rows: OverviewRow[] = [row({})]) =>
  ({
    rows,
    refs: { airports: { LHR: { country: 'GB' }, TBS: { country: 'GE' }, IST: { country: 'TR' } } },
  }) as unknown as Pick<OverviewPayload, 'rows' | 'refs'>

it('links an unfiltered count to the plain Journal', () => {
  expect(journalLinkFor({ scope: 'flights' }, payload())).toEqual({ href: '/journal', dropped: [] })
})

it('carries the facets the Journal matches the same way', () => {
  expect(
    journalLinkFor(
      {
        period: { years: [2024, 2023] },
        airlines: ['BA'],
        alliances: ['oneworld'],
        countries: ['GE'],
      },
      payload(),
    ),
  ).toEqual({
    href: '/journal?years=2023,2024&country=GE&airline=BA&alliance=oneworld',
    dropped: [],
  })
  expect(journalLinkFor({ period: { from: '2024-02', to: '2024-02' } }, payload()).href).toBe(
    '/journal?from=2024-02-01&to=2024-02-29',
  )
})

it('names what it cannot carry instead of promising the same flights', () => {
  expect(
    journalLinkFor(
      {
        airports: ['TBS'],
        countries: ['GE'],
        aircraft: ['A320'],
        families: ['A320 family'],
        routes: ['LHR-TBS'],
        haul: ['short'],
      },
      payload(),
    ),
  ).toEqual({
    href: '/journal?airport=TBS&aircraft=A320',
    dropped: ['countries', 'families', 'routes', 'haul'],
  })
  expect(
    journalLinkFor({ countries: ['TR'] }, payload([row({ destination: 'IST', suppressed: 2 })])),
  ).toEqual({
    href: '/journal',
    dropped: ['countries'],
  })
})
