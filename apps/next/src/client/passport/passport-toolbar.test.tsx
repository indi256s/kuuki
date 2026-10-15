// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePassportQuery, type PassportState } from '../../lib/url-state'
import { MAP_SCOPE_SRC, PassportToolbar, mapScopeOf } from './passport-toolbar'

const stateOf = (src: string | null, view = 'map'): PassportState =>
  normalizePassportQuery({ view, ...(src ? { src } : {}) }, () => true).state

function toolbar(state: PassportState, owner = true) {
  const navigate = vi.fn()
  render(
    <PassportToolbar
      locale="ru"
      owner={owner}
      state={state}
      query=""
      onQuery={() => {}}
      filterCount={state.sources.length ? 1 : 0}
      filtersActive={state.sources.length > 0}
      onReset={() => {}}
      navigate={navigate}
    />,
  )
  return navigate
}

afterEach(cleanup)

describe('passport map scope', () => {
  it('maps the three canonical src values to the segment and back', () => {
    for (const scope of ['all', 'flights', 'ground'] as const)
      expect(mapScopeOf(stateOf(MAP_SCOPE_SRC[scope]).sources)).toBe(scope)
    expect(mapScopeOf(stateOf('manual').sources)).toBeNull()
    expect(mapScopeOf(stateOf('flights,trains').sources)).toBeNull()
  })

  it('writes the canonical src from the segment', () => {
    const navigate = toolbar(stateOf(null))
    fireEvent.click(screen.getByRole('radio', { name: 'По земле' }))
    expect(navigate).toHaveBeenLastCalledWith({ src: 'trains,road' })
  })

  it('names another source combination instead of misrepresenting it', () => {
    toolbar(stateOf('manual'))
    expect(screen.queryByRole('radiogroup', { name: 'Что показывает карта' })).toBeNull()
    expect(screen.getByText('Источники: Вручную')).toBeTruthy()
  })

  it('stays off the cards view and for visitors', () => {
    toolbar(stateOf(null, 'cards'))
    expect(screen.queryByRole('radiogroup', { name: 'Что показывает карта' })).toBeNull()
    cleanup()
    toolbar(stateOf(null), false)
    expect(screen.queryByRole('radiogroup', { name: 'Что показывает карта' })).toBeNull()
  })
})
