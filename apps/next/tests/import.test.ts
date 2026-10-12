import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { crc32, deflateSync } from 'node:zlib'
import { test, expect, type Page, type Route } from '@playwright/test'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer'
import { signIn } from './helpers'

// The fixture has no import binding, so these journeys run against a small stateful stand-in for the import
// endpoints (batch, drafts, events, confirm). It is the server contract the client consumes, not the server.
const BATCH = '8b1f0c2e-4f0a-4d57-9a55-6d1e2b3c4d5e'
const PASTED = 'DOCUMENT MUST NOT BE STORED'

type Row = {
  id: string
  ordinal: number
  status: 'review' | 'dismissed' | 'converted'
  version: number
  fields: Record<string, string | number | boolean>
  confidence: number | null
  fieldConfidence: Record<string, number> | null
  yearExplicit: boolean
  yearConfirmed: boolean
  selected: boolean
  edited: boolean
  duplicateAcknowledged: boolean
  convertedFlightId: number | null
  duplicateFlightId: number | null
  issue: null
}
const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  ordinal: Number(id.replace(/\D/g, '')) || 0,
  status: 'review',
  version: 1,
  fields: { date: '2026-03-01', origin: 'JFK', destination: 'LAX', airline_iata: 'AA' },
  confidence: 0.9,
  fieldConfidence: null,
  yearExplicit: true,
  yearConfirmed: false,
  selected: true,
  edited: false,
  duplicateAcknowledged: false,
  convertedFlightId: null,
  duplicateFlightId: null,
  issue: null,
  ...over,
})

type Leg = {
  origin: string
  destination: string
  airline?: string
  flightNumber?: string
  dayOfYear?: number
}
type Job = {
  type: string
  source?: string
  sourceLabel?: string
  content?: string
  legs?: Leg[]
  incomplete?: boolean
  requireFlownConfirmation?: boolean
  submissionOperationId?: string
}

class FakeImport {
  sourceType: 'pdf' | 'image' | 'text' = 'text'
  status: 'processing' | 'review' | 'partial' | 'failed' | 'cancelled' | 'completed' = 'review'
  stage: string | null = 'review_ready'
  errorCode: string | null = null
  sequence = 1
  drafts: Row[] = []
  jobs: Job[] = []
  patches: Array<{ id: string; body: Record<string, unknown> }> = []
  confirms: Array<{
    timezone?: string
    items: Array<{ draftId: string; version: number; key: string }>
  }> = []
  /** Draft ids whose next confirm answers with a transient error. */
  failOnce = new Set<string>()

  snapshot() {
    const now = '2026-10-05T00:00:00.000Z'
    return {
      batch: {
        id: BATCH,
        sourceType: this.sourceType,
        sourceLabel: null,
        status: this.status,
        stage: this.stage,
        sequence: this.sequence,
        errorCode: this.errorCode,
        retryAfter: null,
        createdAt: now,
        updatedAt: now,
        expiresAt: '2026-11-04T12:00:00.000Z',
        expired: false,
      },
      drafts: this.drafts,
    }
  }
  ready(drafts: Row[]) {
    this.status = 'review'
    this.stage = 'review_ready'
    this.drafts = drafts
    this.sequence++
  }

