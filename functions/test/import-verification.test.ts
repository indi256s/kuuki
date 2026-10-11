import { describe, expect, it, vi } from 'vitest'
import { verifyFlights } from '../api/import/_verify'
import type { ExtractedFlight, ParseRequest } from '../api/import/_shared'

const flight: ExtractedFlight = {
  date: '2024-03-15',
  origin: 'JFK',
  destination: 'LAX',
  airline_iata: 'AA',
  confidence: 1,
}
const source: ParseRequest = {
  type: 'text',
  content: 'The complete source, including later changes.',
}
type Input = {
  state: { source: string; candidates: { index: number }[] }
  questions: Record<string, unknown>
  images?: string[]
}
const response = (input: Input) => ({
  answers: Object.fromEntries(
    Object.keys(input.questions).map((id) => [id, { type: 'noul', noul: 0.5 }]),
  ),
})
const binding = (run: (...args: any[]) => any) => ({ run }) as unknown as Ai
const signal = () => new AbortController().signal

function png(width = 1, height = 1) {
  const bytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH2kAAAAASUVORK5CYII=',
    ),
    (c) => c.charCodeAt(0),
  )
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return btoa(String.fromCharCode(...bytes))
}

// Synthetic image headers exercise admission; image decoding belongs to the provider.
function imageHeader(
  format: 'jpeg' | 'webp-vp8' | 'webp-vp8l' | 'webp-vp8x',
  width = 1,
  height = 1,
) {
  const bytes = new Uint8Array(format === 'jpeg' ? 15 : 30)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) =>
    bytes.set(
      Array.from(text, (c) => c.charCodeAt(0)),
      offset,
    )
  if (format === 'jpeg') {
    bytes.set([255, 216, 255, 192, 0, 9, 8], 0)
    view.setUint16(7, height)
    view.setUint16(9, width)
    bytes.set([255, 217], 13)
  } else {
    ascii(0, 'RIFF')
    view.setUint32(4, 22, true)
    ascii(8, 'WEBP')
    ascii(12, format === 'webp-vp8' ? 'VP8 ' : format === 'webp-vp8l' ? 'VP8L' : 'VP8X')
    view.setUint32(16, 10, true)
    if (format === 'webp-vp8') {
      ascii(23, '\x9d\x01\x2a')
      view.setUint16(26, width, true)
      view.setUint16(28, height, true)
    } else if (format === 'webp-vp8l') {
      bytes[20] = 47
      view.setUint32(21, (width - 1) | ((height - 1) << 14), true)
    } else {
      view.setUint32(24, width - 1, true)
      bytes[27] = (height - 1) & 255
      bytes[28] = ((height - 1) >> 8) & 255
      bytes[29] = ((height - 1) >> 16) & 255
    }
  }
  return btoa(String.fromCharCode(...bytes))
}

