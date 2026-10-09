'use client'

// Minimal copied/adapted mapcn Map provider and GeoJSON layer hook.
// Source: mapcn/src/registry/map.tsx @ d160bd767bc6388618720c6038a4dd9948c97362 (MIT).
import * as MapLibreGL from 'maplibre-gl'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { mapOptions } from './options'

const blankStyle: MapLibreGL.StyleSpecification = { version: 8, sources: {}, layers: [
  { id: 'background', type: 'background', paint: { 'background-color': 'transparent' } },
] }
type MapContextValue = { map: MapLibreGL.Map | null; ready: boolean; themeRevision: number }
/** Exported so layer components can be exercised against a stand-in map in unit tests. */
export const MapContext = createContext<MapContextValue>({ map: null, ready: false, themeRevision: 0 })
export const useMap = () => useContext(MapContext)

export function Map({ children, onError, locale = 'en', className = 'route-map-canvas', projection }: { children: ReactNode; onError: () => void; locale?: 'en' | 'ru'; className?: string; projection?: MapLibreGL.ProjectionSpecification }) {
  const host = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreGL.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [themeRevision, setThemeRevision] = useState(0)
  const onErrorRef = useRef(onError)
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => {
    if (!host.current) return
    if (!document.createElement('canvas').getContext('webgl2')) { onErrorRef.current(); return }
    MapLibreGL.setWorkerUrl('/maps/maplibre-6.13.0/maplibre-gl-worker.mjs')
    let instance: MapLibreGL.Map
    try {
      instance = new MapLibreGL.Map({ container: host.current, style: projection ? { ...blankStyle, projection } : blankStyle, ...mapOptions(locale) })
    } catch { onErrorRef.current(); return }
    // Keyboard users get the country and route lists; the canvas must not be an unnamed tab stop.
    instance.getCanvas().tabIndex = -1
    instance.touchZoomRotate.disableRotation()
    const timeout = window.setTimeout(() => { if (!instance.loaded()) onErrorRef.current() }, 12000)
    const handleError = () => onErrorRef.current()
    const handleLoad = () => { window.clearTimeout(timeout); setReady(true) }
    instance.on('error', handleError)
    instance.on('webglcontextlost', handleError)
    instance.on('load', handleLoad)
    setMap(instance)
    const observer = new MutationObserver(() => setThemeRevision(value => value + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] })
    return () => { observer.disconnect(); window.clearTimeout(timeout); instance.off('error', handleError);
      instance.off('load', handleLoad); instance.off('webglcontextlost', handleError); instance.remove(); setMap(null); setReady(false) }
  // The map is created once per mount; a locale change reloads the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <MapContext.Provider value={{ map, ready, themeRevision }}>
    <div ref={host} className={className} aria-hidden="true" />
    {children}
  </MapContext.Provider>
}

/** Owns a single GeoJSON source plus optional fill/outline layers. */
export function MapGeoJSON({ id, data, fillPaint, linePaint, onClick }: {
  id: string
  data: GeoJSON.FeatureCollection
  fillPaint?: Record<string, unknown>
  linePaint?: Record<string, unknown>
  onClick?: (properties: Record<string, unknown>, event: MapLibreGL.MapLayerMouseEvent) => void
}) {
  const { map, ready } = useMap()
  const callback = useRef(onClick)
  callback.current = onClick
  useEffect(() => {
    if (!map || !ready) return
    const source = `${id}-source`, fill = `${id}-fill`, outline = `${id}-outline`
    map.addSource(source, { type: 'geojson', data, promoteId: 'id' })
    if (fillPaint) map.addLayer({ id: fill, type: 'fill', source, paint: fillPaint as never })
    if (linePaint) map.addLayer({ id: outline, type: 'line', source, paint: linePaint as never })
    const click = (event: MapLibreGL.MapLayerMouseEvent) => {
      const properties = event.features?.[0]?.properties
      if (properties) callback.current?.(properties, event)
    }
    if (fillPaint) map.on('click', fill, click)
    return () => { if (fillPaint) map.off('click', fill, click)
      for (const layer of [...(map.getStyle()?.layers ?? [])].reverse()) {
        if ('source' in layer && layer.source === source && map.getLayer(layer.id)) map.removeLayer(layer.id)
      }
      if (map.getSource(source)) map.removeSource(source) }
  // Paint changes use setPaintProperty in owner; source stays stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, id])
  useEffect(() => {
    if (!map || !ready) return
    ;(map.getSource(`${id}-source`) as MapLibreGL.GeoJSONSource | undefined)?.setData(data)
  }, [map, ready, id, data])
  useEffect(() => {
    if (!map || !ready) return
    if (fillPaint) for (const [property, value] of Object.entries(fillPaint)) map.setPaintProperty(`${id}-fill`, property as never, value as never)
    if (linePaint) for (const [property, value] of Object.entries(linePaint)) map.setPaintProperty(`${id}-outline`, property as never, value as never)
  }, [map, ready, id, fillPaint, linePaint])
  return null
}
