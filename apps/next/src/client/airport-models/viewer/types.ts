import type { AirportModelV1, CameraPose, FeatureKind } from '../../../lib/airport-models/model'

export type AirportLayers = Record<FeatureKind, boolean>
export const defaultAirportLayers: AirportLayers = {
  runway: true,
  taxiway: true,
  apron: true,
  stand: true,
  terminal: true,
  hangar: true,
  building: true,
  tower: true,
  gate: true,
}
export type VisibleInsets = { top: number; right: number; bottom: number; left: number }
export type ViewerState = {
  pose: CameraPose
  layers: AirportLayers
  selectedFeatureId: string | null
  visibleInsets?: Partial<VisibleInsets>
}
export type ViewerStatus = 'loading' | 'ready' | 'error'
export type ViewerCallbacks = {
  onPoseChange: (pose: CameraPose) => void
  onSelection: (id: string | null) => void
  onHover?: (hit: { id: string; x: number; y: number } | null) => void
  onStatus?: (status: ViewerStatus) => void
}
/** Commands are instant, including keyboard actions. State remains owned by the caller. */
export type AirportViewerHandle = {
  zoom: (factor: number) => void
  reset: () => void
  focusFeature: (id: string) => void
  retry: () => void
}
export type RendererController = Omit<AirportViewerHandle, 'retry'> & {
  update: (state: ViewerState) => void
  dispose: () => void
}
export type RendererOptions = {
  canvas: HTMLCanvasElement
  model: AirportModelV1
  initialPose: CameraPose
  state: ViewerState
  callbacks: ViewerCallbacks
}
