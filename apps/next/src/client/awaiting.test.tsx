// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { api } from '@kuuki/client/apiClient'
import { AwaitingProvider } from './awaiting'
import { QueueMenuItem } from './queue-summary'
import { Menu } from './ui/menu'
import { AddActions } from './add-actions'

vi.mock('./activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('@kuuki/client/apiClient', () => ({ api: { get: vi.fn() }, getAuthGeneration: () => 0 }))

const queueRows = () =>
  screen.queryAllByRole('menuitem', {
    name: 'To review: 2 flights awaiting confirmation, 3 draft rows to review',
  })

it('shares distinct C4 counts with navigation/capture, retains cached counts on failure, and hides zero', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ actionableCount: 5, awaitingFlightCount: 2, draftRowCount: 3 })
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ actionableCount: 0, awaitingFlightCount: 0, draftRowCount: 0 })
  render(
    <AwaitingProvider ownerId="owner">
      <Menu open trigger={<button type="button">x</button>}>
        <QueueMenuItem />
        <AddActions />
      </Menu>
    </AwaitingProvider>,
  )
  // The account-menu row and the Add chooser's last row read the same count.
  await waitFor(() => expect(queueRows()).toHaveLength(2))
  for (const row of queueRows()) expect(row).toHaveTextContent('5')
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  expect(queueRows()).toHaveLength(2)
  act(() => window.dispatchEvent(new Event('kuuki:lifecycle-changed')))
  await waitFor(() =>
    expect(screen.queryByRole('menuitem', { name: /To review/ })).not.toBeInTheDocument(),
  )
})

const cases: Array<[number, number, string, string]> = [
  [1, 0, 'To review: 1 flight awaiting confirmation', 'На проверку: 1 перелёт ждёт подтверждения'],
  [
    2,
    0,
    'To review: 2 flights awaiting confirmation',
    'На проверку: 2 перелёта ждут подтверждения',
  ],
  [
    5,
    0,
    'To review: 5 flights awaiting confirmation',
    'На проверку: 5 перелётов ждут подтверждения',
  ],
  [0, 1, 'To review: 1 draft row to review', 'На проверку: 1 строка для проверки'],
  [0, 2, 'To review: 2 draft rows to review', 'На проверку: 2 строки для проверки'],
  [0, 5, 'To review: 5 draft rows to review', 'На проверку: 5 строк для проверки'],
  [
    1,
    5,
    'To review: 1 flight awaiting confirmation, 5 draft rows to review',
    'На проверку: 1 перелёт ждёт подтверждения, 5 строк для проверки',
  ],
  [
    21,
    2,
    'To review: 21 flights awaiting confirmation, 2 draft rows to review',
    'На проверку: 21 перелёт ждёт подтверждения, 2 строки для проверки',
  ],
]
it.each(cases)(
  'names the row with real plurals, only non-zero parts and the visible label first (%i flights, %i rows)',
  async (flights, rows, en, ru) => {
    for (const [locale, name] of [
      ['en', en],
      ['ru', ru],
    ] as const) {
      vi.mocked(api.get)
        .mockReset()
        .mockResolvedValue({
          actionableCount: flights + rows,
          awaitingFlightCount: flights,
          draftRowCount: rows,
        })
      const { unmount } = render(
        <AwaitingProvider ownerId={`owner-${locale}`}>
          <Menu open trigger={<button type="button">x</button>}>
            <QueueMenuItem locale={locale} />
          </Menu>
        </AwaitingProvider>,
      )
      const link = await screen.findByRole('menuitem', { name })
      expect(link).toHaveTextContent(String(flights + rows))
      expect(
        link
          .getAttribute('aria-label')!
          .startsWith(link.querySelector('.queue-label')!.textContent!),
      ).toBe(true)
      expect(link.getAttribute('aria-label')).not.toMatch(/\b0 /)
      unmount()
    }
  },
)