  async install(page: Page) {
    const json = (route: Route, status: number, body: object) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    await page.route(/\/api\/import\//, async (route) => {
      const request = route.request()
      const { pathname } = new URL(request.url())
      const method = request.method()
      if (pathname === '/api/import/jobs' && method === 'POST') {
        const job = request.postDataJSON() as Job
        this.jobs.push(job)
        if (job.type !== 'boarding_pass') return json(route, 202, { batchId: BATCH })
        // A locally read pass is admitted in the request: the answer is the stored snapshot (201), rows carry no date yet.
        this.sourceType = job.source === 'pdf' ? 'pdf' : 'image'
        this.status = job.incomplete ? 'partial' : 'review'
        this.stage = 'review_ready'
        this.drafts = (job.legs ?? []).map((leg, index) =>
          row(`d${index + 1}`, {
            fields: {
              date: '',
              origin: leg.origin,
              destination: leg.destination,
              airline_iata: leg.airline ?? 'ZZ',
              ...(leg.airline ? {} : { airline_was_placeholder: true }),
              ...(leg.flightNumber ? { flight_number: leg.flightNumber } : {}),
              ...(leg.dayOfYear ? { date_ordinal_day: leg.dayOfYear } : {}),
              flown_required: true,
            },
            confidence: null,
            yearExplicit: false,
            selected: false,
          }),
        )
        this.sequence++
        return json(route, 201, this.snapshot())
      }
      if (pathname === `/api/import/batches/${BATCH}` && method === 'GET')
        return json(route, 200, this.snapshot())
      if (pathname === `/api/import/batches/${BATCH}/events`) {
        const body =
          this.status === 'processing'
            ? ': waiting\n\n'
            : `event: end\ndata: ${JSON.stringify({ sequence: this.sequence, status: this.status })}\n\n`
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body })
      }
      if (pathname === `/api/import/batches/${BATCH}/cancel`) {
        this.status = 'cancelled'
        return json(route, 200, { cancelled: true })
      }
      if (pathname === `/api/import/batches/${BATCH}` && method === 'DELETE') {
        this.status = 'cancelled'
        return json(route, 200, { deleted: true })
      }
      const patch = pathname.match(/^\/api\/import\/drafts\/([^/]+)$/)
      if (patch && method === 'PATCH') {
        const body = request.postDataJSON() as Record<string, unknown> & {
          version: number
          flownConfirmed?: boolean
          fields?: Record<string, string>
        }
        const draft = this.drafts.find((item) => item.id === patch[1])
        if (!draft) return json(route, 404, { error: 'missing', code: 'DRAFT_NOT_FOUND' })
        this.patches.push({ id: draft.id, body })
        if (body.fields) {
          // A new date withdraws an earlier "I flew": the member said it about another day.
          if (body.fields.date !== undefined && body.fields.date !== draft.fields.date)
            delete draft.fields.flown_confirmed
          draft.fields = { ...draft.fields, ...body.fields }
        }
        if (typeof body.flownConfirmed === 'boolean') {
          if (body.flownConfirmed) draft.fields.flown_confirmed = true
          else delete draft.fields.flown_confirmed
        }
        for (const key of ['selected', 'yearConfirmed', 'duplicateAcknowledged'] as const)
          if (typeof body[key] === 'boolean') draft[key] = body[key] as boolean
        draft.version++
        this.sequence++
        return json(route, 200, { draft })
      }
      if (pathname === `/api/import/batches/${BATCH}/confirm` && method === 'POST') {
        const body = request.postDataJSON() as {
          timezone?: string
          items: Array<{ draftId: string; version: number; key: string }>
        }
        this.confirms.push(body)
        const results = body.items.map((item) => {
          if (this.failOnce.delete(item.draftId))
            return {
              draftId: item.draftId,
              key: item.key,
              status: 'error',
              http_status: 503,
              code: 'INTERNAL',
              error: 'Temporary failure',
            }
          const draft = this.drafts.find((candidate) => candidate.id === item.draftId)!
          draft.status = 'converted'
          draft.convertedFlightId = 1000 + draft.ordinal
          return {
            draftId: item.draftId,
            key: item.key,
            status: 'created',
            flight: {
              id: draft.convertedFlightId,
              aircraft_icao: 'B738',
              origin: draft.fields.origin,
              destination: draft.fields.destination,
              date: draft.fields.date,
            },
          }
        })
        this.sequence++
        return json(route, 200, {
          results,
          batch: {
            id: BATCH,
            status: 'review',
            sequence: this.sequence,
            reviewRowCount: this.drafts.filter((item) => item.status === 'review').length,
          },
          derived_state: 'ready',
          revision: 5,
        })
      }
      return json(route, 404, { error: 'unexpected', code: 'NOT_FOUND' })
    })
  }
}

// Sign-in is limited per address (20 per 15 minutes) and the whole browser suite shares that budget, so this file
// signs in once and gives every journey the same session cookies.
let session: Awaited<ReturnType<ReturnType<Page['context']>['cookies']>> | null = null
async function setup(page: Page, baseURL: string | undefined) {
  if (session) await page.context().addCookies(session)
  else {
    await signIn(page, baseURL!)
    session = await page.context().cookies()
  }
  const server = new FakeImport()
  await server.install(page)
  return server
}

const rows = (page: Page) => page.locator('.import-row:visible')
const submitText = async (page: Page) => {
  await page.goto('/import')
  await page.getByRole('radio', { name: 'Paste text' }).click()
  await page.getByLabel('Booking or itinerary text').fill(PASTED)
  await page.getByRole('button', { name: 'Find flights' }).click()
}

