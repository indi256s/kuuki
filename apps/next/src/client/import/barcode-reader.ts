// Reads a boarding pass barcode from a chosen file entirely in the browser. The decoder (zxing-wasm, self-hosted wasm)
// and pdf.js load only once a file is chosen. Decoded text stays in a dedicated worker: it goes straight
// into the BCBP projection and is never logged, stored or returned, so only allowlisted legs leave this module.
import type { ZXingModuleOverrides } from 'zxing-wasm/reader'
import type { RenderTask } from 'pdfjs-dist'
import type { Leg } from './bcbp'
import type { DecodeRequest } from './barcode-decode'

export type NoneReason = 'no-barcode' | 'not-boarding-pass' | 'unsupported' | 'failed'
export type ReadOutcome =
  | { kind: 'legs'; legs: Leg[]; incomplete: boolean }
  | { kind: 'none'; reason: NoneReason }

/** What the decoder reads: pixels we drew, or the untouched file when the browser cannot draw it for us. */
export type ReaderInput = Blob | ImageData
/** Turns the file into decoder inputs no larger than `maxSide` pixels on the longest side. */
export type Rasterize = (
  file: Blob,
  maxSide: number,
  signal?: AbortSignal,
) => Promise<ReaderInput[]>

export interface ReadOptions {
  /** Aborting rejects with the signal's reason and stops further work; the caller ignores any late result. */
  signal?: AbortSignal
  /** Replaces canvas and pdf.js rasterization, for unit tests that have neither. */
  rasterize?: Rasterize
  /** Supplies wasm bytes or a locateFile URL for tests running outside a browser. */
  moduleOverrides?: ZXingModuleOverrides
}

const SUPPORTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const FIRST_ATTEMPT_SIDE = 2000
const RETRY_SIDE = 3000
const PDF_PAGES = 2
const PDF_MAX_PIXELS = 4_000_000
// pdf.js skips embedded images above maxImageSize and shrinks ones above the canvas area, so a phone photo wrapped in
// a PDF still decodes within the same memory bound as a page render.
const PDF_MAX_IMAGE_PIXELS = 25_000_000
const PDF_CANVAS_MAX_BYTES = PDF_MAX_PIXELS * 4

const wasmUrl = () => new URL('zxing-wasm/reader/zxing_reader.wasm', import.meta.url).href
/** Warms the browser cache with the decoder's wasm so the first read does not wait for it. Never throws. */
export async function prefetchReader(): Promise<void> {
  try {
    const response = await fetch(wasmUrl())
    await response.arrayBuffer()
  } catch {
    // A failed prefetch only means the read downloads the wasm itself.
  }
}

function drawingContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('canvas unavailable')
  return context
}

/** Reads the pixels and frees the canvas, which mobile browsers count against a tight total budget. */
function takePixels(canvas: HTMLCanvasElement): ImageData {
  const pixels = drawingContext(canvas).getImageData(0, 0, canvas.width, canvas.height)
  canvas.width = canvas.height = 0
  return pixels
}

async function rasterizeImage(file: Blob, maxSide: number): Promise<ReaderInput[]> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // The browser cannot decode this file to pixels; the decoder may still read the encoded image itself.
    return [file]
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    drawingContext(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return [takePixels(canvas)]
  } finally {
    bitmap.close()
  }
}