describe('verifyFlights', () => {
  it('requires all nine valid claims at or above 0.5 without mutating candidates', async () => {
    const flights = Array.from({ length: 4 }, () => ({ ...flight }))
    const before = structuredClone(flights)
    const run = vi.fn(async (_model: string, input: Input) => {
      const result = response(input)
      for (const { index } of input.state.candidates) {
        if (index === 1) result.answers[`row_${index}_status`].noul = 0.49
        if (index === 2) result.answers[`row_${index}_ownership`].noul = 0.49
        if (index === 3) result.answers[`row_${index}_arrival_time`].noul = 0.49
      }
      return result
    })
    expect(await verifyFlights(binding(run), source, flights, signal())).toEqual([
      'verified',
      'disagreed',
      'disagreed',
      'disagreed',
    ])
    expect(flights).toEqual(before)
  })

  it.each([
    ['missing answer', undefined],
    ['wrong type', { type: 'boolean', noul: 1 }],
    ['string probability', { type: 'noul', noul: '1' }],
    ['negative probability', { type: 'noul', noul: -0.1 }],
    ['probability above one', { type: 'noul', noul: 1.1 }],
    ['nonfinite probability', { type: 'noul', noul: NaN }],
  ])('fails closed on %s while preserving a valid adjacent row', async (_label, answer) => {
    const ai = binding(async (_model: string, input: Input) => {
      const result = response(input)
      result.answers.row_0_date = answer as any
      return result
    })
    expect(await verifyFlights(ai, source, [flight, flight], signal())).toEqual([
      'failed',
      'verified',
    ])
  })

  it.each([null, {}, { answers: [] }, { success: false, answers: {} }])(
    'fails closed on malformed provider response %j',
    async (result) => {
      expect(
        await verifyFlights(
          binding(async () => result),
          source,
          [flight],
          signal(),
        ),
      ).toEqual(['failed'])
    },
  )

  it('fails closed without a binding or when the provider throws', async () => {
    expect(await verifyFlights(undefined, source, [flight], signal())).toEqual(['failed'])
    expect(
      await verifyFlights(
        binding(async () => {
          throw new Error('private upstream error')
        }),
        source,
        [flight],
        signal(),
      ),
    ).toEqual(['failed'])
  })

  it('batches all rows with the full source and bounded questions and UTF-8 context', async () => {
    const flights = Array.from({ length: 8 }, () => ({ ...flight }))
    const fullSource = { ...source, content: 'Документ完整\n'.repeat(150) + source.content }
    let seen = 0
    const run = vi.fn(async (model: string, input: Input, options: { signal: AbortSignal }) => {
      expect(model).toBe('@cf/cloudflare/clef')
      expect(options.signal.aborted).toBe(false)
      expect(input.state.source).toBe(fullSource.content)
      expect(input.state.candidates.length).toBeLessThanOrEqual(7)
      expect(Object.keys(input.questions)).toHaveLength(input.state.candidates.length * 9)
      expect(Object.keys(input.questions).length).toBeLessThanOrEqual(63)
      expect(
        new TextEncoder().encode(JSON.stringify({ state: input.state, questions: input.questions }))
          .length,
      ).toBeLessThanOrEqual(32 * 1024)
      seen += input.state.candidates.length
      return response(input)
    })
    expect(await verifyFlights(binding(run), fullSource, flights, signal())).toEqual(
      Array(8).fill('verified'),
    )
    expect(run.mock.calls.length).toBeGreaterThan(1)
    expect(seen).toBe(8)
  })

  it('preserves successful batches and fails remaining rows when an ignoring backend is aborted', async () => {
    const controller = new AbortController()
    let succeeded = 0
    const run = vi.fn(async (_model: string, input: Input) => {
      if (!succeeded) {
        succeeded = input.state.candidates.length
        return response(input)
      }
      controller.abort()
      return new Promise(() => {})
    })
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const result = await verifyFlights(
      binding(run),
      source,
      Array(8).fill(flight),
      controller.signal,
    )
    expect(result).toEqual([
      ...Array(succeeded).fill('verified'),
      ...Array(8 - succeeded).fill('failed'),
    ])
    expect(run).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledTimes(2)
  })

  it('does not call the backend when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const run = vi.fn()
    expect(await verifyFlights(binding(run), source, [flight], controller.signal)).toEqual([
      'failed',
    ])
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    { type: 'pdf' as const, content: 'JVBERg==' },
    { type: 'image' as const, content: 'R0lGODlhAQABAIAAAAUEBA==' },
    { type: 'image' as const, content: 'invalid base64' },
    { type: 'image' as const, content: png(5000, 5000) },
    ...(['jpeg', 'webp-vp8', 'webp-vp8l', 'webp-vp8x'] as const).map((format) => ({
      type: 'image' as const,
      content: imageHeader(format, 5000, 5000),
    })),
    { type: 'image' as const, content: 'AAAA'.repeat(Math.ceil((4 * 1024 * 1024) / 3) + 1) },
  ])('rejects unsupported images or PDFs without a provider request', async (document) => {
    const run = vi.fn()
    expect(await verifyFlights(binding(run), document, [flight], signal())).toEqual(['unsupported'])
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    ['image/png', png()],
    ['image/jpeg', imageHeader('jpeg')],
    ...(['webp-vp8', 'webp-vp8l', 'webp-vp8x'] as const).map((format) => [
      'image/webp',
      imageHeader(format),
    ]),
  ])('sends the complete admitted %s attachment', async (mime, content) => {
    const run = vi.fn(async (_model: string, input: Input) => {
      expect(input.images).toEqual([`data:${mime};base64,${content}`])
      expect(input.state.source).not.toContain(content)
      return response(input)
    })
    expect(
      await verifyFlights(binding(run), { type: 'image', content }, [flight], signal()),
    ).toEqual(['verified'])
  })

  it('rejects an oversized complete source instead of slicing evidence', async () => {
    const run = vi.fn()
    expect(
      await verifyFlights(
        binding(run),
        { type: 'text', content: '文'.repeat(12000) },
        [flight],
        signal(),
      ),
    ).toEqual(['unsupported'])
    expect(run).not.toHaveBeenCalled()
  })
})
