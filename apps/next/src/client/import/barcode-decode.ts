import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import type { ReadOutcome, ReaderInput } from './barcode-reader'
import { combineLegs, parseBcbp, type BcbpResult } from './bcbp'

export interface DecodeRequest {
  inputs: ReaderInput[]
  wasmUrl: string
  wasmBinary?: ArrayBuffer
}

// Raw barcode text stays in the decoder worker; only allowlisted legs cross back to the UI.
export async function decodeBoardingPass({
  inputs,
  wasmUrl,
  wasmBinary,
}: DecodeRequest): Promise<ReadOutcome> {
  prepareZXingModule({
    overrides: {
      ...(wasmBinary ? { wasmBinary } : {}),
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
  })
  const passes: BcbpResult[] = []
  let sawBarcode = false
  for (const input of inputs) {
    for (const barcode of await readBarcodes(input, {
      formats: ['PDF417', 'Aztec', 'QRCode', 'DataMatrix'],
      maxNumberOfSymbols: 4,
    })) {
      sawBarcode = true
      const pass = parseBcbp(barcode.text)
      if (pass) passes.push(pass)
    }
  }
  const combined = combineLegs(passes)
  return combined
    ? { kind: 'legs', ...combined }
    : { kind: 'none', reason: sawBarcode ? 'not-boarding-pass' : 'no-barcode' }
}
