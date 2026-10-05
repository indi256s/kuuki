// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { linkStandIn } from './next-link'

// The cases of next/dist/client/app-dir/link.js (16.3.8) that component tests rely on.
describe('the next/link stand-in', () => {
  const setup = (props: Record<string, unknown> = {}, href = '/journal') => {
    const navigate = vi.fn()
    const onNavigate = vi.fn()
    const Link = linkStandIn(navigate)
    render(<Link href={href} onNavigate={onNavigate} {...props}>Go</Link>)
    return { navigate, onNavigate, link: screen.getByRole('link', { name: 'Go' }) }
  }

  it('announces, then navigates on a plain local click', () => {
    const { navigate, onNavigate, link } = setup({ replace: true })
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/journal', { replace: true, scroll: true })
  })

  it('announces without navigating when onNavigate cancels', () => {
    const navigate = vi.fn()
    const Link = linkStandIn(navigate)
    render(<Link href="/journal" onNavigate={event => event.preventDefault()}>Go</Link>)
    fireEvent.click(screen.getByRole('link'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each([
    ['a modified click', {}, { ctrlKey: true }, '/journal'],
    ['a user onClick that prevents the default', { onClick: (event: Event) => event.preventDefault() }, {}, '/journal'],
    ['a non-self target', { target: '_blank' }, {}, '/journal'],
    ['a download', { download: '' }, {}, '/journal'],
    ['another origin', {}, {}, 'https://example.com/journal'],
  ])('neither announces nor navigates for %s', (_name, props, click, href) => {
    const { navigate, onNavigate, link } = setup(props, href)
    fireEvent.click(link, click)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('runs the user onClick before announcing', () => {
    const order: string[] = []
    const Link = linkStandIn(() => order.push('navigate'))
    render(<Link href="/journal" onClick={() => order.push('click')} onNavigate={() => order.push('announce')}>Go</Link>)
    fireEvent.click(screen.getByRole('link'))
    expect(order).toEqual(['click', 'announce', 'navigate'])
  })
})
