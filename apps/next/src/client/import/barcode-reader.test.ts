import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prepareZXingModule as prepareWriter, writeBarcode } from 'zxing-wasm/writer'
import type { ZXingModuleOverrides } from 'zxing-wasm/reader'
import { readBoardingPass, type Rasterize, type ReaderInput } from './barcode-reader'

const FIRST_LEG = 'ABC123 YULFRAAC 0834 326J001A0025 100'
const SECOND_LEG = 'ABC123 FRASINSQ 0025 327J002B0030 100'
const SINGLE = `M1DESMARAIS/LUC       E${FIRST_LEG}`
const MULTI = `M2DESMARAIS/LUC       E${FIRST_LEG}${SECOND_LEG}`

const YUL_FRA = {
  origin: 'YUL',
  destination: 'FRA',
  airline: 'AC',
  flightNumber: '834',
  dayOfYear: 326,
}
const FRA_SIN = {
  origin: 'FRA',
  destination: 'SIN',
  airline: 'SQ',
  flightNumber: '25',
  dayOfYear: 327,
}

const require = createRequire(import.meta.url)
const wasmBytes = (specifier: string) => {
  const bytes = new Uint8Array(readFileSync(require.resolve(specifier)))
  return bytes.buffer as ArrayBuffer
}

let readerWasm: ZXingModuleOverrides

beforeAll(() => {
  readerWasm = { wasmBinary: wasmBytes('zxing-wasm/reader/zxing_reader.wasm') }
  prepareWriter({ overrides: { wasmBinary: wasmBytes('zxing-wasm/writer/zxing_writer.wasm') } })
})

async function barcode(text: string, format: 'PDF417' | 'Aztec' | 'QRCode') {
  const { image, error } = await writeBarcode(text, { format, scale: 3 })
  if (!image) throw new Error(error)
  return new File([image], 'pass.png', { type: 'image/png' })
}
const blank = (side = 200) =>
  ({
    data: new Uint8ClampedArray(side * side * 4).fill(255),
    width: side,
    height: side,
  }) as ImageData

// Stands in for canvas and pdf.js, which jsdom and node do not have: the file itself is what the decoder reads.
const asIs: Rasterize = async (file) => [file]
const read = (file: File, rasterize: Rasterize = asIs, signal?: AbortSignal) =>
  readBoardingPass(file, { rasterize, signal, moduleOverrides: readerWasm })

describe('readBoardingPass', () => {
  it('reads the leg from a PDF417 pass and returns nothing else from the barcode', async () => {
    expect(await read(await barcode(SINGLE, 'PDF417'))).toEqual({
      kind: 'legs',
      legs: [YUL_FRA],
      incomplete: false,
    })
  })

  it('reads an Aztec pass', async () => {
    expect(await read(await barcode(SINGLE, 'Aztec'))).toEqual({
      kind: 'legs',
      legs: [YUL_FRA],
      incomplete: false,
    })
  })

  it('reads every leg of a multi-leg pass in order', async () => {
    expect(await read(await barcode(MULTI, 'PDF417'))).toEqual({
      kind: 'legs',
      legs: [YUL_FRA, FRA_SIN],
      incomplete: false,
    })
  })

  it('counts one barcode shown twice (two pages, two renderings) once', async () => {
    const file = await barcode(SINGLE, 'PDF417')
    const twice: Rasterize = async () => [file, file]

    expect(await read(file, twice)).toMatchObject({ kind: 'legs', legs: [YUL_FRA] })
  })

  it('tells a barcode that is not a boarding pass from a file without one', async () => {
    expect(await read(await barcode('https://example.com/tickets/42', 'QRCode'))).toEqual({
      kind: 'none',
      reason: 'not-boarding-pass',
    })

    const pixels: Rasterize = async () => [blank()]
    expect(await read(new File([], 'blank.png', { type: 'image/png' }), pixels)).toEqual({
      kind: 'none',
      reason: 'no-barcode',
    })
  })

  it('retries an image once at a larger size, and a PDF not at all', async () => {
    const sizes: number[] = []
    const empty: Rasterize = async (_file, maxSide) => {
      sizes.push(maxSide)
      return [blank()]
    }
    await read(new File([], 'a.png', { type: 'image/png' }), empty)
    await read(new File([], 'a.pdf', { type: 'application/pdf' }), empty)

    expect(sizes).toEqual([2000, 3000, 2000])
  })

  it('finds a barcode that only decodes at the larger size', async () => {
    const pass = await barcode(SINGLE, 'PDF417')
    const onlyLarge: Rasterize = async (_file, maxSide): Promise<ReaderInput[]> =>
      maxSide === 3000 ? [pass] : [blank()]

    expect(await read(new File([], 'a.jpg', { type: 'image/jpeg' }), onlyLarge)).toMatchObject({
      kind: 'legs',
      legs: [YUL_FRA],
    })
  })

  it('refuses types it cannot rasterize without doing any work', async () => {
    const rasterize = vi.fn(asIs)

    expect(await read(new File(['x'], 'pass.heic', { type: 'image/heic' }), rasterize)).toEqual({
      kind: 'none',
      reason: 'unsupported',
    })
    expect(rasterize).not.toHaveBeenCalled()
  })

  it('falls back instead of throwing when the rasterizer breaks', async () => {
    const broken: Rasterize = async () => {
      throw new Error('canvas exploded')
    }

    expect(await read(new File([], 'a.png', { type: 'image/png' }), broken)).toEqual({
      kind: 'none',
      reason: 'failed',
    })
  })

  it('stops with the abort reason and ignores a pass that was decoded after aborting', async () => {
    const file = await barcode(SINGLE, 'PDF417')
    const rasterize = vi.fn(asIs)

    const early = new AbortController()
    early.abort()
    await expect(read(file, rasterize, early.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(rasterize).not.toHaveBeenCalled()

    const late = new AbortController()
    const abortWhileRasterizing: Rasterize = async (picked) => {
      late.abort()
      return [picked]
    }
    await expect(read(file, abortWhileRasterizing, late.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})
