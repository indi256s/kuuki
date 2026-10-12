// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AddMenu } from './add-menu'
import { PrimaryNav } from './nav'

const pathname = '/journal'
// The accepted capture paths, spelled out so a dropped or rerouted action fails here.
const ADD_PATHS = ['/import?source=pass', '/import?source=file', '/import?source=text', '/add']
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({}) }))
vi.mock('next/link', async () => ({
  default: (await import('../test/next-link')).linkStandIn(() => {}),
}))

beforeEach(() => {
  // jsdom has no layout: without a real box the trigger counts as scrolled out of view and `hideWhenDetached` hides the menu.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 100, 40, 40),
  )
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1024)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(768)
})

it('opens one Add flight menu with the four capture rows in order', async () => {
  const user = userEvent.setup()
  render(<AddMenu />)
  const trigger = screen.getByRole('button', { name: 'Add flight' })
  expect(trigger).not.toHaveAttribute('aria-current')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  // Named after its trigger: Radix's default label must survive `Menu`'s optional override.
  const items = within(await screen.findByRole('menu', { name: 'Add flight' })).getAllByRole(
    'menuitem',
  )
  expect(items.map((item) => item.getAttribute('href'))).toEqual(ADD_PATHS)
})

it('lists Overview, Journal and Passport, marking the current route', () => {
  render(<PrimaryNav />)
  const links = within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([
    'OverviewОбзор',
    'JournalЖурнал',
    'PassportПаспорт',
  ])
  expect(links.filter((link) => link.getAttribute('aria-current') === 'page')).toEqual([links[1]])
})
