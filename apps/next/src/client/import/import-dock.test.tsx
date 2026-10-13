// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchApi } from './batch-run'
import { draft, snapshot } from './fixtures'
import { ImportDock } from './import-dock'
import { ImportRunsProvider } from './import-runs'
import type { ImportEvent, Snapshot } from './import-types'
import { useImportBatch } from './use-import-batch'

afterEach(cleanup)
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

const api: BatchApi = {
  readBatch: vi.fn(async (id: string): Promise<Snapshot> =>
    snapshot([], {
      id,
      status: 'processing',
      stage: 'recognizing',
      sequence: 1,
      sourceType: 'pdf',
      sourceLabel: `${id}.pdf`,
    }),
  ),
  connect: vi.fn(() => new Promise<void>(() => {})),
  submit: vi.fn(),
  sleep: vi.fn(async () => {}),
}

/** Stands in for /import?batch=<id>: the page that shows the run. */
function Page({ batch }: { batch: string }) {
  const state = useImportBatch({ initialBatchId: batch })
  return <p>page {state.phase}</p>
}

describe('ImportDock', () => {
  it('leaves a run to its own page and announces real stages for docked runs', async () => {
    let current = snapshot([], {
      id: 'b2',
      sourceLabel: 'b2.pdf',
      status: 'processing',
      stage: 'recognizing',
    })
    let notify!: (event: ImportEvent) => void
    const liveApi: BatchApi = {
      ...api,
      readBatch: async (id) => (id === 'b2' ? current : api.readBatch(id)),
      connect: (id, _after, onEvent) => {
        if (id === 'b2') notify = onEvent
        return new Promise<void>(() => {})
      },
    }
    const shell = (pages: string[]) => (
      <ImportRunsProvider api={liveApi}>
        {pages.map((batch) => (
          <Page key={batch} batch={batch} />
        ))}
        <ImportDock locale="en" />
      </ImportRunsProvider>
    )
    const { rerender } = render(shell(['b1', 'b2']))
    await waitFor(() => expect(screen.getAllByText('page processing')).toHaveLength(2))
    expect(screen.queryByRole('region', { name: 'Imports' })).not.toBeInTheDocument()

    rerender(shell(['b1']))
    const dock = await screen.findByRole('region', { name: 'Imports' })
    expect(dock).toHaveTextContent('Reading the document')
    expect(dock).toHaveTextContent('b2.pdf')
    expect(dock).not.toHaveTextContent('b1.pdf')

    current = snapshot([draft({ id: 'a' })], { ...current.batch, stage: 'validating', sequence: 2 })
    await act(async () =>
      notify({ name: 'rows', sequence: 2, rowIds: ['a'], snapshot: false, reupload: false }),
    )
    await waitFor(() =>
      expect(within(dock).getByRole('button', { expanded: false })).toHaveTextContent(
        'Checking flights',
      ),
    )
    expect(within(dock).getByRole('button', { expanded: false })).toHaveTextContent('1 found')
    expect(screen.getByRole('status')).toHaveTextContent('Checking flights. b2.pdf')
  })
})
