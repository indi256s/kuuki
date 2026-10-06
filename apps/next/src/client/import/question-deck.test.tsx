// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { DraftChange, SaveState } from './draft-saver'
import { draft } from './fixtures'
import type { Draft } from './import-types'
import { QuestionDeck } from './question-deck'
import { withUnsent } from './review-model'

const TODAY = '2026-10-07'
const pass = (id: string, monthDay: string, ordinal: number) => draft({ id, ordinal, selected: false, yearExplicit: false, confidence: 0.5,
  fieldConfidence: { date: 0, origin: 1, destination: 1, airline_iata: 1 }, fields: { date: '', date_month_day: monthDay, origin: 'PEK', destination: 'SVO', airline_iata: 'MU' } })
const moscow = (id: string, ordinal: number) => draft({ id, ordinal, selected: false, fields: { date: '2015-05-21', origin: 'ROV', destination: '', destination_options: ['DME', 'SVO', 'VKO'], airline_iata: 'SU' } })
const flagged = (id: string, ordinal: number) => draft({ id, ordinal, selected: false, confidence: 0.5, fields: { date: '2023-01-31', origin: 'TBS', destination: 'SAW', airline_iata: 'PC', review_required: true } })

/** Applies each answer the way the saver's unsent overlay does, so answered questions leave the deck. */
function Harness({ initial, onChange, locale = 'en', saveStates = {} }: { initial: Draft[]; onChange?: (draft: Draft, change: DraftChange) => void; locale?: 'en' | 'ru'; saveStates?: Record<string, SaveState> }) {
  const [drafts, setDrafts] = useState(initial)
  return <QuestionDeck locale={locale} drafts={drafts} saveStates={saveStates} readyCount={drafts.filter(row => row.selected).length} frozen={false} today={TODAY} onRetry={vi.fn()}
    onChange={(row, change) => {
      onChange?.(row, change)
      setDrafts(current => current.map(item => item.id !== row.id ? item
        : { ...withUnsent(item, change), status: change.dismissed === undefined ? item.status : change.dismissed ? 'dismissed' : 'review' }))
    }} />
}

describe('QuestionDeck', () => {
  it('renders nothing when no question is open', () => {
    const { container } = render(<Harness initial={[draft({ id: 'ok' })]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('sets the year of every boarding pass with one answer and selects the completed rows', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={[pass('p1', '03-26', 0), pass('p2', '03-27', 1)]} onChange={onChange} />)
    const card = screen.getByRole('group', { name: '2 flights show no year' })
    expect(within(card).getByText(/^(26 March|March 26)$/)).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: '2026' })).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: '2025' }))
    expect(onChange.mock.calls.map(([row, change]) => [row.id, change])).toEqual([
      ['p1', { fields: { date: '2025-03-26' }, yearConfirmed: true, selected: true }],
      ['p2', { fields: { date: '2025-03-27' }, yearConfirmed: true, selected: true }],
    ])
    expect(screen.queryByRole('group', { name: /show no year/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Year 2025: 2 flights.')
    expect(screen.getByText('2 ready to import')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Questions' })).toHaveFocus()
  })

  it('checks a typed year before applying it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={[pass('p1', '03-26', 0), pass('p2', '03-27', 1)]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Another year' }))
    const year = screen.getByRole('textbox', { name: 'Year' })
    expect(year).toHaveFocus()
    await user.type(year, '2031{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a year from 1950 to 2027.')
    expect(onChange).not.toHaveBeenCalled()
    await user.clear(year)
    await user.type(year, '2019{Enter}')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls[0][1]).toMatchObject({ fields: { date: '2019-03-26' } })
  })

  it('asks for each ambiguous airport separately and moves focus to the next question', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={[moscow('m1', 0), moscow('m2', 1), flagged('s1', 2)]} onChange={onChange} />)
    const card = screen.getByRole('group', { name: 'Moscow: which airport?' })
    const first = within(card).getAllByRole('group')[0]
    await user.click(within(first).getByRole('button', { name: /^DME,/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm1' }), { fields: { destination: 'DME' }, selected: true })
    expect(within(screen.getByRole('group', { name: 'Moscow: which airport?' })).getAllByRole('group')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Moscow: which airport?' })).toHaveFocus()
  })

  it('skips a flight the member did not take and can bring it back', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={[flagged('s1', 0), flagged('s2', 1)]} onChange={onChange} />)
    await user.click(within(screen.getAllByRole('group', { name: /TBS → SAW/ })[0]).getByRole('button', { name: 'Did not fly' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 's1' }), { dismissed: true })
    await user.click(screen.getByRole('button', { name: 'Bring back' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 's1' }), { dismissed: false })
    expect(screen.getByRole('group', { name: 'Check the status of 2 flights' })).toBeInTheDocument()
  })

  it('leaves a question to the rows when the member answers each one', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[draft({ id: 'z1', selected: false, fields: { date: '2020-01-01', origin: 'ROV', destination: 'EVN', airline_iata: 'ZZ', airline_was_placeholder: true } }),
      draft({ id: 'z2', ordinal: 1, selected: false, fields: { date: '2020-01-05', origin: 'EVN', destination: 'ROV', airline_iata: 'ZZ', airline_was_placeholder: true } })]} />)
    await user.click(screen.getByRole('button', { name: 'I will set each one' }))
    expect(screen.queryByRole('group', { name: '2 flights have no airline' })).not.toBeInTheDocument()
  })

  it('reports answers that did not save and retries them', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const failed: SaveState = { status: 'error', unsent: { selected: true }, failure: null, rejected: false }
    function Failing() {
      const [drafts, setDrafts] = useState([pass('p1', '03-26', 0), pass('p2', '03-27', 1)])
      const [states, setStates] = useState<Record<string, SaveState>>({})
      return <QuestionDeck locale="en" drafts={drafts} saveStates={states} readyCount={0} frozen={false} today={TODAY} onRetry={onRetry}
        onChange={(row, change) => { setDrafts(current => current.map(item => item.id === row.id ? withUnsent(item, change) : item)); if (row.id === 'p2') setStates({ p2: failed }) }} />
    }
    render(<Failing />)
    await user.click(screen.getByRole('button', { name: '2026' }))
    expect(screen.getByText(/Not applied to 1 flight/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledWith('p2')
  })

  it('speaks Russian with real plural forms', () => {
    render(<Harness locale="ru" initial={[pass('p1', '03-26', 0), pass('p2', '03-27', 1), pass('p3', '03-28', 2), pass('p4', '03-29', 3), pass('p5', '03-30', 4)]} />)
    expect(screen.getByRole('group', { name: 'У 5 перелётов не виден год' })).toBeInTheDocument()
    expect(screen.getByText(/1 вопрос на 5 перелётов/)).toBeInTheDocument()
    expect(screen.getByText('26 марта')).toBeInTheDocument()
  })
})
