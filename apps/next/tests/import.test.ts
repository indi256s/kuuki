import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { crc32, deflateSync } from 'node:zlib'
import { test, expect, type Page, type Route } from '@playwright/test'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer'
import { signIn } from './helpers'

// The fixture has no import binding, so these journeys run against a small stateful stand-in for the import
// endpoints (batch, drafts, events, confirm). It is the server contract the client consumes, not the server.
const BATCH = '8b1f0c2e-4f0a-4d57-9a55-6d1e2b3c4d5e'
const LOCAL_BATCH = '8b1f0c2e-4f0a-4d57-9a55-6d1e2b3c4d5f'
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
  localDrafts: Row[] = []
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
        this.localDrafts = (job.legs ?? []).map((leg, index) =>
          row(`local-d${index + 1}`, {
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
        return json(route, 201, {
          ...this.snapshot(),
          batch: {
            ...this.snapshot().batch,
            id: LOCAL_BATCH,
            sourceType: job.source,
            status: job.incomplete ? 'partial' : 'review',
          },
          drafts: this.localDrafts,
        })
      }
      if (pathname === `/api/import/batches/${LOCAL_BATCH}` && method === 'GET')
        return json(route, 200, {
          ...this.snapshot(),
          batch: { ...this.snapshot().batch, id: LOCAL_BATCH, sourceType: 'image' },
          drafts: this.localDrafts,
        })
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
          dismissed?: boolean
          fields?: Record<string, string>
        }
        const draft = [...this.drafts, ...this.localDrafts].find((item) => item.id === patch[1])
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
        if (body.dismissed !== undefined) draft.status = body.dismissed ? 'dismissed' : 'review'
        draft.version++
        this.sequence++
        return json(route, 200, { draft })
      }
      if (
        (pathname === `/api/import/batches/${BATCH}/confirm` ||
          pathname === `/api/import/batches/${LOCAL_BATCH}/confirm`) &&
        method === 'POST'
      ) {
        const ownedRows = pathname.includes(LOCAL_BATCH) ? this.localDrafts : this.drafts
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
          const draft = ownedRows.find((candidate) => candidate.id === item.draftId)!
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
            id: pathname.includes(LOCAL_BATCH) ? LOCAL_BATCH : BATCH,
            status: 'review',
            sequence: this.sequence,
            reviewRowCount: ownedRows.filter((item) => item.status === 'review').length,
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
  await page.getByRole('button', { name: 'Paste text', exact: true }).click()
  await page.getByLabel('Paste text', { exact: true }).fill(PASTED)
  await page.getByRole('button', { name: 'Read text' }).click()
}

test('leaving and reloading during recognition resumes the stored batch without storing the source', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.status = 'processing'
  server.stage = 'recognizing'
  server.drafts = [row('d1')]
  await submitText(page)
  await expect(page.getByText('Reading document online')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`batch=${BATCH}`))
  expect(server.jobs).toHaveLength(1)
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    PASTED,
  )
  await page.getByRole('button', { name: 'Close import' }).click()
  await expect(page).toHaveURL(/\/journal/)
  await page.goto(`/import?batch=${BATCH}`)
  await page.reload()
  await expect(page.getByText('Reading document online')).toBeVisible()
  expect(server.jobs).toHaveLength(1)
  server.ready([
    row('d1'),
    row('d2', {
      fields: { date: '2026-04-02', origin: 'LAX', destination: 'JFK', airline_iata: 'AA' },
    }),
  ])
  await expect(rows(page)).toHaveCount(2, { timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Save 2 flights' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  )
})

