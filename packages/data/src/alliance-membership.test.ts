import { expect, it } from 'vitest'
import airlines from './airlines.json'
import { ALLIANCES, MEMBERSHIP, allianceAt, formerAlliance } from './alliance-membership'

it.each([
  ['TK', '2019-05-01', 'star'], ['QR', '2013-01-01', null],
  ['QR', '2014-01-01', 'oneworld'], ['S7', '2019-01-01', 'oneworld'],
  ['S7', '2023-01-01', null], ['FZ', '2024-01-01', null],
  ['tk', '2019-05-01', 'star'], [null, '2019-05-01', null],
  ['ZZ', '2019-05-01', null], ['', '2019-05-01', null],
  ['AC', '0001-01-01', null], ['AC', '9999-12-31', 'star'],
])('membership at date: %s %s', (iata, date, expected) => {
  expect(allianceAt(iata, date)).toBe(expected)
})

it('covers investigated static labels without inheriting the incorrect EN/OK labels', () => {
  for (const airline of airlines.filter(row => row.alliance !== null)) {
    if (airline.iata === 'EN') continue
    expect(MEMBERSHIP.some(row => row.iata === airline.iata), airline.iata).toBe(true)
  }
  expect(MEMBERSHIP.some(row => row.iata === 'EN')).toBe(false)
  expect(allianceAt('EN', '2026-10-07')).toBeNull()
  expect(allianceAt('OK', '2019-01-01')).toBe('skyteam')
  expect(allianceAt('OK', '2001-03-24')).toBeNull()
  expect(allianceAt('OK', '2001-03-25')).toBe('skyteam')
  expect(allianceAt('OK', '2024-10-26')).toBeNull()
})

it.each([
  ['OU', '2004-12-14', null], ['OU', '2004-12-15', 'star'],
  ['NH', '1999-10-15', null], ['NH', '1999-10-31', 'star'],
  ['LX', '2006-04-01', 'star'], ['KQ', '2007-09-03', null],
  ['KQ', '2007-09-04', 'skyteam'], ['UX', '2007-09-01', 'skyteam'],
  ['FJ', '2018-12-04', null], ['FJ', '2018-12-05', 'oneworld'],
  ['FJ', '2025-03-31', 'oneworld'], ['WY', '2025-06-29', null],
  ['WY', '2025-06-30', 'oneworld'], ['AT', '2020-04-01', 'oneworld'],
  ['CZ', '2018-12-31', 'skyteam'], ['CZ', '2019-01-01', null],
  ['SU', '2006-04-14', 'skyteam'], ['SU', '2022-04-26', 'skyteam'],
  ['SU', '2022-04-27', null], ['S7', '2022-04-18', 'oneworld'],
  ['S7', '2022-04-19', null], ['LP', '2000-05-31', null],
  ['LP', '2000-06-01', 'oneworld'], ['TA', '2026-10-07', 'star'],
  ['MX', '2010-08-28', 'oneworld'], ['MX', '2010-08-29', null],
  ['QA', '2010-08-28', 'oneworld'], ['QA', '2010-08-29', null],
  ['MA', '2012-02-03', 'oneworld'], ['MA', '2012-02-04', null],
  ['NW', '2010-01-30', 'skyteam'], ['NW', '2010-01-31', null],
  ['US', '2015-10-16', 'oneworld'], ['US', '2015-10-17', null],
  ['MX', '2026-10-07', null], ['AZ', '2019-01-01', null],
  ['AZA', '2019-01-01', null], ['O6', '2019-01-01', null],
])('admitted source policy: %s %s', (iata, date, expected) => {
  expect(allianceAt(iata, date)).toBe(expected)
})

it('switches alliances on the same day and preserves gaps', () => {
  expect(allianceAt('SK', '2024-08-31')).toBe('star')
  expect(allianceAt('SK', '2024-09-01')).toBe('skyteam')
  expect(allianceAt('JJ', '2014-03-30')).toBe('star')
  expect(allianceAt('JJ', '2014-03-31')).toBe('oneworld')
  expect(allianceAt('FM', '2010-10-31')).toBe('star')
  expect(allianceAt('FM', '2010-11-01')).toBeNull()
  expect(allianceAt('FM', '2011-06-21')).toBe('skyteam')
  expect(allianceAt('CM', '2009-10-23')).toBe('skyteam')
  expect(allianceAt('CM', '2009-10-24')).toBeNull()
  expect(allianceAt('CM', '2012-06-21')).toBe('star')
})