async function rasterizePdf(
  file: Blob,
  maxSide: number,
  signal?: AbortSignal,
): Promise<ReaderInput[]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href
  signal?.throwIfAborted()
  const data = new Uint8Array(await file.arrayBuffer())
  signal?.throwIfAborted()
  const task = pdfjs.getDocument({
    data,
    maxImageSize: PDF_MAX_IMAGE_PIXELS,
    canvasMaxAreaInBytes: PDF_CANVAS_MAX_BYTES,
  })
  let render: RenderTask | undefined
  let destroyed: Promise<void> | undefined
  const destroy = () => (destroyed ??= task.destroy())
  let rejectAbort: ((reason: unknown) => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject
  })
  const abort = () => {
    render?.cancel()
    void destroy().catch(() => {})
    rejectAbort?.(signal?.reason)
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    signal?.throwIfAborted()
    const pdf = await Promise.race([task.promise, aborted])
    const pages: ReaderInput[] = []
    for (let number = 1; number <= Math.min(pdf.numPages, PDF_PAGES); number++) {
      signal?.throwIfAborted()
      const page = await Promise.race([pdf.getPage(number), aborted])
      signal?.throwIfAborted()
      const { width, height } = page.getViewport({ scale: 1 })
      // Pages are vector, so the scale may exceed 1: the barcode needs pixels, not the page's point size.
      const scale = Math.min(
        maxSide / Math.max(width, height),
        Math.sqrt(PDF_MAX_PIXELS / (width * height)),
      )
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      try {
        render = page.render({ canvas, viewport })
        await Promise.race([render.promise, aborted])
        signal?.throwIfAborted()
        pages.push(takePixels(canvas))
      } finally {
        render = undefined
        canvas.width = canvas.height = 0
        page.cleanup()
      }
    }
    return pages
  } finally {
    signal?.removeEventListener('abort', abort)
    await destroy()
  }
}

const rasterizeInBrowser: Rasterize = (file, maxSide, signal) =>
  file.type === 'application/pdf'
    ? rasterizePdf(file, maxSide, signal)
    : rasterizeImage(file, maxSide)

const none = (reason: NoneReason): ReadOutcome => ({ kind: 'none', reason })

/** Runs one decode attempt off-thread and retires its worker on every completion path. */
function decodeInWorker(request: DecodeRequest, signal?: AbortSignal): Promise<ReadOutcome> {
  signal?.throwIfAborted()
  const worker = new Worker(new URL('./barcode-decoder.worker.ts', import.meta.url), {
    type: 'module',
  })
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener('abort', abort)
      worker.onmessage = worker.onerror = worker.onmessageerror = null
      worker.terminate()
    }
    const abort = () => {
      cleanup()
      reject(signal?.reason)
    }
    worker.onmessage = (event: MessageEvent<ReadOutcome>) => {
      cleanup()
      resolve(event.data)
    }
    worker.onerror = worker.onmessageerror = () => {
      cleanup()
      reject(new Error('barcode worker failed'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      worker.postMessage(
        request,
        request.inputs.flatMap((input) =>
          input instanceof Blob ? [] : [input.data.buffer as ArrayBuffer],
        ),
      )
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}

/**
 * Looks for a boarding pass barcode in a PDF, PNG or JPEG and returns its legs. Images get one retry at a larger size
 * when nothing is found. A file whose barcodes are not boarding passes is told apart from one with no barcode.
 */
export async function readBoardingPass(
  file: Blob,
  options: ReadOptions = {},
): Promise<ReadOutcome> {
  const { signal, rasterize = rasterizeInBrowser, moduleOverrides } = options
  if (!SUPPORTED_TYPES.includes(file.type) || typeof WebAssembly === 'undefined')
    return none('unsupported')

  try {
    signal?.throwIfAborted()

    const sides =
      file.type === 'application/pdf' ? [FIRST_ATTEMPT_SIDE] : [FIRST_ATTEMPT_SIDE, RETRY_SIDE]
    for (const maxSide of sides) {
      const inputs = await rasterize(file, maxSide, signal)
      signal?.throwIfAborted()

      const outcome = await decodeInWorker(
        {
          inputs,
          wasmUrl: moduleOverrides?.locateFile?.('zxing_reader.wasm', '') ?? wasmUrl(),
          wasmBinary: moduleOverrides?.wasmBinary,
        },
        signal,
      )
      signal?.throwIfAborted()
      if (outcome.kind === 'legs' || outcome.reason !== 'no-barcode') return outcome
      // The file went to the decoder untouched, so a larger render would change nothing.
      if (inputs.every((input) => input instanceof Blob)) break
    }
    return none('no-barcode')
  } catch {
    if (signal?.aborted) throw signal.reason
    return none('failed')
  }
}