test('leaving and reloading during recognition resumes the stored batch, without storing the source', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.status = 'processing'
  server.stage = 'recognizing'
  server.drafts = [row('d1')]
  await submitText(page)
  await expect(page.getByRole('heading', { name: 'Finding your flights' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`batch=${BATCH}`))
  await expect(page.getByText('1 flight found', { exact: true })).toBeVisible()
  expect(server.jobs).toHaveLength(1)
  const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))
  expect(stored).not.toContain(PASTED)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Finding your flights' })).toBeVisible()
  expect(server.jobs).toHaveLength(1) // resumed from the URL, nothing submitted again

  server.ready([
    row('d1'),
    row('d2', {
      fields: { date: '2026-04-02', origin: 'LAX', destination: 'JFK', airline_iata: 'AA' },
    }),
  ])
  await expect(page.getByRole('heading', { name: 'Review flights' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(rows(page)).toHaveCount(2)
})

test('reloading during review resumes the stored rows and the member choices', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.ready([
    row('d1'),
    row('d2', {
      fields: { date: '2026-04-02', origin: 'LAX', destination: 'JFK', airline_iata: 'AA' },
    }),
  ])
  await page.goto(`/import?batch=${BATCH}`)
  await expect(page.getByRole('heading', { name: 'Review flights' })).toBeVisible()
  await expect(page.getByText('2 selected of 2')).toBeVisible()
  await expect(page.getByTestId('import-retention')).toContainText('Nov 4, 2026') // the stored deadline, on a resumed review
  await rows(page).first().getByRole('checkbox').uncheck()
  await expect(page.getByText('1 selected of 2')).toBeVisible()
  await expect.poll(() => server.patches.length).toBe(1)
  expect(server.patches[0].body.selected).toBe(false)

  await page.reload()
  await expect(page.getByText('1 selected of 2')).toBeVisible()
  await expect(rows(page).first().getByRole('checkbox')).not.toBeChecked()
  expect(server.jobs).toHaveLength(0)
})