test('reloading review retains member exclusions', async ({ page, baseURL }) => {
  const server = await setup(page, baseURL)
  server.ready([
    row('d1'),
    row('d2', {
      fields: { date: '2026-04-02', origin: 'LAX', destination: 'JFK', airline_iata: 'AA' },
    }),
  ])
  await page.goto(`/import?batch=${BATCH}`)
  await expect(rows(page)).toHaveCount(2)
  await rows(page).first().getByRole('checkbox').uncheck()
  await expect.poll(() => server.patches.length).toBe(1)
  expect(server.patches[0].body.selected).toBe(false)
  await page.reload()
  await expect(rows(page).first().getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('button', { name: 'Save 1 flight', exact: true }).click()
  await expect(page).toHaveURL(/\/journal\?flight=/)
  expect(server.confirms[0].items.map((item) => item.draftId)).toEqual(['d2'])
  await page.goto('/import')
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Save flight', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(server.confirms).toHaveLength(1)
  expect(server.jobs).toHaveLength(0)
})

test('a partial save keeps failed rows actionable and retries only the original receipt', async ({
  page,
  baseURL,
}) => {
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
  await page.getByRole('button', { name: 'Save 3 flights' }).click()
  await expect(
    page.getByText('Couldn’t finish saving. Your remaining flights are kept here.'),
  ).toBeVisible()
  await expect(rows(page)).toHaveCount(1)
  expect(server.confirms[0].items.map((item) => item.draftId)).toEqual(['d1', 'd2', 'd3'])
  expect(server.confirms[0].timezone).toMatch(/\S/)
  await page.getByRole('button', { name: 'Save flight', exact: true }).click()
  await expect(page).toHaveURL(/\/journal\?flight=/)
  expect(server.confirms).toHaveLength(2)
  expect(server.confirms[1].items.map((item) => item.draftId)).toEqual(['d2'])
  expect(server.confirms[1].items[0].key).toBe(server.confirms[0].items[1].key)
  await expect(page.getByText('3 flights saved', { exact: true })).toBeVisible()
})

test('typed corrections protect close and save until persisted', async ({ page, baseURL }) => {
  const server = await setup(page, baseURL)
  server.ready([
    row('d1'),
    row('d2', {
      fields: { date: '2026-04-02', origin: 'LAX', destination: 'SFO', airline_iata: 'AA' },
    }),
  ])
  await page.goto(`/import?batch=${BATCH}`)
  const first = rows(page).first()
  await first.getByRole('button', { name: 'Edit' }).click()
  await first.getByLabel('To (airport code)').fill('BOS')
  const save = page.getByRole('button', { name: 'Save 2 flights' })
  await expect(save).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('button', { name: 'Close import' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(server.patches).toHaveLength(0)
  await first.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => server.patches.length).toBe(1)
  expect(server.patches[0].body.fields).toMatchObject({ destination: 'BOS' })
  await expect(save).not.toHaveAttribute('aria-disabled', 'true')
  await save.click()
  await expect(page).toHaveURL(/\/journal\?flight=/)
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
const screenshotInput = (page: Page) => page.locator('input[type=file][multiple]')

test('barcode reading automatically complements online, asks the year once, and confirms flown only on final save', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  await page.goto('/import?source=pass')
  await expect(page.getByRole('heading', { name: 'Import flights' })).toBeVisible()
  await expect(
    page.getByText('Files and pasted text are sent for online recognition', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden()
  const camera = page.locator('input[type=file][capture]')
  await expect(camera).toHaveAttribute('capture', 'environment')
  await expect(screenshotInput(page)).toHaveAttribute('multiple', '')
  await screenshotInput(page).setInputFiles({
    name: 'pass.png',
    mimeType: 'image/png',
    buffer: await barcodePng(PASS),
  })
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByText('Ready to review', { exact: true })).toBeVisible()
  expect(server.jobs).toHaveLength(2)
  expect(server.jobs[1]).toMatchObject({
    type: 'image',
    sourceLabel: 'pass.png',
    requireFlownConfirmation: true,
  })
  expect(server.jobs[0]).toMatchObject({
    type: 'boarding_pass',
    source: 'image',
    legs: [
      { origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834', dayOfYear: 326 },
    ],
  })
  expect(server.jobs[0]).not.toHaveProperty('content')
  await page.getByRole('button', { name: 'Another year' }).click()
  await page.getByLabel('Year', { exact: true }).fill('2020')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('Which year did you fly?', { exact: false })).toBeHidden()
  // Focus stays in the answered row instead of falling to the deck's visually hidden heading.
  await expect(rows(page).getByRole('button', { name: 'Edit' })).toBeFocused()
  await expect(page.getByText('Have you taken this flight?')).toBeHidden()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  expect(server.patches[0].body).toMatchObject({
    fields: { date: '2020-11-21' },
    yearConfirmed: true,
  })
  expect(server.confirms).toHaveLength(0)
  expect(server.patches.some((patch) => patch.body.flownConfirmed === true)).toBe(false)
  await page.getByRole('button', { name: 'Save flight', exact: true }).click()
  await expect(page).toHaveURL(/\/journal\?flight=/)
  expect(server.patches.filter((patch) => patch.body.yearConfirmed)).toHaveLength(1)
  expect(server.patches.some((patch) => patch.body.flownConfirmed === true)).toBe(true)
  expect(server.confirms).toHaveLength(1)
})

test('an unreadable pass continues online without another confirmation', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.ready([row('d1')])
  await page.goto('/import?source=pass')
  await expect(
    page.getByText('Files and pasted text are sent for online recognition', { exact: false }),
  ).toBeVisible()
  await screenshotInput(page).setInputFiles({
    name: 'blank.png',
    mimeType: 'image/png',
    buffer: blankPng(),
  })
  await expect(rows(page)).toHaveCount(1)
  expect(server.jobs).toHaveLength(1)
  expect(server.jobs[0]).toMatchObject({
    type: 'image',
    sourceLabel: 'blank.png',
    requireFlownConfirmation: true,
  })
  expect(server.jobs[0].content).toMatch(/^iVBOR/)
  expect(server.confirms).toHaveLength(0)
})

test('same-day evidence stays a draft until explicit final save confirms the owner', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  await page.goto('/import')
  const today = await page.evaluate(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
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
  await expect(page.getByRole('button', { name: 'Include', exact: true })).toHaveCount(0)
  expect(server.patches).toHaveLength(0)
  expect(server.confirms).toHaveLength(0)
  await page.getByRole('button', { name: 'Save flight', exact: true }).click()
  await expect(page).toHaveURL(/\/journal\?flight=/)
  expect(server.patches.at(-1)?.body.flownConfirmed).toBe(true)
  expect(server.confirms).toHaveLength(1)
})

test('PDF barcode recognition also sends the whole PDF for printed years and remaining pages', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  await page.goto('/import?source=file')
  await screenshotInput(page).setInputFiles({
    name: 'pass.pdf',
    mimeType: 'application/pdf',
    buffer: await barcodePdf(PASS),
  })
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByText('Ready to review', { exact: true })).toBeVisible()
  expect(server.jobs).toHaveLength(2)
  expect(server.jobs[1]).toMatchObject({
    type: 'pdf',
    sourceLabel: 'pass.pdf',
    requireFlownConfirmation: true,
  })
  expect(server.jobs[1].content).toBeTruthy()
  expect(server.jobs[0]).toMatchObject({
    type: 'boarding_pass',
    source: 'pdf',
    legs: [{ origin: 'YUL', destination: 'FRA', airline: 'AC', flightNumber: '834' }],
  })
})

test('primary import entry resumes every retained source group without overwriting metadata', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.ready([row('d1')])
  server.localDrafts = [
    row('local-d2', {
      fields: { date: '2025-04-01', origin: 'TBS', destination: 'IST', airline_iata: 'TK' },
    }),
  ]
  await page.goto(`/import?batch=${BATCH}`)
  await expect(rows(page)).toHaveCount(1)
  await page.evaluate(
    ({ main, other }) => {
      const key = Object.keys(sessionStorage).find((key) =>
        key.startsWith('kuuki-import-session:'),
      )!
      const first = JSON.parse(sessionStorage.getItem(key)!)[0]
      sessionStorage.setItem(
        key,
        JSON.stringify([
          { ...first, label: 'one.pdf', onlineBatchId: main },
          {
            id: 'second-source',
            label: 'two.pdf',
            operationId: 'second-operation',
            batchIds: [other],
            onlineBatchId: other,
          },
        ]),
      )
    },
    { main: BATCH, other: LOCAL_BATCH },
  )
  await page.getByRole('button', { name: 'Close import' }).click()
  await expect(page).toHaveURL(/\/journal/)
  await page.goto('/import')
  await expect(rows(page)).toHaveCount(2)
  await expect(page.getByText('one.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText('two.pdf', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          sessionStorage.getItem(
            Object.keys(sessionStorage).find((key) => key.startsWith('kuuki-import-session:'))!,
          )!,
        ).length,
    ),
  ).toBe(2)
  expect(server.jobs).toHaveLength(0)
})

