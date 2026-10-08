// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { GlobeCard } from './globe-card'

it('opens the same child component in real modal Dialog, Escape closes and returns focus to the fullscreen opener', async () => {
  const user = userEvent.setup()
  function Globe({ fullscreen }: { fullscreen: boolean }) { return <p>{fullscreen ? 'Fullscreen globe' : 'Embedded globe'}</p> }
  render(<GlobeCard locale="en" topLeft={<button>Filter</button>} bottomLeft={<button>Pause</button>}>{({ fullscreen }) => <Globe fullscreen={fullscreen} />}</GlobeCard>)
  const opener = screen.getByRole('button', { name: 'Fullscreen' })
  await user.click(opener)
  const dialog = await screen.findByRole('dialog', { name: 'Globe' })
  expect(within(dialog).getByText('Fullscreen globe')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Filter' })).toBeInTheDocument()
  expect(opener.closest('[aria-hidden="true"]')).not.toBeNull()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  expect(opener).toHaveFocus()
  expect(screen.getByText('Embedded globe')).toBeInTheDocument()
})

it.each(['en', 'ru'] as const)('uses the exact four fixed visit buckets and localized title (%s)', locale => {
  render(<GlobeCard locale={locale}>{() => <span>Globe</span>}</GlobeCard>)
  const legend = screen.getByRole('list', { name: locale === 'en' ? 'Visits per country' : 'Посещений на страну' })
  expect(within(legend).getAllByRole('listitem').map(item => item.textContent)).toEqual(['1', '2–3', '4–9', '10+'])
  expect([...legend.querySelectorAll('[aria-hidden="true"]')].map(item => item.getAttribute('style'))).toEqual([1, 2, 3, 4].map(bucket => `background: var(--map-bucket-${bucket});`))
})

it('corner controls keep native click propagation and custom legend content', () => {
  let clicks = 0
  render(<div onClick={() => clicks++}><GlobeCard locale="en" topRight={<button>Layer</button>} bottomRight={<span>Custom legend</span>}>{() => <span>Globe</span>}</GlobeCard></div>)
  fireEvent.click(screen.getByRole('button', { name: 'Layer' }))
  expect(clicks).toBe(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText('Custom legend')).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})