test('a partial save lists the failed row and retries only that row', async ({ page, baseURL }) => {
  const server = await setup(page, baseURL)
  server.ready([
    row('d1'),
    row('d2', {
      fields: { date: '2026-04-02', origin: 'LAX', destination: 'SFO', airline_iata: 'AA' },
    }),
    row('d3', {
      fields: { date: '2026-05-03', origin: 'SFO', destination: 'JFK', airline_iata: 'AA' },
    }),
  ])
  server.failOnce.add('d2')
  await page.goto(`/import?batch=${BATCH}`)
  await page.getByRole('button', { name: 'Import 3' }).click()
  await expect(page.getByRole('heading', { name: 'Some flights were not saved' })).toBeVisible()
  await expect(page.getByTestId('import-summary')).toContainText('Saved 2')
  await expect(page.getByRole('heading', { name: 'Not saved', exact: true })).toBeVisible()
  expect(server.confirms).toHaveLength(1)
  expect(server.confirms[0].items.map((item) => item.draftId)).toEqual(['d1', 'd2', 'd3'])
  expect(server.confirms[0].timezone).toMatch(/\S/)

  await page.getByRole('button', { name: 'Try again for 1' }).click()
  await expect(page.getByRole('heading', { name: 'Import finished' })).toBeVisible()
  expect(server.confirms).toHaveLength(2)
  expect(server.confirms[1].items.map((item) => item.draftId)).toEqual(['d2'])
  expect(server.confirms[1].items[0].key).toBe(server.confirms[0].items[1].key)
  await expect(page.getByTestId('import-summary')).toContainText('3 flights added')
  await expect(page.getByRole('link', { name: 'Open Passport' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to Journal' })).toBeVisible()
})

test('a typed correction blocks the import until it is saved', async ({ page, baseURL }) => {
  const server = await setup(page, baseURL)
  server.ready([
    row('d1'),
    row('d2', {
      fields: { date: '2026-04-02', origin: 'LAX', destination: 'SFO', airline_iata: 'AA' },
    }),
  ])
  await page.goto(`/import?batch=${BATCH}`)
  await rows(page).first().getByRole('button', { name: 'Edit' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('To (airport code)').fill('BOS')
  await sheet.getByRole('button', { name: 'Close' }).last().click() // leave the sheet without saving
  const importButton = page.getByRole('button', { name: 'Import 2' })
  await expect(importButton).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText('Some edits are not saved yet', { exact: false })).toBeVisible()
  await expect(
    rows(page).first().getByText('Changes not saved yet', { exact: false }),
  ).toBeVisible()
  expect(server.patches).toHaveLength(0)
  await rows(page).first().getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => server.patches.length).toBe(1)
  expect(server.patches[0].body.fields).toMatchObject({ destination: 'BOS' })
  await expect(importButton).not.toHaveAttribute('aria-disabled', 'true')
  await importButton.click()
  await expect(page.getByRole('heading', { name: 'Import finished' })).toBeVisible()
  expect(server.confirms[0].items.map((item) => item.draftId)).toEqual(['d1', 'd2'])
})

// ---- Quick Add (boarding pass) ----
// The barcode images are written here with the same zxing-wasm writer the unit tests use, so the page's real reader
// (wasm and all) decodes them in Chromium. A pass that never decoded would send no job and fail the first journey.
const nodeRequire = createRequire(import.meta.url)
let writerReady = false
async function barcodePng(text: string): Promise<Buffer> {
  if (!writerReady) {
    const wasm = new Uint8Array(
      readFileSync(nodeRequire.resolve('zxing-wasm/writer/zxing_writer.wasm')),
    )
    prepareZXingModule({ overrides: { wasmBinary: wasm.buffer as ArrayBuffer } })
    writerReady = true
  }
  const { image, error } = await writeBarcode(text, { format: 'PDF417', scale: 3 })
  if (!image) throw new Error(error)
  return Buffer.from(await image.arrayBuffer())
}
/** A one-page PDF whose only content is the barcode, drawn as filled rectangles from the writer's SVG path. */
async function barcodePdf(text: string): Promise<Buffer> {
  await barcodePng(text) // prepares the writer
  const { svg, error } = await writeBarcode(text, { format: 'PDF417', scale: 1 })
  if (!svg) throw new Error(error)
  const size = /width="(\d+)" height="(\d+)"/.exec(svg)!
  const [width, height] = [Number(size[1]), Number(size[2])]
  const scale = 4
  const margin = 40
  const [pageWidth, pageHeight] = [width * scale + 2 * margin, height * scale + 2 * margin]
  const path = /<path d="([^"]+)"/.exec(svg)![1]
  const rects = [...path.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+Z/g)].map(([, x, y, w, h]) => {
    const [left, top, across, down] = [x, y, w, h].map(Number)
    const bottom = pageHeight - margin - (top + down) * scale
    return `${margin + left * scale} ${bottom} ${across * scale} ${down * scale} re f`
  })
  const stream = `0 g\n${rects.join('\n')}\n`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
function blankPng(side = 240): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(side, 0)
  header.writeUInt32BE(side, 4)
  header[8] = 8 // bit depth; colour type 0 is grayscale
  const rows = Buffer.alloc((side + 1) * side, 255)
  for (let y = 0; y < side; y++) rows[y * (side + 1)] = 0 // filter type "none" per scanline
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
// One leg: Montreal to Frankfurt on Air Canada 834, flight day 326 (21 November in a leap year, 22 in others).
const PASS = 'M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100'
const screenshotInput = (page: Page) => page.locator('input[type=file][data-quick-add="file"]')

test('Quick Add reads a barcode locally and the member confirms the year and that they flew', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  await page.goto('/import?source=pass')
  await expect(page.getByRole('heading', { name: 'Add a boarding pass' })).toBeVisible()
  const photo = page.getByRole('button', { name: 'Take photo' })
  const choose = page.getByRole('button', { name: 'Choose screenshot or PDF' })
  await expect(photo).toBeVisible()
  await expect(choose).toBeVisible()
  // Equal weight: the same variant and the same box.
  await expect(photo).toHaveAttribute('data-variant', 'secondary')
  await expect(choose).toHaveAttribute('data-variant', 'secondary')
  const [a, b] = [await photo.boundingBox(), await choose.boundingBox()]
  expect(Math.abs(a!.height - b!.height)).toBeLessThan(1)
  expect(Math.abs(a!.width - b!.width)).toBeLessThan(1)
  const camera = page.locator('input[type=file][data-quick-add="photo"]')
  await expect(camera).toHaveAttribute('capture', 'environment')
  await expect(camera).toHaveAttribute('accept', 'image/jpeg,image/png')
  await expect(camera).toHaveAttribute('aria-hidden', 'true')

  await screenshotInput(page).setInputFiles({
    name: 'pass.png',
    mimeType: 'image/png',
    buffer: await barcodePng(PASS),
  })
  await expect(rows(page)).toHaveCount(1)
  expect(server.jobs).toHaveLength(1)
  const job = server.jobs[0]
  expect(job).toMatchObject({
    type: 'boarding_pass',
    source: 'image',
    sourceLabel: 'pass.png',
    legs: [
      { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834', dayOfYear: 326 },
    ],
  })
  expect(job).not.toHaveProperty('content')
  expect(JSON.stringify(job)).not.toContain('DESMARAIS')

  await expect(rows(page).first()).toContainText('YUL')
  await expect(page.getByText('Which year did you fly?', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Another year' }).click()
  await page.getByLabel('Year', { exact: true }).fill('2020')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Have you taken this flight?')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, I flew' }).click()
  await expect
    .poll(() => server.patches.some((patch) => patch.body.flownConfirmed === true))
    .toBe(true)
  expect(server.patches[0].body).toMatchObject({
    fields: { date: '2020-11-21' },
    yearConfirmed: true,
  })
  await page.getByRole('button', { name: 'Import 1' }).click()
  await expect(page.getByRole('heading', { name: 'Import finished' })).toBeVisible()
  expect(server.confirms).toHaveLength(1)
})

test('Quick Add discloses the upload before an unreadable pass leaves the device', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.ready([
    row('d1', {
      fields: {
        date: '',
        origin: 'JFK',
        destination: 'LAX',
        airline_iata: 'AA',
        flown_required: true,
      },
    }),
  ])
  await page.goto('/import?source=pass')
  await screenshotInput(page).setInputFiles({
    name: 'blank.png',
    mimeType: 'image/png',
    buffer: blankPng(),
  })
  // The outcome is announced once, through the status line; the fallback paragraph repeats it for sighted readers.
  await expect(
    page.getByRole('status').filter({ hasText: 'We could not find a boarding pass' }),
  ).toHaveCount(1)
  await expect(
    page
      .getByTestId('quick-add-fallback')
      .getByText('We could not find a boarding pass barcode in this file.'),
  ).toBeVisible()
  await expect(
    page.getByText('this document is uploaded to Kuuki’s online recognition'),
  ).toBeVisible()
  expect(server.jobs).toHaveLength(0)

  await page.getByRole('button', { name: 'Upload for recognition' }).click()
  await expect(rows(page)).toHaveCount(1)
  expect(server.jobs).toHaveLength(1)
  expect(server.jobs[0]).toMatchObject({
    type: 'image',
    sourceLabel: 'blank.png',
    requireFlownConfirmation: true,
  })
  expect(server.jobs[0].content).toMatch(/^iVBOR/) // base64 of the PNG
})

