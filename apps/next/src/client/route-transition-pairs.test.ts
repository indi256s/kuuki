// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { isApprovedPair, useTransitionKey } from './route-transition-pairs'

describe('isApprovedPair', () => {
  it.each([
    ['/passport', '/import', true],
    ['/import', '/passport', true],
    ['/journal', '/ground-travel', false],
    ['/ground-travel', '/journal', false],
    ['/overview', '/ground-travel', true],
    ['/ground-travel', '/passport', true],
    ['/ground-travel', '/ground-travel/new', false],
    ['/journal', '/add', false],
  ])('%s → %s animates: %s', (from, to, animates) => {
    expect(isApprovedPair('page', from, to)).toBe(animates)
  })
})

describe('useTransitionKey', () => {
  function navigate(href: string, detail: number) {
    const link = document.createElement('a')
    link.href = href
    link.addEventListener('click', (event) => event.preventDefault())
    document.body.appendChild(link)
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
    link.remove()
  }

  it('remounts for a pointer tab switch and keeps the boundary for a keyboard one', () => {
    const { result, rerender } = renderHook(({ path }) => useTransitionKey('page', path), {
      initialProps: { path: '/overview' },
    })
    navigate('/journal', 1)
    rerender({ path: '/journal' })
    expect(result.current).toBe(1)
    navigate('/passport', 0)
    rerender({ path: '/passport' })
    expect(result.current).toBe(1)
  })
})
