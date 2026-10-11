// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchApi } from './batch-run'
import { snapshot } from './fixtures'
import { ImportDock } from './import-dock'
import { ImportRunsProvider } from './import-runs'
import type { Snapshot } from './import-types'
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
  it('leaves a run to its own /import page and still shows the others', async () => {
    const shell = (pages: string[]) => (
      <ImportRunsProvider api={api}>
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
    expect(dock).toHaveTextContent('Reading b2.pdf')
    expect(dock).not.toHaveTextContent('b1.pdf')
  })
})
