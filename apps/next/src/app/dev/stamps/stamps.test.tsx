// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StampSheet, type Row } from './stamps'

const row = (iso2: string): Row => ({
  iso2,
  kind: 'recipe',
  issues: [],
  names: { en: iso2, ru: iso2 },
  preview: {
    meta: { iso2, iso3: iso2, shape: 'circle', ink: 'indigo', tier: 'fallback', cluster: null },
    rings: {},
  },
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('saves a blurred note before a decision and retains marks on other cards', async () => {
  const replies: ((response: Response) => void)[] = []
  const fetch = vi.fn(
    (_url: string, _options: RequestInit) =>
      new Promise<Response>((resolve) => replies.push(resolve)),
  )
  vi.stubGlobal('fetch', fetch)
  const { container } = render(
    <StampSheet
      initial={{
        theme: 'light',
        locale: 'en',
        size: 96,
        worn: false,
        compare: false,
        filter: 'all',
      }}
      review={{}}
      rows={[row('JP'), row('TH')]}
    />,
  )
  const note = screen.getByRole('textbox', { name: 'Note for JP' })
  fireEvent.change(note, { target: { value: 'new note' } })
  fireEvent.blur(note)
  fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0])
  fireEvent.click(screen.getAllByRole('button', { name: 'Redo' })[1])
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await act(async () => replies.shift()!(Response.json({ JP: { note: 'new note', at: 'today' } })))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(JSON.parse(fetch.mock.calls[1][1].body as string)).toMatchObject({
    iso2: 'JP',
    status: 'accepted',
    note: 'new note',
  })
  await act(async () =>
    replies.shift()!(Response.json({ JP: { status: 'accepted', note: 'new note', at: 'today' } })),
  )
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  // A full server response may carry an older snapshot of another tab's card.
  await act(async () =>
    replies.shift()!(
      Response.json({
        JP: { note: 'old snapshot', at: 'today' },
        TH: { status: 'redo', at: 'today' },
      }),
    ),
  )
  expect(container.querySelector('[data-iso2="JP"]')?.getAttribute('data-review')).toBe('accepted')
  expect(container.querySelector('[data-iso2="TH"]')?.getAttribute('data-review')).toBe('redo')
})
