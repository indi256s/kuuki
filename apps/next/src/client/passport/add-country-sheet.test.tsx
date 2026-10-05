// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddCountrySheet } from './add-country-sheet'
import { countryNamer, passportEntries } from './model'

const entries = passportEntries({
  countries: [{ country_code: 'CH', status: 'pressed', logged_visit_count: 1, awaiting_visit_count: 0, claimed: 0, ground_visit_count: 0, first_visit: '2026-05-01', last_visit: '2026-05-01', region: 'europe' }],
  groundVisits: [],
})

describe('AddCountrySheet', () => {
  it('pins search first, suggests recent visits and land neighbors, and marks collected countries in the list', async () => {
    render(<AddCountrySheet open onOpenChange={() => {}} locale="en" mobile entries={entries} name={countryNamer('en')} onPick={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: 'Add country' })
    expect(within(dialog).getByRole('searchbox', { name: 'Find a country' })).toHaveFocus()
    const recent = within(dialog).getByRole('heading', { name: 'Recent visits' }).parentElement!
    expect(within(recent).getAllByRole('button').map(button => button.textContent)).toEqual(['Switzerland'])
    const neighbors = within(dialog).getByRole('heading', { name: 'Neighbors of your countries' }).parentElement!
    // Natural Earth 1:110m has no outline for microstates such as Liechtenstein, so they are reached through search.
    expect(within(neighbors).getAllByRole('button').map(button => button.textContent)).toEqual(['Austria', 'Germany', 'France', 'Italy'])
    expect(within(dialog).getByRole('list', { name: 'Countries' }).children).toHaveLength(246)
    expect(within(dialog).getByRole('button', { name: /^Switzerland,\s*in passport$/ })).toBeInTheDocument()
  })

  it('falls back to search and opens the picked country', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<AddCountrySheet open onOpenChange={() => {}} locale="ru" mobile={false} entries={[]} name={countryNamer('ru')} onPick={onPick} />)
    const dialog = await screen.findByRole('dialog', { name: 'Добавить страну' })
    expect(within(dialog).queryByRole('heading', { name: 'Соседи ваших стран' })).toBeNull()
    await user.type(within(dialog).getByRole('searchbox', { name: 'Найти страну' }), 'Ελλάδα')
    expect(within(dialog).getByRole('status')).toHaveTextContent('1 страна или территория')
    await user.click(within(dialog).getByRole('button', { name: /Греция/ }))
    expect(onPick).toHaveBeenCalledWith('GR')
  })
})
