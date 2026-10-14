import { describe, expect, it } from 'vitest'
import { groundHref, groundReturnPath, parseGroundUrl, withReturn } from './url'
import { uuid } from './test-fixtures'

describe('ground-travel url', () => {
  it('round-trips mode, cancelled and journey and drops everything else', () => {
    const search = `mode=rail&status=cancelled&journey=${uuid(7).toUpperCase()}&utm=x`
    const view = parseGroundUrl(search)
    expect(view).toEqual({ mode: 'rail', cancelled: true, journey: uuid(7) })
    expect(groundHref(view)).toBe(`/ground-travel?mode=rail&status=cancelled&journey=${uuid(7)}`)
  })

  it('ignores an unknown mode and a journey that is not a UUID', () => {
    expect(parseGroundUrl('mode=boat&journey=abc&status=planned')).toEqual({
      mode: null,
      cancelled: false,
      journey: null,
    })
  })

  it('accepts only ground-travel list addresses as a return context', () => {
    expect(groundReturnPath('/ground-travel?mode=road&status=cancelled')).toBe(
      '/ground-travel?mode=road&status=cancelled',
    )
    for (const bad of [
      'https://example.com/ground-travel',
      '//evil.example/ground-travel',
      '/journal',
      '/ground-travelx',
      '/ground-travel?next=/signin',
      null,
    ])
      expect(groundReturnPath(bad)).toBe('/ground-travel')
  })

  it('carries the current list address on form links', () => {
    expect(
      withReturn('/ground-travel/new?mode=rail', { mode: 'rail', cancelled: false, journey: null }),
    ).toBe('/ground-travel/new?mode=rail&return=%2Fground-travel%3Fmode%3Drail')
  })
})
