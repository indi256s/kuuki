// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileDropzone } from './file-dropzone'

const files = [
  new File(['a'], 'a.webp', { type: 'image/webp' }),
  new File(['b'], 'b.pdf', { type: 'application/pdf' }),
]
const input = () => document.querySelector<HTMLInputElement>('input[type=file]')!

describe('FileDropzone', () => {
  it('hands every picked and dropped file to the caller in multiple mode, WebP included', () => {
    const onFilesChange = vi.fn()
    const { container } = render(
      <FileDropzone
        multiple
        accept="image/webp,application/pdf"
        disabled={false}
        locale="en"
        onFilesChange={onFilesChange}
      />,
    )
    expect(input().multiple).toBe(true)
    expect(input().accept).toContain('image/webp')
    fireEvent.change(input(), { target: { files } })
    expect(onFilesChange).toHaveBeenLastCalledWith(files)
    fireEvent.drop(container.firstElementChild!.firstElementChild!, {
      dataTransfer: { files, types: ['Files'] },
    })
    expect(onFilesChange).toHaveBeenLastCalledWith(files)
  })

  it('still takes only the first file by default and keeps the paste hint', () => {
    const onFilesChange = vi.fn()
    render(
      <FileDropzone
        accept="image/png"
        disabled={false}
        locale="en"
        onFilesChange={onFilesChange}
      />,
    )
    expect(input().multiple).toBe(false)
    fireEvent.change(input(), { target: { files } })
    expect(onFilesChange).toHaveBeenLastCalledWith([files[0]])
    expect(screen.getByText(/Paste a screenshot/)).toBeTruthy()
  })

  it('does not listen for pastes when told not to', () => {
    const onFilesChange = vi.fn()
    render(
      <FileDropzone
        paste={false}
        accept="image/png"
        disabled={false}
        locale="en"
        onFilesChange={onFilesChange}
      />,
    )
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [new File(['x'], 'p.png', { type: 'image/png' })], items: [] },
    })
    document.dispatchEvent(event)
    expect(onFilesChange).not.toHaveBeenCalled()
  })
})
