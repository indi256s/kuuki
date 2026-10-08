// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { MaplibreGlobeProps } from './maplibre-globe'
import { OverviewGlobe } from './globe'
import { OverviewProvider } from '../store/overview-context'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
const state = vi.hoisted(() => ({ currentProps: [] as MaplibreGlobeProps[] }))
vi.mock('./maplibre-globe', () => ({ MaplibreGlobe: function Renderer(props: MaplibreGlobeProps) {
  const { onReady } = props
  useEffect(() => { onReady() }, [onReady])
  state.currentProps.push(props)
  return <div data-testid="webgl"><button onClick={props.onError}>Map error</button><span>{props.active ? 'active map' : 'inactive map'}</span></div>
} }))
function Scene() {
  return <OverviewProvider payload={fixture as OverviewPayload} prefs={DEFAULT_PREFS} ownerKey="owner" locale="en" live={false}><OverviewGlobe topLeft={<button>Page filter</button>} /></OverviewProvider>
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); state.currentProps = [] })
it('no WebGL2 keeps actual SVG and accessible table without scheduling map import', async () => {
  const idle = vi.fn(); vi.stubGlobal('requestIdleCallback', idle)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
  render(<Scene />)
  expect(screen.getByRole('img', { name: 'Places by air' })).toBeInTheDocument()
  expect(screen.getByText('View as table')).toBeInTheDocument()
  expect(screen.queryByTestId('webgl')).not.toBeInTheDocument()
  expect(idle).not.toHaveBeenCalled()
})
it('idle imports only after callback; map readiness keeps data table; error returns SVG; fullscreen has one active scene', async () => {
  let callback!: IdleRequestCallback
  vi.stubGlobal('requestIdleCallback', (next: IdleRequestCallback) => { callback = next; return 9 })
  vi.stubGlobal('cancelIdleCallback', vi.fn())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(type => type === 'webgl2' ? { getExtension: () => null } as unknown as WebGL2RenderingContext : null)
  render(<Scene />)
  expect(screen.queryByTestId('webgl')).not.toBeInTheDocument()
  await act(async () => callback({ didTimeout: false, timeRemaining: () => 10 }))
  await waitFor(() => expect(screen.getByTestId('webgl')).toBeInTheDocument())
  expect(screen.getByText('View as table')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }))
  await act(async () => callback({ didTimeout: false, timeRemaining: () => 10 }))
  await waitFor(() => expect(screen.getAllByTestId('webgl')).toHaveLength(2))
  expect(screen.getByText('active map')).toBeInTheDocument()
  expect(screen.getByText('inactive map')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Map error' }))
  await waitFor(() => expect(screen.getAllByTestId('webgl')).toHaveLength(1))
})
it('identity retirement cancels deferred imports; disposed callbacks cannot mount the map', async () => {
  let callback!: IdleRequestCallback
  const cancel = vi.fn()
  vi.stubGlobal('requestIdleCallback', (next: IdleRequestCallback) => { callback = next; return 12 }); vi.stubGlobal('cancelIdleCallback', cancel)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(type => type === 'webgl2' ? { getExtension: () => null } as unknown as WebGL2RenderingContext : null)
  render(<Scene />)
  act(() => window.dispatchEvent(new Event('kuuki:identity-reset')))
  await act(async () => callback({ didTimeout: false, timeRemaining: () => 10 }))
  expect(cancel).toHaveBeenCalledWith(12)
  expect(state.currentProps).toHaveLength(0)
})
