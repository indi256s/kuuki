// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SourceStep, MAX_FILE_BYTES } from './source-step'

function image(name = 'screenshot.png', type = 'image/png', size = 3) {
  const file = new File(['png'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new Uint8Array([112, 110, 103]).buffer,
    configurable: true,
  })
  return file
}
function paste(files: File[], target: Node = document.body) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      files,
      items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
    },
  })
  fireEvent(target, event)
  return event
}

describe('import source clipboard and file selection', () => {
  it('pastes a screenshot from the page, retains the retry operation, and replaces it with a new source', async () => {
    const onSubmit = vi.fn()
    render(<SourceStep locale="en" busy={false} initialMode={null} onSubmit={onSubmit} />)
    expect(paste([image()]).defaultPrevented).toBe(true)
    expect(screen.getByText('screenshot.png')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'image',
      content: 'cG5n',
      sourceLabel: 'screenshot.png',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(onSubmit.mock.calls[1][1]).toBe(onSubmit.mock.calls[0][1])
    paste([image('second.jpg', 'image/jpeg')])
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3))
    expect(onSubmit.mock.calls[2][0].sourceLabel).toBe('second.jpg')
    expect(onSubmit.mock.calls[2][1]).not.toBe(onSubmit.mock.calls[0][1])
    fireEvent.click(screen.getByRole('radio', { name: 'Paste text' }))
    fireEvent.change(screen.getByLabelText('Booking or itinerary text'), {
      target: { value: 'JFK → BOS' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    expect(onSubmit.mock.calls[3][0]).toEqual({ type: 'text', content: 'JFK → BOS' })
    fireEvent.click(screen.getByRole('radio', { name: 'File' }))
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(5))
    expect(onSubmit.mock.calls[4][0].sourceLabel).toBe('second.jpg')
    expect(onSubmit.mock.calls[4][1]).not.toBe(onSubmit.mock.calls[3][1])
  })

  it.each([
    ['image/webp', 3, /Use a PDF, PNG or JPEG/],
    ['image/png', MAX_FILE_BYTES + 1, /over 10 MB/],
  ])('rejects pasted %s at %s bytes through existing validation', (type, size, message) => {
    const onSubmit = vi.fn()
    render(<SourceStep locale="en" busy={false} initialMode={null} onSubmit={onSubmit} />)
    paste([image('clipboard', type, size)])
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('never submits a removed source after its in-flight file read completes', async () => {
    let finishRead!: (value: ArrayBuffer) => void
    const file = image()
    Object.defineProperty(file, 'arrayBuffer', {
      value: () =>
        new Promise<ArrayBuffer>((resolve) => {
          finishRead = resolve
        }),
      configurable: true,
    })
    const onSubmit = vi.fn()
    render(<SourceStep locale="en" busy={false} initialMode={null} onSubmit={onSubmit} />)
    paste([file])
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove screenshot.png' }))
    await act(async () => {
      finishRead(new Uint8Array([112, 110, 103]).buffer)
    })
    expect(onSubmit).not.toHaveBeenCalled()
    paste([image('replacement.png')])
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ sourceLabel: 'replacement.png' }),
        expect.any(String),
      ),
    )
  })

  it('leaves ordinary paste and editable-field paste alone, and stops listening when busy or unmounted', () => {
    const props = { locale: 'en' as const, busy: false, initialMode: null, onSubmit: vi.fn() }
    const { rerender, unmount } = render(<SourceStep {...props} />)
    expect(paste([]).defaultPrevented).toBe(false)
    fireEvent.click(screen.getByText('How to export flights from your email'))
    expect(paste([image()], screen.getByLabelText('Prompt text')).defaultPrevented).toBe(false)
    rerender(<SourceStep {...props} busy />)
    expect(paste([image()]).defaultPrevented).toBe(false)
    unmount()
    expect(paste([image()]).defaultPrevented).toBe(false)
  })

  it('takes one dropped document and lets the member remove it before submission', () => {
    render(<SourceStep locale="en" busy={false} initialMode={null} onSubmit={vi.fn()} />)
    fireEvent.drop(screen.getByRole('button', { name: /Choose a file/ }), {
      dataTransfer: { files: [image('first.png'), image('second.png')], types: ['Files'] },
    })
    expect(screen.getByText('first.png')).toBeInTheDocument()
    expect(screen.queryByText('second.png')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove first.png' }))
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a file first.')
  })
})
