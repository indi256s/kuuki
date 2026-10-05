// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { announceJournalLink, JOURNAL_LINK_EVENT } from './journal-links'
import { PrimaryNav, TabBar } from './nav'
import { QueueSummarySlot } from './queue-summary'
import { AddActions } from './add-actions'
import { Menu } from './ui/menu'

const awaiting = vi.hoisted(() => ({ value: { data: null as null | { actionableCount: number; awaitingFlightCount: number; draftRowCount: number }, error: false, reload: () => {} } }))
vi.mock('next/navigation', () => ({ usePathname: () => '/journal' }))
vi.mock('next/link', async () => ({ default: (await import('../test/next-link')).linkStandIn(() => {}) }))
vi.mock('./awaiting', () => ({ useAwaiting: () => awaiting.value }))

const heard: string[] = []
const listen = (event: Event) => { heard.push((event as CustomEvent<string>).detail) }
window.addEventListener(JOURNAL_LINK_EVENT, listen)
afterEach(() => { heard.length = 0; awaiting.value = { data: null, error: false, reload: () => {} } })

const journalLinks = () => [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link => new URL(link.getAttribute('href')!, window.location.href).pathname === '/journal')

/** Every link to /journal the shell can show while the Journal is mounted must announce its destination; otherwise a pending filter navigation it supersedes leaves stale drafts. */
describe('shell links to /journal announce their destination', () => {
  const cases: Array<[string, () => ReactNode, number]> = [
    ['desktop navigation', () => <PrimaryNav />, 1],
    ['mobile tab bar', () => <TabBar />, 1],
    ['queue summary count', () => <QueueSummarySlot count={2} />, 1],
    ['queue summary unavailable', () => { awaiting.value = { ...awaiting.value, error: true }; return <QueueSummarySlot /> }, 1],
    ['Awaiting action in the add sheet', () => { awaiting.value = { ...awaiting.value, data: { actionableCount: 2, awaitingFlightCount: 2, draftRowCount: 0 } }; return <AddActions variant="sheet" /> }, 1],
  ]
  it.each(cases)('%s', (_name, ui, expected) => {
    render(<>{ui()}</>)
    const links = journalLinks()
    expect(links).toHaveLength(expected)
    for (const link of links) fireEvent.click(link)
    expect(heard).toEqual(links.map(link => link.getAttribute('href')))
  })

  it('Awaiting action in the desktop add menu', async () => {
    awaiting.value = { ...awaiting.value, data: { actionableCount: 2, awaitingFlightCount: 2, draftRowCount: 0 } }
    render(<Menu trigger={<button type="button">More</button>}><AddActions variant="menu" /></Menu>)
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await screen.findAllByRole('menuitem')
    const links = journalLinks()
    expect(links).toHaveLength(1)
    fireEvent.click(links[0])
    expect(heard).toEqual(['/journal?queue=awaiting'])
  })

  it('stays silent for a modified click and for links elsewhere', () => {
    render(<PrimaryNav />)
    fireEvent.click(journalLinks()[0], { ctrlKey: true })
    for (const link of document.querySelectorAll('a')) if (!journalLinks().includes(link)) fireEvent.click(link)
    expect(heard).toEqual([])
    expect(announceJournalLink('/overview')).toBeUndefined()
    expect(announceJournalLink('/journal/7/edit')).toBeUndefined()
  })
})
