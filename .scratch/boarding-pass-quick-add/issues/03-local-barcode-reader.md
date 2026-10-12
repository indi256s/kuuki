# 03 — Local barcode reader (OQ1)

Status: resolved
Type: task
Requirements: QA-01 (bounds), QA-02, QA-03 (fallback triggers), QA-12

## Decision (OQ1)

Research task `bpqa-oq1-research-r1` (Sonnet 5.5, 2026-10-12) with primary-source links; versions re-checked on npm by the orchestrator.

- **Decoder:** `zxing-wasm` **3.1.5, pinned exactly** (MIT, maintained). Production imports only `zxing-wasm/reader` lazily; formats `PDF417`, `Aztec`, `QRCode`, `DataMatrix`; `maxNumberOfSymbols: 4`; library defaults keep `tryHarder/tryRotate/tryInvert/tryDownscale`. The wasm is self-hosted: `new URL('zxing-wasm/reader/zxing_reader.wasm', import.meta.url)` passed to `prepareZXingModule({ overrides: { locateFile } })`. The default jsDelivr location must never be used.
- **Not chosen:** native `BarcodeDetector` (absent from iOS Safari, so wasm is required anyway; two paths would diverge), `@zxing/library` (maintenance mode).
- **PDF:** `pdfjs-dist` **6.4.299, pinned exactly**, imported lazily only for PDFs; worker via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`; `getDocument({ data, maxImageSize, canvasMaxAreaInBytes })`; render the first 2 pages, longest side ≤ 2000 px and ≤ 4 MP; `page.cleanup()` and `loadingTask.destroy()` afterwards. No cmaps or standard fonts.
- **Images:** existing PDF/PNG/JPEG types and the existing 10 MiB limit (`IMPORT_MAX_FILE_BYTES`; the source must stay uploadable for fallback). `createImageBitmap(blob, { imageOrientation: 'from-image' })` → canvas with longest side ≤ 2000 px → `ImageData`; one retry at ≤ 3000 px when nothing is found; `bitmap.close()`. If `createImageBitmap` throws, pass the Blob to `readBarcodes`. HEIC is not promised and fails into the fallback.
- **First load:** decoder and PDF code load only after a file is chosen; the capture UI may prefetch the wasm URL when it opens.
- **Device evidence:** none. Real phone decode rates and timings remain [issue 06](06-phone-pilot-evidence.md).

## Outcome

`readBoardingPass(file, { signal })` returns `{ kind: 'legs', legs, incomplete } | { kind: 'none', reason: 'no-barcode' | 'not-boarding-pass' | 'unsupported' | 'failed' }` using ticket 02's parser and `combineLegs`. Decoded text exists only inside this call; it is never logged, stored or returned. An aborted signal stops further work and the caller ignores late results.

## Owned paths

`apps/next/package.json`, `pnpm-lock.yaml` (exact pins; dependencies only), `apps/next/src/client/import/barcode-reader.ts`, `apps/next/src/client/import/barcode-reader.test.ts`.

## Acceptance

- Real-decoder unit fixtures generated at test time with the `zxing-wasm` writer (no binary fixtures): PDF417 and Aztec single-leg, a multi-leg payload, a non-BCBP QR (→ `not-boarding-pass`), a blank image (→ `no-barcode`). Rasterization is an injectable seam so jsdom tests skip canvas/PDF; the PDF/canvas path is exercised in the browser journey (ticket 05).
- `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next lint`, focused vitest.
