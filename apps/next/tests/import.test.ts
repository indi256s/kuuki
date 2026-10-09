import { test, expect, type Page, type Route } from '@playwright/test'
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
  fields: Record<string, string>
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

class FakeImport {
  status: 'processing' | 'review' | 'partial' | 'failed' | 'cancelled' | 'completed' = 'review'
  stage: string | null = 'review_ready'
  errorCode: string | null = null
  sequence = 1
  drafts: Row[] = []
  jobs: unknown[] = []
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
        sourceType: 'text',
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
        this.jobs.push(request.postDataJSON())
        return json(route, 202, { batchId: BATCH })
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
          fields?: Record<string, string>
        }
        const draft = this.drafts.find((item) => item.id === patch[1])
        if (!draft) return json(route, 404, { error: 'missing', code: 'DRAFT_NOT_FOUND' })
        this.patches.push({ id: draft.id, body })
        if (body.fields) draft.fields = { ...draft.fields, ...body.fields }
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
  await expect(page.getByTestId('import-summary')).toContainText('Added 3 flights')
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
