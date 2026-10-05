// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyPassport, PassportCover, StampGroups } from './collection'
import { countryNamer, groupByRegion, headerFigures, passportEntries, sortEntries } from './model'
import type { PassportData } from '../../server/passport'

type Row = PassportData['countries'][number]
const row = (code: string, patch: Partial<Row> = {}): Row => ({
  country_code: code, status: 'pressed', logged_visit_count: 0, awaiting_visit_count: 0, claimed: 0, ground_visit_count: 0,
  first_visit: null, last_visit: null, region: null, ...patch,
})
const now = new Date(Date.UTC(2026, 9, 5, 12))
const data = {
  countries: [
    row('JP', { logged_visit_count: 12, first_visit: '2019-04-02', last_visit: '2026-08-01', region: 'asia' }),
    row('PT', { status: 'pending', awaiting_visit_count: 1, first_visit: '2026-10-03', last_visit: '2026-10-03', region: 'europe' }),
    row('IS', { claimed: 1, region: 'europe' }),
    row('GR', { ground_visit_count: 1, region: 'europe' }),
  ],
  groundVisits: [{ country_code: 'GR', visit_year: 2023, entry_method: 'sea' }],
  pressedCountryCount: 3,
  pendingCountryCount: 1,
  regions: [
    { id: 'africa', total: 58, pressed: 0, pending: 0 }, { id: 'americas', total: 54, pressed: 0, pending: 0 },
    { id: 'antarctica', total: 3, pressed: 0, pending: 0 }, { id: 'asia', total: 52, pressed: 1, pending: 0 },
    { id: 'europe', total: 51, pressed: 2, pending: 1 }, { id: 'oceania', total: 28, pressed: 0, pending: 0 },
  ] as PassportData['regions'],
}
const entries = passportEntries(data)
const queue = [{ flight: { id: 31, origin: 'JFK', destination: 'LIS' }, effectiveDefault: { transit: false } }]

describe('PassportCover', () => {
  it('states the total of the 246-country catalog with the waiting caption, six regions and the latest stamp', () => {
    const ru = countryNamer('ru')
    const { container } = render(<PassportCover locale="ru" figures={headerFigures(data, entries, now)} regions={data.regions} name={ru} onAdd={() => {}} now={now} />)
    expect(container.querySelector('.passport-figures strong')).toHaveTextContent('4')
    expect(screen.getByText('из 246')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1 ждёт отметки' })).toHaveAttribute('href', '/journal?queue=awaiting')
    const regions = container.querySelectorAll('.passport-regions li')
    expect(regions).toHaveLength(6)
    expect([...regions].filter(li => li.getAttribute('data-filled') === 'true').map(li => li.textContent)).toEqual(['Азия 1 из 52', 'Европа 2 из 51'])
    expect(screen.getByText('Новые в 2026')).toBeInTheDocument()
    expect(within(container.querySelector('.passport-latest') as HTMLElement).getByText('Япония', { selector: 'span:not(.stamp-name)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '＋ Добавить страну' })).toBeInTheDocument()
  })
})

describe('StampGroups', () => {
  const name = countryNamer('en')
  const renderGroups = (onOpen = vi.fn()) => render(<StampGroups groups={groupByRegion(sortEntries(entries, 'recent', name, 'en'))} locale="en" name={name}
    awaiting={queue} onOpen={onOpen} pressed={new Map()} now={now} />)

  it('groups under region H2s with counts, pending first under Recent', () => {
    renderGroups()
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Europe · 3', 'Asia · 1'])
    const europe = screen.getAllByRole('list')[0]
    expect(within(europe).getAllByRole('listitem')[0]).toHaveAttribute('data-status', 'pending')
  })

  it('links a pending slot to its arrival card and opens pressed stamps in the sheet', () => {
    const onOpen = vi.fn()
    renderGroups(onOpen)
    expect(screen.getByRole('link', { name: 'Portugal: waiting for confirmation. Open the arrival card' })).toHaveAttribute('href', '/journal?queue=awaiting#arrival-31')
    fireEvent.click(screen.getByRole('button', { name: 'Japan, by air, ×12 · 2 mo. ago' }))
    expect(onOpen).toHaveBeenCalledWith('JP')
  })

  it('draws air round, land and sea rectangular, claims dashed with a visible label, and readable captions', () => {
    const { container } = renderGroups()
    const stamp = (code: string) => [...container.querySelectorAll<HTMLElement>('.stamp')].find(node => node.querySelector('.stamp-code')?.textContent === code)!
    expect(stamp('JP')).toHaveAttribute('data-shape', 'round')
    expect(stamp('GR')).toHaveAttribute('data-shape', 'rect')
    expect(stamp('GR')).toHaveAttribute('data-kind', 'sea')
    expect(stamp('IS')).toHaveAttribute('data-kind', 'claim')
    expect(within(stamp('IS')).getByText('no flights')).toBeVisible()
    expect(within(stamp('JP')).getByText('×12 · 2 mo. ago').tagName).toBe('FIGCAPTION')
    expect(within(stamp('JP')).getByText('2019')).toBeInTheDocument()
    expect(stamp('JP').querySelectorAll('.stamp-rings circle')).toHaveLength(3)
  })
})

describe('EmptyPassport', () => {
  it('shows six ghost stamps, the catalog headline and add/import actions', () => {
    const onAdd = vi.fn()
    const { container } = render(<EmptyPassport locale="ru" onAdd={onAdd} />)
    expect(container.querySelectorAll('.passport-ghost')).toHaveLength(6)
    expect(screen.getByRole('heading', { name: '246 стран ждут вас' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить страну' }))
    expect(onAdd).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Импортировать перелёты' })).toHaveAttribute('href', '/import')
  })
})
