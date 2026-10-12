// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, snapshot } from '../../import/fixtures'
import type { ConfirmResponse, Draft } from '../../import/import-types'
import { ReviewStep } from './review-step'

const m = vi.hoisted(() => ({
  readBatch: vi.fn(),
  connect: vi.fn(),
  patch: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock('../../import/import-api', () => ({
  readBatch: m.readBatch,
  submitSource: vi.fn(),
  patchDraft: m.patch,
  confirmItems: m.confirm,
}))
vi.mock('../../import/import-events', () => ({ connectEvents: m.connect }))

type Item = { draftId: string; version: number }

const fields = (over: Partial<Draft['fields']> = {}): Draft['fields'] => ({
  date: '2025-08-30',
  origin: 'TBS',
  destination: 'MUC',
  airline_iata: 'LH',
  flight_number: '2557',
  ...over,
})

/** `count` flights that look right, then the three unsure kinds' stand-ins and one left-out row. */
function batchOf(count: number, extra: Draft[] = []): Draft[] {
  const included = Array.from({ length: count }, (_, index) =>
    draft({ id: `r${index}`, ordinal: 10 + index, fields: fields() }),
  )
  return [...extra, ...included]
}
const london = () =>
  draft({
    id: 'air',
    ordinal: 1,
    version: 3,
    fields: fields({
      origin: '',
      destination: 'LIS',
      date: '2022-03-11',
      flight_number: '1333',
      airline_iata: 'TP',
      origin_options: ['LHR', 'LGW', 'STN', 'LTN'],
    }),
  })
const cancelled = () =>
  draft({
    id: 'maybe',
    ordinal: 2,
    selected: false,
    fields: fields({ origin: 'MUC', destination: 'ORD', review_required: true }),
  })
const cancelledToo = () =>
  draft({
    id: 'maybe2',
    ordinal: 2.5,
    selected: false,
    fields: fields({ origin: 'ORD', destination: 'JFK', review_required: true }),
  })
const leftOut = () =>
  draft({ id: 'gone', ordinal: 3, status: 'dismissed', fields: fields({ origin: 'HND' }) })

const created = (item: Item) => ({
  draftId: item.draftId,
  key: `import:${item.draftId}:${item.version}`,
  status: 'created' as const,
  flight: { id: 100, aircraft_icao: null, origin: 'TBS', destination: 'MUC', date: '2025-08-30' },
})
const answer = (items: Item[]): ConfirmResponse => ({
  results: items.map(created),
  batch: { id: 'b1', status: 'review', sequence: 6, reviewRowCount: 0 },
})

function setup(drafts: Draft[], props: Partial<Parameters<typeof ReviewStep>[0]> = {}) {
  m.readBatch.mockResolvedValue(snapshot(drafts))
  const handlers = {
    onSaved: vi.fn(),
    onStartEmpty: vi.fn(async () => {}),
    onFound: vi.fn(),
  }
  render(
    <ReviewStep
      locale="en"
      ownerId="a"
      headingRef={createRef<HTMLHeadingElement>()}
      batch="b1"
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

beforeEach(() => {
  m.readBatch.mockReset()
  m.connect.mockReset().mockReturnValue(new Promise(() => {}))
  m.patch
    .mockReset()
    .mockImplementation(async (id: string, body: { version: number; dismissed?: boolean }) => {
      const known = [london(), cancelled(), cancelledToo(), leftOut()].find((row) => row.id === id)!
      return body.dismissed || id === 'maybe2'
        ? { ...known, version: body.version + 1, status: body.dismissed ? 'dismissed' : 'review' }
        : {
            ...known,
            version: body.version + 1,
            selected: true,
            fields: { ...known.fields, origin: 'LHR' },
          }
    })
  m.confirm.mockReset().mockImplementation(async (_batch: string, items: Item[]) => answer(items))
})
afterEach(cleanup)

describe('ReviewStep', () => {
  it('keeps an unverified row unsure after the member supplies its missing date', async () => {
    const row = draft({
      id: 'date',
      selected: false,
      yearExplicit: false,
      fields: fields({ date: '', verification: 'failed' }),
    })
    m.patch.mockResolvedValue({
      ...row,
      fields: fields({ verification: 'not_verified' }),
      yearConfirmed: true,
      version: 2,
    })
    setup(batchOf(1, [row]))
    const input = await screen.findByRole('textbox', { name: /date.*TBS.*MUC/i })
    fireEvent.change(input, { target: { value: '2025-08-30' } })
    fireEvent.blur(input)
    await waitFor(() => expect(m.patch).toHaveBeenCalledTimes(1))
    expect(m.patch).toHaveBeenCalledWith('date', {
      version: 1,
      fields: { date: '2025-08-30' },
      yearConfirmed: true,
    })
    expect(screen.getByRole('button', { name: 'Save 1 flight' })).toBeTruthy()
  })

  it('retries an unavailable read and resumes a processing batch', async () => {
    m.readBatch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(snapshot([], { status: 'processing' }))
    const handlers = setup(batchOf(1))
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(screen.queryByRole('button', { name: 'Start empty' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Save 1 flight' })).toBeTruthy()
    expect(handlers.onStartEmpty).not.toHaveBeenCalled()
  })

  it('does not advance after leaving while confirmation is pending', async () => {
    let finish!: (response: ConfirmResponse) => void
    m.confirm.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const handlers = setup(batchOf(1))
    fireEvent.click(await screen.findByRole('button', { name: 'Save 1 flight' }))
    await waitFor(() => expect(m.confirm).toHaveBeenCalledTimes(1))
    cleanup()
    await act(async () => finish(answer([{ draftId: 'r0', version: 1 }])))
    expect(handlers.onSaved).not.toHaveBeenCalled()
  })

  it('shows the unsure flights before the ones that look right', async () => {
    setup(batchOf(3, [london(), cancelled()]))
    expect(
      await screen.findByRole('heading', { level: 1, name: '5 flights. Check 2.' }),
    ).toBeTruthy()
    const unsure = screen.getByText('Which London?')
    const right = screen.getByRole('heading', { level: 2, name: /looks right/i })
    expect(unsure.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('says "1 flight." and hides "Check 0"', async () => {
    setup(batchOf(1))
    expect(
      await screen.findByRole('heading', { level: 1, name: '1 flight. All look right.' }),
    ).toBeTruthy()
  })

  it('sends the draft version with an airport pick', async () => {
    setup(batchOf(2, [london()]))
    fireEvent.click(await screen.findByRole('button', { name: 'LHR' }))
    await waitFor(() => expect(m.patch).toHaveBeenCalledTimes(1))
    expect(m.patch).toHaveBeenCalledWith('air', { version: 3, fields: { origin: 'LHR' } })
  })

  it('saves only chosen drafts, 50 at a time', async () => {
    const handlers = setup(batchOf(60, [london(), cancelled(), leftOut()]))
    fireEvent.click(await screen.findByRole('button', { name: 'Save 60 flights' }))
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
    const sizes = m.confirm.mock.calls.map(([, items]) => (items as Item[]).length)
    expect(sizes).toEqual([50, 10])
    const sent = m.confirm.mock.calls.flatMap(([, items]) =>
      (items as Item[]).map((i) => i.draftId),
    )
    expect(sent).toHaveLength(60)
    expect(sent).not.toContain('air')
    expect(sent).not.toContain('maybe')
    expect(sent).not.toContain('gone')
    expect(handlers.onSaved.mock.calls[0][0]).toMatchObject({ leftOut: 3 })
    expect(handlers.onSaved.mock.calls[0][0].flights).toHaveLength(60)
  })

  it('keeps every choice when the save fails, and retries only what is retryable', async () => {
    const handlers = setup(batchOf(2, [london(), cancelled(), leftOut()]))
    fireEvent.click(await screen.findByRole('button', { name: 'LHR' }))
    fireEvent.click(screen.getByRole('button', { name: /leave out: muc/i }))
    m.confirm.mockRejectedValueOnce(new Error('network down'))
    fireEvent.click(await screen.findByRole('button', { name: 'Save 3 flights' }))
    expect(await screen.findByText('Couldn’t save')).toBeTruthy()
    expect(screen.getByText('Nothing is lost. Your fixes are kept.')).toBeTruthy()
    // The picked airport stays on its row, and the left-out rows stay left out.
    expect(screen.getByText('LHR → LIS')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /put back/i })).toHaveLength(2)
    expect(handlers.onSaved).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
    const retried = (m.confirm.mock.calls[1][1] as Item[]).map((item) => item.draftId).sort()
    expect(retried).toEqual(['air', 'r0', 'r1'])
    expect(handlers.onSaved.mock.calls[0][0]).toMatchObject({ leftOut: 2 })
  })

  it('stays on review when a row is refused for good, keeps the receipt and does not resend the saved row', async () => {
    const handlers = setup(batchOf(2))
    m.confirm.mockImplementationOnce(async (_batch: string, items: Item[]) => ({
      ...answer(items),
      results: items.map((item) =>
        item.draftId === 'r1'
          ? {
              draftId: 'r1',
              key: 'k',
              status: 'error' as const,
              http_status: 409,
              code: 'DRAFT_VERSION_CONFLICT',
              error: 'stale',
            }
          : created(item),
      ),
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save 2 flights' }))
    expect(await screen.findByText('Couldn’t save')).toBeTruthy()
    expect(handlers.onSaved).not.toHaveBeenCalled()
    // The batch is read again after a conflict, and the refused row is unsure.
    await waitFor(() => expect(m.readBatch.mock.calls.length).toBeGreaterThan(1))
    expect(screen.getByRole('heading', { level: 1, name: '2 flights. Check 1.' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
    const resent = m.confirm.mock.calls.slice(1).flatMap(([, items]) => items as Item[])
    expect(resent.map((item) => item.draftId)).not.toContain('r0')
    expect(handlers.onSaved.mock.calls[0][0]).toMatchObject({ leftOut: 1 })
    expect(handlers.onSaved.mock.calls[0][0].flights).toHaveLength(1)
  })

  it('moves focus to the next unsure card, then to Save, when the focused card is resolved', async () => {
    setup(batchOf(1, [cancelled(), cancelledToo()]))
    const leave = await screen.findByRole('button', { name: /leave out: muc → ord/i })
    leave.focus()
    fireEvent.click(leave)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /i flew it: ord → jfk/i }),
      ),
    )
    const last = screen.getByRole('button', { name: /leave out: ord → jfk/i })
    last.focus()
    fireEvent.click(last)
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save 1 flight' })),
    )
  })

  it('shows each airport chip with its name, and wraps more than four into a grid', async () => {
    const wide = () => {
      const row = london()
      row.fields.origin_options = ['LHR', 'LGW', 'STN', 'LTN', 'LCY', 'SEN']
      return row
    }
    setup(batchOf(1, [wide()]))
    const chip = await screen.findByRole('button', { name: 'LHR' })
    expect(chip).toHaveAccessibleDescription(/Heathrow/)
    expect(screen.getByRole('group', { name: /airport for london/i })).toHaveAttribute(
      'data-grid',
      'true',
    )
  })

  it('keeps four chips on one row', async () => {
    setup(batchOf(1, [london()]))
    await screen.findByRole('button', { name: 'LHR' })
    expect(screen.getByRole('group', { name: /airport for london/i })).not.toHaveAttribute(
      'data-grid',
    )
  })

  it('expands Looks right into a labelled, keyboard-scrollable region', async () => {
    setup(batchOf(9))
    fireEvent.click(await screen.findByRole('button', { name: 'Show all 9' }))
    const region = screen.getByRole('region', { name: 'Flights that look right' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getAllByRole('listitem')).toHaveLength(9)
  })

  it('tags upcoming rows and shows only the first number of a codeshare', async () => {
    setup([
      draft({
        id: 'future',
        ordinal: 1,
        fields: fields({ date: '2999-01-01', flight_number: '2557 / 8888' }),
      }),
    ])
    expect(await screen.findByText('Upcoming')).toBeTruthy()
    expect(screen.getByText(/LH 2557/)).toBeTruthy()
    expect(screen.queryByText(/8888/)).toBeNull()
  })

  it('starts empty when nothing is included, and stays put if that fails', async () => {
    const handlers = setup([london()])
    const start = await screen.findByRole('button', { name: 'Start empty' })
    expect(screen.getByText('Nothing to save')).toBeTruthy()
    handlers.onStartEmpty.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(start)
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start empty' }))
    await waitFor(() => expect(handlers.onStartEmpty).toHaveBeenCalledTimes(2))
    expect(within(document.body).queryByRole('button', { name: /^Save/ })).toBeNull()
  })

  it('offers only Start empty when the batch is gone', async () => {
    m.readBatch.mockResolvedValue(snapshot([], { expired: true }))
    const handlers = {
      onSaved: vi.fn(),
      onStartEmpty: vi.fn(async () => {}),
      onFound: vi.fn(),
    }
    render(
      <ReviewStep
        locale="en"
        ownerId="a"
        headingRef={createRef<HTMLHeadingElement>()}
        batch="b1"
        {...handlers}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Start empty' }))
    await waitFor(() => expect(handlers.onStartEmpty).toHaveBeenCalled())
  })
})
