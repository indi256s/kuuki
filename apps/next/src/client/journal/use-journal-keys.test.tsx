// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShortcutsButton, ShortcutsPopover } from './shortcuts-popover'
import { useJournalKeys, type JournalKeyOptions } from './use-journal-keys'

type Handlers = Pick<
  JournalKeyOptions,
  'onCloseSheet' | 'onToggleSelect' | 'onClearSearch' | 'onShowShortcuts' | 'onMove'
>
const handlers = (): Handlers => ({
  onCloseSheet: vi.fn(),
  onToggleSelect: vi.fn(),
  onClearSearch: vi.fn(),
  onShowShortcuts: vi.fn(),
})

function Harness({
  enabled = true,
  sheetOpen = false,
  hasSearch = false,
  on,
}: {
  enabled?: boolean
  sheetOpen?: boolean
  hasSearch?: boolean
  on: Handlers
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  const ledgerRef = useRef<HTMLTableElement>(null)
  useJournalKeys({ enabled, searchRef, ledgerRef, sheetOpen, hasSearch, ...on })
  return (
    <>
      <input ref={searchRef} aria-label="Search" defaultValue="tbs" />
      <button type="button">Outside</button>
      <div className="journal-toolbar" role="toolbar">
        <button type="button">Period filter</button>
      </div>
      <button type="button" className="journal-shortcuts-button">
        Shortcuts
      </button>
      <textarea aria-label="Note" />
      <select aria-label="Sort">
        <option>Date</option>
      </select>
      <div contentEditable suppressContentEditableWarning role="textbox" aria-label="Rich note" />
      <div role="dialog" aria-label="Other dialog">
        <button type="button">In dialog</button>
      </div>
      <table ref={ledgerRef}>
        <tbody>
          {[1, 2, 3].map((id) => (
            <tr key={id} role="row">
              <td>
                <button type="button" data-flight-row={id}>
                  Flight {id}
                </button>
              </td>
              <td>
                <input type="checkbox" aria-label={`Select ${id}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <aside aria-label="Flight details">
        <div className="jd-row" data-field="aircraft">
          <button type="button" className="jd-trigger" aria-label="Change aircraft">
            A320
          </button>
        </div>
        <div className="jd-row" data-field="seat">
          <button type="button" className="jd-trigger" aria-label="Change seat">
            12A
          </button>
        </div>
        <button type="button">Close details</button>
      </aside>
    </>
  )
}

const row = (id: number) => screen.getByRole('button', { name: `Flight ${id}` })
const press = (target: Element | Document, key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key, ...init })

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('useJournalKeys', () => {
  it('/ focuses and selects the search field', () => {
    render(<Harness on={handlers()} />)
    const search = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement
    press(screen.getByRole('button', { name: 'Period filter' }), '/')
    expect(search).toHaveFocus()
    expect(search.selectionStart).toBe(0)
    expect(search.selectionEnd).toBe(3)
  })

  it('j and k move between flight rows, clamped at the ends', () => {
    render(<Harness on={handlers()} />)
    row(1).focus()
    press(row(1), 'j')
    expect(row(2)).toHaveFocus()
    press(row(2), 'k')
    expect(row(1)).toHaveFocus()
    press(row(1), 'k')
    expect(row(1)).toHaveFocus()
    row(3).focus()
    press(row(3), 'j')
    expect(row(3)).toHaveFocus()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('reports the row it moved to, so the docked sheet can follow', () => {
    const on = { ...handlers(), onMove: vi.fn() }
    render(<Harness on={on} />)
    press(document.body, 'ArrowDown')
    press(row(1), 'ArrowDown')
    expect(on.onMove).toHaveBeenNthCalledWith(1, 1)
    expect(on.onMove).toHaveBeenNthCalledWith(2, 2)
  })

  it('keeps character shortcuts within the owning Journal controls', () => {
    const on = handlers()
    render(<Harness on={on} />)
    const outside = screen.getByRole('button', { name: 'Outside' })
    const toolbar = screen.getByRole('button', { name: 'Period filter' })
    const sheetField = screen.getByRole('button', { name: 'Change aircraft' })
    for (const target of [document.body, outside, sheetField]) {
      if (target instanceof HTMLElement && target !== document.body) target.focus()
      for (const key of ['j', 'k', '/', '?']) press(target, key)
      expect(row(1)).not.toHaveFocus()
      expect(row(3)).not.toHaveFocus()
      expect(screen.getByRole('textbox', { name: 'Search' })).not.toHaveFocus()
    }
    expect(on.onShowShortcuts).not.toHaveBeenCalled()
    toolbar.focus()
    press(toolbar, 'j')
    press(toolbar, 'k')
    expect(toolbar).toHaveFocus()
    press(toolbar, '?', { shiftKey: true })
    expect(on.onShowShortcuts).toHaveBeenCalledTimes(1)
    const shortcuts = screen.getByRole('button', { name: 'Shortcuts' })
    shortcuts.focus()
    press(shortcuts, '/')
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()
  })

  it('arrows move between rows from the body or the ledger, but not from other widgets', () => {
    render(<Harness on={handlers()} />)
    press(document.body, 'ArrowDown')
    expect(row(1)).toHaveFocus()
    press(row(1), 'ArrowDown')
    expect(row(2)).toHaveFocus()
    press(row(2), 'ArrowUp')
    expect(row(1)).toHaveFocus()
    const checkbox = screen.getByRole('checkbox', { name: 'Select 1' })
    checkbox.focus()
    press(checkbox, 'ArrowDown')
    expect(row(2)).toHaveFocus()
    const trigger = screen.getByRole('button', { name: 'Change aircraft' })
    trigger.focus()
    press(trigger, 'ArrowDown')
    expect(trigger).toHaveFocus()
    const outside = screen.getByRole('button', { name: 'Outside' })
    outside.focus()
    press(outside, 'ArrowUp')
    expect(outside).toHaveFocus()
  })

  it('x toggles the focused row id and ignores other focus', () => {
    const on = handlers()
    render(<Harness on={on} />)
    press(row(2), 'x')
    expect(on.onToggleSelect).toHaveBeenCalledExactlyOnceWith(2)
    press(screen.getByRole('button', { name: 'Outside' }), 'x')
    expect(on.onToggleSelect).toHaveBeenCalledTimes(1)
  })

  it('e clicks the trigger of the focused sheet row', () => {
    render(<Harness on={handlers()} />)
    const clicked = vi.fn()
    const seat = screen.getByRole('button', { name: 'Change seat' })
    seat.addEventListener('click', clicked)
    const aircraft = screen.getByRole('button', { name: 'Change aircraft' })
    aircraft.addEventListener('click', clicked)
    press(seat, 'e')
    expect(clicked).toHaveBeenCalledTimes(1)
    expect(clicked.mock.calls[0][0].target).toBe(seat)
    press(screen.getByRole('button', { name: 'Close details' }), 'e')
    press(row(1), 'e')
    expect(clicked).toHaveBeenCalledTimes(1)
  })

  it('Escape closes the sheet when it is open', () => {
    const on = handlers()
    render(<Harness on={on} sheetOpen hasSearch />)
    press(row(1), 'Escape')
    expect(on.onCloseSheet).toHaveBeenCalledTimes(1)
    expect(on.onClearSearch).not.toHaveBeenCalled()
  })

  it('Escape clears the search when the sheet is closed', () => {
    const on = handlers()
    render(<Harness on={on} hasSearch />)
    press(row(1), 'Escape')
    expect(on.onClearSearch).toHaveBeenCalledTimes(1)
    expect(on.onCloseSheet).not.toHaveBeenCalled()
  })

  it('Escape does nothing when there is nothing to close or clear, or when already handled', () => {
    const on = handlers()
    const { rerender } = render(<Harness on={on} />)
    press(row(1), 'Escape')
    rerender(<Harness on={on} sheetOpen />)
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    const handled = (e: Event) => e.preventDefault()
    row(1).addEventListener('keydown', handled)
    row(1).dispatchEvent(event)
    expect(on.onCloseSheet).not.toHaveBeenCalled()
    expect(on.onClearSearch).not.toHaveBeenCalled()
  })

  it('Escape in the search field closes the sheet only when the field passed it through; other fields keep their own', () => {
    const on = handlers()
    render(<Harness on={on} sheetOpen />)
    press(screen.getByRole('textbox', { name: 'Search' }), 'Escape')
    expect(on.onCloseSheet).toHaveBeenCalledTimes(1)
    press(screen.getByRole('textbox', { name: 'Note' }), 'Escape')
    expect(on.onCloseSheet).toHaveBeenCalledTimes(1)
  })

  it('? shows the shortcuts', () => {
    const on = handlers()
    render(<Harness on={on} />)
    press(row(1), '?', { shiftKey: true })
    expect(on.onShowShortcuts).toHaveBeenCalledTimes(1)
  })

  it('keys typed inside an input, textarea, select or contenteditable do nothing', () => {
    const on = handlers()
    render(<Harness on={on} sheetOpen hasSearch />)
    const search = screen.getByRole('textbox', { name: 'Search' })
    for (const target of [
      search,
      screen.getByRole('textbox', { name: 'Note' }),
      screen.getByRole('combobox', { name: 'Sort' }),
      screen.getByRole('textbox', { name: 'Rich note' }),
    ]) {
      for (const key of ['/', 'j', 'k', 'x', 'e', 'ArrowDown']) press(target, key)
      press(target, '?', { shiftKey: true })
    }
    expect(search).not.toHaveFocus()
    expect(row(1)).not.toHaveFocus()
    expect(on.onToggleSelect).not.toHaveBeenCalled()
    expect(on.onShowShortcuts).not.toHaveBeenCalled()
  })

  it('ignores keys with Ctrl, Meta or Alt held, and Shift on anything but ?', () => {
    const on = handlers()
    render(<Harness on={on} sheetOpen hasSearch />)
    const search = screen.getByRole('textbox', { name: 'Search' })
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      press(row(1), 'x', modifier)
      press(row(1), 'j', modifier)
      press(row(1), '/', modifier)
      press(row(1), 'Escape', modifier)
      press(row(1), '?', { shiftKey: true, ...modifier })
    }
    press(row(1), 'ArrowDown', { shiftKey: true })
    press(row(1), 'X', { shiftKey: true })
    expect(on.onToggleSelect).not.toHaveBeenCalled()
    expect(on.onCloseSheet).not.toHaveBeenCalled()
    expect(on.onShowShortcuts).not.toHaveBeenCalled()
    expect(search).not.toHaveFocus()
    expect(row(1)).not.toHaveFocus()
  })

  it('ignores keys during IME composition', () => {
    const on = handlers()
    render(<Harness on={on} />)
    press(row(1), 'x', { isComposing: true })
    expect(on.onToggleSelect).not.toHaveBeenCalled()
  })

  it('does nothing when disabled, and starts working when enabled', () => {
    const on = handlers()
    const { rerender } = render(<Harness on={on} enabled={false} sheetOpen />)
    press(row(1), 'x')
    press(row(1), 'Escape')
    press(document.body, '?', { shiftKey: true })
    expect(on.onToggleSelect).not.toHaveBeenCalled()
    expect(on.onCloseSheet).not.toHaveBeenCalled()
    expect(on.onShowShortcuts).not.toHaveBeenCalled()
    rerender(<Harness on={on} enabled sheetOpen />)
    press(row(1), 'x')
    expect(on.onToggleSelect).toHaveBeenCalledWith(1)
  })

  it('does not hijack j/k inside a dialog or menu', () => {
    render(<Harness on={handlers()} />)
    press(screen.getByRole('button', { name: 'In dialog' }), 'j')
    expect(row(1)).not.toHaveFocus()
  })
})

describe('ShortcutsPopover', () => {
  function Popover({ locale }: { locale: 'en' | 'ru' }) {
    const [open, setOpen] = useState(false)
    const anchor = useRef<HTMLButtonElement>(null)
    return (
      <>
        <ShortcutsButton ref={anchor} locale={locale} onClick={() => setOpen(true)} />
        <ShortcutsPopover open={open} onOpenChange={setOpen} locale={locale} anchor={anchor} />
      </>
    )
  }

  it.each([
    ['en', 'Keyboard shortcuts', 'Move between flights'],
    ['ru', 'Сочетания клавиш', 'Перейти к перелёту'],
  ] as const)('opens and closes the shortcuts in %s', async (locale, title, label) => {
    const user = userEvent.setup()
    render(<Popover locale={locale} />)
    await user.click(screen.getByRole('button', { name: title }))
    const dialog = await screen.findByRole('dialog', { name: title })
    expect(within(dialog).getByText(label)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

it('does not move focus out of another modal with search, help or Escape', () => {
  const on = handlers()
  render(<Harness on={on} sheetOpen hasSearch />)
  const target = screen.getByRole('button', { name: 'In dialog' })
  target.focus()
  for (const key of ['/', '?', 'Escape']) fireEvent.keyDown(target, { key })
  expect(target).toHaveFocus()
  expect(on.onShowShortcuts).not.toHaveBeenCalled()
  expect(on.onCloseSheet).not.toHaveBeenCalled()
  expect(on.onClearSearch).not.toHaveBeenCalled()
})
