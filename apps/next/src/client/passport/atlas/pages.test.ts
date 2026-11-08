import { expect, it } from 'vitest'
import type { VisitPoint } from '../model'
import { atlasPages } from './pages'

// Year pages put each country on the year it first joined the passport, oldest first, with undated countries last.
it('splits the countries by the year each first joined the passport', () => {
  const firsts: Record<string, VisitPoint | null> = {
    JP: { year: 2019, date: '2019-04-02' },
    GE: { year: 2016, date: '2016-09-10' },
    AM: { year: 2016, date: null },
    PT: { year: 2014, date: '2014-06-01' },
    IS: null,
  }
  const visits = new Map([
    ['JP', 3],
    ['GE', 1],
    ['AM', 1],
    ['PT', 2],
  ])
  const pages = atlasPages(
    'years',
    visits,
    ['IS'],
    (code) => code,
    (code) => firsts[code] ?? null,
  )
  expect(pages.map((page) => [page.id, page.codes])).toEqual([
    ['world', ['JP', 'GE', 'AM', 'PT', 'IS']],
    [2014, ['PT']],
    [2016, ['AM', 'GE']],
    [2019, ['JP']],
    ['undated', ['IS']],
  ])
})
