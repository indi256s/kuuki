// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { InlineEdit, type InlineEditOutcome } from './inline-edit'

function Editor({ onSave }: { onSave: (draft: string) => Promise<InlineEditOutcome> }) {
  const [editing, setEditing] = useState(false)
  return (
    <InlineEdit
      value="TK381"
      display="TK381"
      triggerLabel="Change flight number"
      copy={{
        group: 'Flight number',
        save: 'Save',
        cancel: 'Cancel',
        saving: 'Saving',
        hint: 'Enter saves, Escape cancels.',
        unknown: 'Save could not be confirmed.',
      }}
      editing={editing}
      onEditingChange={setEditing}
      onSave={onSave}
      renderField={({ value, onChange, inputRef, disabled }) => (
        <input
          aria-label="Flight number"
          ref={inputRef}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    />
  )
}

it.each([{ isComposing: true }, { keyCode: 229 }])(
  'keeps IME confirmation in an untouched or changed editor until deliberate Enter (%j)',
  async (composition) => {
    const save = vi.fn(async (): Promise<InlineEditOutcome> => ({ status: 'saved' }))
    render(<Editor onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change flight number' }))
    const input = screen.getByRole('textbox', { name: 'Flight number' })
    fireEvent.keyDown(input, { key: 'Enter', ...composition })
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'TK382' } })
    fireEvent.keyDown(input, { key: 'Enter', ...composition })
    expect(save).not.toHaveBeenCalled()
    expect(input).toHaveValue('TK382')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(save).toHaveBeenCalledExactlyOnceWith('TK382')
  },
)