test('a same-day pass stays a draft until the member says they flew', async ({ page, baseURL }) => {
  const server = await setup(page, baseURL)
  await page.goto('/import') // a page in the app's own timezone, to read the member's local date
  const today = await page.evaluate(() => {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })
  server.ready([
    row('d1', {
      fields: {
        date: today,
        origin: 'JFK',
        destination: 'LAX',
        airline_iata: 'AA',
        flown_required: true,
      },
      confidence: null,
      selected: false,
    }),
  ])
  await page.goto(`/import?batch=${BATCH}`)
  await expect(page.getByText('Have you taken this flight?')).toBeVisible()
  await page.getByRole('button', { name: 'Not yet' }).click()
  await expect(page.getByText('Have you taken this flight?')).toBeHidden()
  expect(server.patches).toHaveLength(0)
  expect(server.confirms).toHaveLength(0)

  await page.reload() // "Not yet" is not stored: the question is back
  await expect(page.getByText('Have you taken this flight?')).toBeVisible()
  expect(server.confirms).toHaveLength(0)
  await page.getByRole('button', { name: 'Yes, I flew' }).click()
  await expect.poll(() => server.patches.length).toBe(1)
  expect(server.patches[0].body.flownConfirmed).toBe(true)
  await page.getByRole('button', { name: 'Import 1' }).click()
  await expect(page.getByRole('heading', { name: 'Import finished' })).toBeVisible()
  expect(server.confirms).toHaveLength(1)
})

test('Quick Add reads a barcode drawn in a PDF, the pdf.js path included', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  await page.goto('/import?source=pass')
  await screenshotInput(page).setInputFiles({
    name: 'pass.pdf',
    mimeType: 'application/pdf',
    buffer: await barcodePdf(PASS),
  })
  await expect(rows(page)).toHaveCount(1)
  expect(server.jobs).toHaveLength(1)
  expect(server.jobs[0]).toMatchObject({
    type: 'boarding_pass',
    source: 'pdf',
    sourceLabel: 'pass.pdf',
    legs: [{ origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834' }],
  })
  expect(server.jobs[0]).not.toHaveProperty('content')
})