test('empty extraction reports no flights and keeps another-file and manual recovery available', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.ready([])
  await submitText(page)
  await expect(page.getByText('No flights found', { exact: true })).toBeVisible()
  await expect(page.getByText('Ready to review', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add more' }).click()
  await expect(page.getByRole('menuitem', { name: 'Add files' })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'Enter manually' })).toHaveAttribute('href', '/add')
  expect(server.confirms).toHaveLength(0)
})

test('system barcode copies stay suppressed after reload while user dismissals remain restorable', async ({
  page,
  baseURL,
}) => {
  const server = await setup(page, baseURL)
  server.ready([
    row('printed', {
      fields: {
        date: '2020-11-21',
        origin: 'YUL',
        destination: 'FRA',
        airline_iata: 'AC',
        flight_number: '834',
      },
    }),
    row('user-dismissed', {
      status: 'dismissed',
      fields: { date: '2025-04-01', origin: 'TBS', destination: 'IST', airline_iata: 'TK' },
    }),
  ])
  await page.goto('/import')
  await screenshotInput(page).setInputFiles({
    name: 'complement.pdf',
    mimeType: 'application/pdf',
    buffer: await barcodePdf(PASS),
  })
  await expect(page.getByText('Ready to review', { exact: true })).toBeVisible()
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Bring back.*YUL/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Bring back.*TBS/ })).toBeVisible()
  await page.reload()
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Bring back.*YUL/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Bring back.*TBS/ })).toBeVisible()
})
