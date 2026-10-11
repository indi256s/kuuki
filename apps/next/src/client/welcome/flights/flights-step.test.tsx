// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, snapshot } from '../../import/fixtures'
import { FlightsStep } from './flights-step'

const m = vi.hoisted(() => ({
  submit: vi.fn(),
  readBatch: vi.fn(),
  connect: vi.fn(),
}))
vi.mock('../../import/import-api', () => ({ submitSource: m.submit, readBatch: m.readBatch }))
vi.mock('../../import/import-events', () => ({ connectEvents: m.connect }))
vi.mock('../../capture/flight-form', () => ({ FlightForm: () => <p>manual form</p> }))

const V2 = 'KUUKI FLIGHTS v2\n2024-03-15 | JFK → LAX | American Airlines AA 123'

function setup(props: Partial<Parameters<typeof FlightsStep>[0]> = {}) {
  const handlers = {
    onBatch: vi.fn(),
    onManual: vi.fn(),
    onReview: vi.fn(),
    onManualSaved: vi.fn(),
    onFound: vi.fn(),
    onSkip: vi.fn(async () => {}),
  }
  render(
    <>
      <input aria-label="elsewhere" />
      <FlightsStep
        locale="en"
        ownerId="a"
        headingRef={createRef<HTMLHeadingElement>()}
        batch={null}
        manual={false}
        {...handlers}
        {...props}
      />
    </>,
  )
  return handlers
}

const pasteOn = (target: Element | Document, text: string) =>
  fireEvent.paste(target, { clipboardData: { getData: () => text, files: [] } })

beforeEach(() => {
  m.submit.mockReset().mockResolvedValue({ batchId: 'b1' })
  m.readBatch
    .mockReset()
    .mockResolvedValue(snapshot([], { status: 'processing', stage: 'recognizing' }))
  m.connect.mockReset().mockReturnValue(new Promise(() => {}))
})
afterEach(cleanup)

describe('FlightsStep paste and drop', () => {
  it('submits text pasted anywhere on the page once, and ignores a paste into another field', async () => {
    setup()
    pasteOn(screen.getByLabelText('elsewhere'), V2)
    expect(m.submit).not.toHaveBeenCalled()
    pasteOn(document, V2)
    await waitFor(() => expect(m.submit).toHaveBeenCalledTimes(1))
    expect(m.submit.mock.calls[0][0]).toEqual({ type: 'text', content: V2 })
    expect(m.submit.mock.calls[0][1]).toEqual(expect.any(String))
  })

  it('shows the type error for a dropped .docx and sends no request', async () => {
    setup()
    const file = new File(['x'], 'Boarding-pass.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    fireEvent.drop(document, { dataTransfer: { files: [file], types: ['Files'] } })
    expect(await screen.findByText(/can’t read this kind of file/)).toBeInTheDocument()
    expect(screen.getByText('Boarding-pass.docx')).toBeInTheDocument()
    expect(m.submit).not.toHaveBeenCalled()
  })
})

describe('FlightsStep close-tab note', () => {
  it('shows it and opens the event stream when the job worker accepts (202)', async () => {
    setup()
    pasteOn(document, V2)
    expect(await screen.findByText(/You can close this tab/)).toBeInTheDocument()
    await waitFor(() => expect(m.connect).toHaveBeenCalled())
  })

  it('shows neither when the submission answers with a snapshot (201)', async () => {
    m.submit.mockResolvedValue(snapshot([draft({ id: 'a' })]))
    const { onReview } = setup()
    pasteOn(document, V2)
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('b1'))
    expect(screen.queryByText(/You can close this tab/)).not.toBeInTheDocument()
    expect(m.connect).not.toHaveBeenCalled()
  })
})

describe('FlightsStep arriving on a ready batch (17.13)', () => {
  it('does not move on by itself; the button reviews', async () => {
    m.readBatch.mockResolvedValue(snapshot([draft({ id: 'a' }), draft({ id: 'b' })], { id: 'b1' }))
    const { onReview } = setup({ batch: 'b1' })
    expect(await screen.findByText('Your flights are read')).toBeInTheDocument()
    expect(onReview).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Review 2 flights' }))
    expect(onReview).toHaveBeenCalledWith('b1')
    expect(screen.getByRole('button', { name: 'I’ll do this later' })).toBeInTheDocument()
  })
})

describe('FlightsStep clipboard denial', () => {
  it('hides the paste button on desktop after a denial and shows the key hint', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async () => {}),
        read: vi.fn(async () => {
          throw new DOMException('no', 'NotAllowedError')
        }),
      },
      configurable: true,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Paste from clipboard' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Paste from clipboard' })).toBeNull(),
    )
    expect(document.querySelector('kbd.flights-key')).not.toBeNull()
  })
})

describe('FlightsStep states', () => {
  it('says to try again in a while on a rate limit, without a countdown', async () => {
    m.submit.mockRejectedValue(Object.assign(new Error('limited'), { status: 429 }))
    setup()
    pasteOn(document, V2)
    expect(await screen.findByText(/reached that for now/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again in a while' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Copy again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I’ll do this later' })).toBeInTheDocument()
  })

  it('keeps the step and says so when "I’ll do this later" fails', async () => {
    const onSkip = vi.fn().mockRejectedValue(new Error('down'))
    setup({ onSkip })
    fireEvent.click(screen.getByRole('button', { name: 'I’ll do this later' }))
    expect(await screen.findByText(/couldn’t wrap up/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

describe('FlightsStep silent clipboard read (O16)', () => {
  const clipboard = (text: string) => {
    const readText = vi.fn(async () => text)
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true })
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn(async () => ({ state: 'granted' })) },
      configurable: true,
    })
    return readText
  }

  it('does nothing when the granted clipboard text lacks the v2 header', async () => {
    const readText = clipboard('Preheat the oven to 180 °C.')
    setup()
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(readText).toHaveBeenCalled())
    expect(m.submit).not.toHaveBeenCalled()
  })

  it('submits when the text starts with the v2 header, even inside a code fence', async () => {
    clipboard('```text\n' + V2 + '\n```')
    setup()
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(m.submit).toHaveBeenCalledTimes(1))
  })
})
