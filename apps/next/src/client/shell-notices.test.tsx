// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { expect, it } from 'vitest'
import { ShellNotices, announceShellNotice } from './shell-notices'

const settle = () => act(async () => { await Promise.resolve() })

it('shows an announced notice in the polite region of the owner shell host, with localized labels', async () => {
  render(<ShellNotices ownerId="owner-a" locale="ru"><p>Page</p></ShellNotices>)
  announceShellNotice('owner-a', { message: 'Удаление отменено.' })
  await settle()
  const region = screen.getByRole('status')
  expect(region).toHaveAttribute('aria-live', 'polite')
  expect(region).toHaveTextContent('Уведомление: Удаление отменено.')
  expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
})

it('hands a notice announced while one host unmounts to the next host of the same owner', async () => {
  function Shell({ group }: { group: 'member' | 'public' }) {
    // A different route-group layout remounts the whole shell, as it does between /journal and /leaderboard.
    return group === 'member' ? <ShellNotices key="member" ownerId="owner-b" locale="en"><Leaving /></ShellNotices> : <ShellNotices key="public" ownerId="owner-b" locale="en"><p>Leaderboard</p></ShellNotices>
  }
  function Leaving() { return <LeaveNotice ownerId="owner-b" message="Delete cancelled." /> }
  const view = render(<Shell group="member" />)
  view.rerender(<Shell group="public" />)
  await settle()
  expect(screen.getByRole('status')).toHaveTextContent('Delete cancelled.')
})

it('never shows a notice in another owner shell', async () => {
  render(<ShellNotices ownerId="owner-c" locale="en"><p>Page</p></ShellNotices>)
  announceShellNotice('owner-d', { message: 'Delete cancelled for D.' })
  await settle()
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(screen.queryByText('Delete cancelled for D.')).not.toBeInTheDocument()
})

function LeaveNotice({ ownerId, message }: { ownerId: string; message: string }) {
  // Announce from an unmount cleanup, exactly as the Journal does when a pending delete is dropped.
  useUnmount(() => announceShellNotice(ownerId, { message }))
  return <p>Journal</p>
}
function useUnmount(run: () => void) {
  const latest = useRef(run)
  useEffect(() => { latest.current = run })
  useEffect(() => () => latest.current(), [])
}
