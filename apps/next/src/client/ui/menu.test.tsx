// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Menu, MenuItem, MenuTray } from './menu'

function Harness({ onPick }: { onPick: (value: string) => void }) {
  const [value, setValue] = useState<'light' | 'dark' | 'system'>('system')
  return (
    <Menu trigger={<button type="button">Open</button>}>
      <MenuItem>First</MenuItem>
      <MenuTray
        label="Theme"
        value={value}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ]}
        onValueChange={(next) => {
          onPick(next)
          setValue(next)
        }}
      />
      <MenuItem>Last</MenuItem>
    </Menu>
  )
}

describe('MenuTray', () => {
  it('is one Up/Down stop; Left/Right pick at once and keep the menu open', async () => {
    const onPick = vi.fn()
    const user = userEvent.setup()
    render(<Harness onPick={onPick} />)
    screen.getByRole('button', { name: 'Open' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    const system = screen.getByRole('menuitemradio', { name: 'System' })
    expect(system).toHaveFocus()
    expect(system).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowRight}')
    expect(onPick).toHaveBeenLastCalledWith('light')
    const light = screen.getByRole('menuitemradio', { name: 'Light' })
    expect(light).toHaveFocus()
    expect(light).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Last' })).toHaveFocus()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('picks an unselected cell by click without closing', async () => {
    const onPick = vi.fn()
    const user = userEvent.setup()
    render(<Harness onPick={onPick} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }))
    expect(onPick).toHaveBeenCalledWith('dark')
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('opens without motion from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness onPick={() => undefined} />)
    screen.getByRole('button', { name: 'Open' }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toHaveAttribute('data-instant', '')
  })
})
