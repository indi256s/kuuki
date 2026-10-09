// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { NavigationLink, ROUTE_LINK_EVENT } from './navigation-link'

vi.mock('next/link', async () => ({
  default: (await import('../test/next-link')).linkStandIn(() => {}),
}))

it('announces a plain owned link before navigation, leaving modified and cancelled clicks alone', () => {
  const heard: string[] = []
  const listen = (event: Event) => {
    heard.push((event as CustomEvent<string>).detail)
  }
  window.addEventListener(ROUTE_LINK_EVENT, listen)
  try {
    render(
      <>
        <NavigationLink href="/overview">Overview</NavigationLink>
        <NavigationLink href="/settings" onClick={(event) => event.preventDefault()}>
          Settings
        </NavigationLink>
      </>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }), { metaKey: true })
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))
    expect(heard).toEqual([])
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }))
    expect(heard).toEqual(['/overview'])
  } finally {
    window.removeEventListener(ROUTE_LINK_EVENT, listen)
  }
})
