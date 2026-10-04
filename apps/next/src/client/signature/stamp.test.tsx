// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Stamp, resetStampPressMemory, ringCount } from './stamp'

const base = { countryCode: 'JP', nativeName: '日本', name: 'Japan', theme: 'light', locale: 'en', color: '#bc002d' } as const

describe('Stamp', () => {
  beforeEach(() => resetStampPressMemory())

  it('plays the press once per event ID, not after unmount and remount', () => {
    const first = render(<Stamp {...base} kind="air" pressEventId="evt-1" />)
    expect(first.container.querySelector('.stamp')).toHaveAttribute('data-press', 'play')
    first.unmount()
    const second = render(<Stamp {...base} kind="air" pressEventId="evt-1" />)
    expect(second.container.querySelector('.stamp')).toHaveAttribute('data-press', 'idle')
    second.unmount()
    const third = render(<Stamp {...base} kind="air" pressEventId="evt-2" />)
    expect(third.container.querySelector('.stamp')).toHaveAttribute('data-press', 'play')
  })

  it('remembers events in sessionStorage across a module reload', () => {
    render(<Stamp {...base} kind="air" pressEventId="evt-9" />).unmount()
    expect(window.sessionStorage.getItem('kuuki:stamp-press')).toContain('evt-9')
  })

  it('never animates the static variant', () => {
    const { container } = render(<Stamp {...base} kind="air" pressEventId="evt-3" static />)
    expect(container.querySelector('.stamp')).toHaveAttribute('data-press', 'idle')
  })

  it('renders pending as an unpressed slot with a visible waiting label', () => {
    const { container } = render(<Stamp {...base} kind="air" status="pending" pressEventId="evt-4" />)
    expect(screen.getByText('waiting')).toBeVisible()
    const stamp = container.querySelector('.stamp')
    expect(stamp).toHaveAttribute('data-status', 'pending')
    expect(stamp).toHaveAttribute('data-press', 'idle')
  })

  it('renders claim with the visible no-flights label (Russian too)', () => {
    const { unmount } = render(<Stamp {...base} kind="claim" />)
    expect(screen.getByText('no flights')).toBeVisible()
    unmount()
    render(<Stamp {...base} locale="ru" kind="claim" />)
    expect(screen.getByText('без перелётов')).toBeVisible()
  })

  it('uses round faces for air and rectangular for land and sea, with the caption in HTML below', () => {
    const { container } = render(<Stamp {...base} kind="land" visits={3} caption="×3 · 2 mo ago" />)
    expect(container.querySelector('.stamp')).toHaveAttribute('data-shape', 'rect')
    expect(container.querySelectorAll('.stamp-rings rect')).toHaveLength(2)
    expect(screen.getByText('×3 · 2 mo ago').tagName).toBe('FIGCAPTION')
  })

  it('maps visits to rings: 1, 2-3, 4+', () => {
    expect([1, 2, 3, 4, 12].map(ringCount)).toEqual([1, 2, 2, 3, 3])
  })
})