it.each([
  ['MX', '2026-10-07', null], ['mx', '2026-10-07', null],
  ['MX', '0001-01-01', null], ['MX', '2009-11-09', null],
  ['MX', '2009-11-10', 'oneworld'], ['mx', '2010-01-01', 'oneworld'],
  ['MX', '2010-08-28', 'oneworld'], ['MX', '2010-08-29', null],
  ['mx', '2010-08-30', null], ['MX', '9999-12-31', null],
])('omits ambiguous reused MX former history while preserving dated membership: %s %s', (iata, date, active) => {
  expect(formerAlliance(iata, date)).toBeNull()
  expect(allianceAt(iata, date)).toBe(active)
})

it('formerAlliance selects the latest ended span only while inactive', () => {
  expect(formerAlliance('s7', '2023-01-01')).toEqual({ alliance: 'oneworld', leftYear: 2022 })
  expect(formerAlliance('S7', '2022-04-19')).toEqual({ alliance: 'oneworld', leftYear: 2022 })
  expect(formerAlliance('S7', '2010-11-14')).toBeNull()
  expect(formerAlliance('S7', '2019-01-01')).toBeNull()
  expect(formerAlliance('SU', '2023-01-01')).toEqual({ alliance: 'skyteam', leftYear: 2022 })
  expect(formerAlliance('JJ', '2021-01-01')).toEqual({ alliance: 'oneworld', leftYear: 2020 })
  expect(formerAlliance('FM', '2011-01-01')).toEqual({ alliance: 'star', leftYear: 2010 })
  expect(formerAlliance('SK', '2024-09-01')).toBeNull()
  expect(formerAlliance('ZZ', '2024-01-01')).toBeNull()
})

it.each(['', '2024', '2024-02', '2024-2-01', '2024-01-1', '2024-01-01T00:00:00Z',
  ' 2024-01-01', '2024-01-01 ', '2024-00-01', '2024-13-01', '2024-01-00',
  '2024-01-32', '2024-04-31', '2023-02-29', '1900-02-29', '2024-02-30', '0000-01-01',
])('rejects malformed calendar date %s safely', date => {
  expect(allianceAt('TK', date)).toBeNull()
  expect(formerAlliance('S7', date)).toBeNull()
})

it('accepts real leap days', () => {
  expect(allianceAt('TK', '2024-02-29')).toBe('star')
  expect(allianceAt('AC', '2000-02-29')).toBe('star')
})

it('rows are well formed, nonoverlapping and cover inclusive/exclusive boundaries', () => {
  expect(ALLIANCES).toEqual(['star', 'oneworld', 'skyteam'])
  for (const row of MEMBERSHIP) {
    expect(row.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(`${row.from}T00:00:00Z`).toISOString().slice(0, 10)).toBe(row.from)
    expect(ALLIANCES).toContain(row.alliance)
    expect(new URL(row.source).protocol).toBe('https:')
    expect(allianceAt(row.iata, row.from)).toBe(row.alliance)
    if (row.to !== null) {
      expect(row.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${row.to}T00:00:00Z`).toISOString().slice(0, 10)).toBe(row.to)
      expect(row.from < row.to).toBe(true)
      const next = MEMBERSHIP.find(other => other.iata === row.iata && other.from === row.to)
      expect(allianceAt(row.iata, row.to)).toBe(next?.alliance ?? null)
    }
    for (const other of MEMBERSHIP.filter(other => other !== row && other.iata === row.iata)) {
      expect((row.to !== null && row.to <= other.from) || (other.to !== null && other.to <= row.from)).toBe(true)
    }
  }
})

it.each([
  ['EI', '2007-04-01', 'oneworld', 2007], ['LA', '2020-05-01', 'oneworld', 2020],
  ['4M', '2020-05-01', 'oneworld', 2020], ['XL', '2020-05-01', 'oneworld', 2020],
  ['LP', '2020-05-01', 'oneworld', 2020], ['AB', '2017-10-28', 'oneworld', 2017],
  ['HG', '2017-10-28', 'oneworld', 2017], ['CO', '2009-10-24', 'skyteam', 2009],
])('includes admitted known leaver %s', (iata, date, alliance, leftYear) => {
  expect(formerAlliance(iata, date)).toEqual({ alliance, leftYear })
})
