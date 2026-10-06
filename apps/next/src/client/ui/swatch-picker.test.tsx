// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../appearance', () => ({ setAccent: vi.fn() }))
import { setAccent } from '../appearance'
import { SwatchPicker } from './swatch-picker'

describe('SwatchPicker', () => {
  beforeEach(() => { vi.mocked(setAccent).mockClear(); delete document.documentElement.dataset.accent })

  it('selecting Matcha calls setAccent("matcha") and exposes named radios', async () => {
    render(<SwatchPicker locale="en" />)
    for (const name of ['Terracotta', 'Ai', 'Matcha', 'Asagi', 'Sakura']) expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Terracotta' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Matcha' }))
    expect(setAccent).toHaveBeenCalledWith('matcha')
    expect(screen.getByRole('radio', { name: 'Matcha' })).toHaveAttribute('aria-checked', 'true')
  })

  it('uses Russian names for locale ru', () => {
    render(<SwatchPicker locale="ru" />)
    expect(screen.getByRole('radio', { name: 'Матча' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Акцентный цвет' })).toBeInTheDocument()
  })
})
