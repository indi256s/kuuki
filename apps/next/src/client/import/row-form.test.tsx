// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import type { Locale } from '../../lib/format'
import { emptyValues } from './review-model'
import { RowForm } from './row-form'

it.each(['en', 'ru'] as const)(
  'selects an airline by name or code and keeps its IATA value in %s',
  (locale: Locale) => {
    const changed = vi.fn()
    function Form() {
      const [values, setValues] = useState(emptyValues)
      return (
        <RowForm
          locale={locale}
          values={values}
          onChange={(next) => {
            setValues(next)
            changed(next)
          }}
          errors={{}}
          idPrefix="manual"
        />
      )
    }
    render(<Form />)
    const airline = screen.getByRole('combobox', {
      name: locale === 'ru' ? 'Авиакомпания · необязательно' : 'Airline · optional',
    })
    fireEvent.change(airline, { target: { value: 'Turkish' } })
    fireEvent.click(screen.getByRole('option', { name: /^Turkish Airlines.* TK$/ }))
    expect(airline).toHaveValue('TK')
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ airline_iata: 'TK' }))
    fireEvent.change(airline, { target: { value: 'ba' } })
    fireEvent.click(screen.getByRole('option', { name: /^British Airways.* BA$/ }))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ airline_iata: 'BA' }))
    fireEvent.change(airline, { target: { value: ' q0 ' } })
    fireEvent.blur(airline)
    expect(airline).toHaveValue('Q0')
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ airline_iata: 'Q0' }))
    fireEvent.change(airline, { target: { value: '' } })
    fireEvent.blur(airline)
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ airline_iata: '' }))
  },
)
