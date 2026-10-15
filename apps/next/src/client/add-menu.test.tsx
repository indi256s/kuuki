// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AddMenu } from './add-menu'
import { PrimaryNav } from './nav'

const route = vi.hoisted(() => ({ pathname: '/journal' }))
// The accepted capture paths in their fixed order, spelled out so a dropped or rerouted action fails here.
const ADD_PATHS = [
  '/import',
  '/add',
  '/ground-travel/new?mode=rail',
  '/ground-travel/new?mode=road',
]
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useRouter: () => ({}) }))
vi.mock('next/link', async () => ({
  default: (await import('../test/next-link')).linkStandIn(() => {}),
}))

beforeEach(() => {
  route.pathname = '/journal'
  window.history.replaceState(null, '', '/')
  // jsdom has no layout: without a real box the trigger counts as scrolled out of view and `hideWhenDetached` hides the menu.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 100, 40, 40),
  )
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1024)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(768)
})

const openMenu = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add' }))
  return within(await screen.findByRole('menu', { name: 'Add' })).getAllByRole('menuitem')
}

it('opens one Add menu with the flight pair, then the ground pair, in order', async () => {
  const user = userEvent.setup()
  render(<AddMenu />)
  const trigger = screen.getByRole('button', { name: 'Add' })
  expect(trigger).not.toHaveAttribute('aria-current')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  // Named after its trigger: Radix's default label must survive `Menu`'s optional override.
  const menu = await screen.findByRole('menu', { name: 'Add' })
  const items = within(menu).getAllByRole('menuitem')
  expect(items.map((item) => item.getAttribute('href'))).toEqual(ADD_PATHS)
  expect(items.map((item) => item.querySelector('.locale-en')?.textContent)).toEqual([
    'Flights from files',
    'Flight by hand',
    'Train journey',
    'Road trip',
  ])
  // Two groups apart by space: no divider and no group label inside the list.
  expect(within(menu).getAllByRole('group')).toHaveLength(2)
  expect(within(menu).queryByRole('separator')).not.toBeInTheDocument()
})

it('carries the ground list view as the return context on the ground rows only', async () => {
  route.pathname = '/ground-travel'
  window.history.replaceState(null, '', '/ground-travel?mode=rail')
  render(<AddMenu />)
  const hrefs = (await openMenu()).map((item) => item.getAttribute('href'))
  expect(hrefs).toEqual([
    '/import',
    '/add',
    '/ground-travel/new?mode=rail&return=%2Fground-travel%3Fmode%3Drail',
    '/ground-travel/new?mode=road&return=%2Fground-travel%3Fmode%3Drail',
  ])
})

it('lists Overview, Journal and Passport, with Journal current in the ground section', () => {
  route.pathname = '/ground-travel'
  render(<PrimaryNav />)
  const links = within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([
    'OverviewОбзор',
    'JournalЖурнал',
    'PassportПаспорт',
  ])
  expect(links.filter((link) => link.getAttribute('aria-current') === 'page')).toEqual([links[1]])
})
