// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { airportChoices } from '../capture/reference-choices'
import { Combobox, searchChoices } from './combobox'
import { Dialog } from './dialog'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

describe('searchChoices', () => {
  it('ranks an international airport above a regional one with the same prefix', () => {
    const codes = searchChoices(airportChoices('en'), 'Cape').matches.map((row) => row.code)
    expect(codes.indexOf('CPT')).toBeLessThan(codes.indexOf('CGI'))
    expect(searchChoices(airportChoices('en'), 'cgi').matches[0]?.code).toBe('CGI')
  })
})

describe('Combobox in a dialog', () => {
  it('closes only its list on the first Escape and the dialog on the second', () => {
    const onOpenChange = vi.fn()
    function Harness() {
      const [value, setValue] = useState('')
      return (
        <Dialog open onOpenChange={onOpenChange} title="Add">
          <Combobox
            label="Airline"
            value={value}
            onChange={setValue}
            choices={[{ code: 'KL', label: 'KLM' }]}
            locale="en"
          />
        </Dialog>
      )
    }
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Airline' })
    fireEvent.focus(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
