'use client'

import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { Car, MoreHorizontal, Plane, Ship, Train, type IconProps } from '@keyline-icons/react'
import type * as GL from 'maplibre-gl'
import {
  laneArt,
  laneGeometry,
  type AtlasVehicleKey,
  type LaneVehicleKey,
} from '../../leaderboard/lanes/lanes.generated'
import '../../leaderboard/lanes/vehicles.generated.css'
import { useMap } from '../../maps/mapcn'
import { CountryStamp, stampMeta } from '../../stamps'
import { useMobile } from '../../ui/use-mobile'
import type { Locale } from '../../../lib/format'
import { VISIT_WAYS, WAY_LABELS, type VisitWay } from '../visit-ways'
import { recentSamples, rubberBand, velocityOf, type Sample } from '../../ui/sheet-physics'
import { bounds, pathOf, projectOutline, PULL_SLOP, type Point, type Ring } from './outline'
import { REVERT_MS, type RecordVisit } from './quick-visit'
import './sticker.css'

export type StickerGeometry = {
  rings: number[][][]
  centre: [number, number]
}

export type StickerHandle = {
  lift: (code: string) => void
  dismiss: () => boolean
  finish: () => void
}

const LIFT_SCALE = 1.04
const SETTLE_MS = 150
const REDUCED_MS = 150
const SMALL_OUTLINE = 96
const MAX_CAMERA_MS = 300
const STRING = 28
const STUB_WIDTH = 76
const TAG_HEIGHT = 120
const EYELET = 10
const SWING_DEG = 5
const SWING = { type: 'spring', duration: 0.5, bounce: 0.2 } as const
const STUB_TEAR = 28
const PROJECTION_S = 0.2
const STUB_GIVE = 8
const CROSS_MIN_MS = 600
const CROSS_MAX_MS = 900
const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1]
const VEHICLE_PX = 72
const VEHICLE_PX_PHONE = 56

const WAY_ICONS: Record<VisitWay, ComponentType<IconProps>> = {
  air: Plane,
  rail: Train,
  road: Car,
  sea: Ship,
  other: MoreHorizontal,
}

const VEHICLES: Record<
  VisitWay,
  { key: LaneVehicleKey | AtlasVehicleKey; family: keyof typeof laneGeometry }
> = {
  air: { key: 'A320', family: 'air' },
  rail: { key: 'rail', family: 'ground' },
  road: { key: 'road', family: 'ground' },
  sea: { key: 'sea', family: 'sea' },
  other: { key: 'other', family: 'other' },
}
function vehicleFrame(way: VisitWay, px: number) {
  const { key, family } = VEHICLES[way]
  const geometry = laneGeometry[family]
  const [, , vw, vh] = geometry.viewBox
  const scale = px / Math.max(vw * geometry.nose, vh * geometry.ground)
  return {
    key,
    family,
    geometry,
    width: vw * scale,
    height: vh * scale,
    length: vw * geometry.nose * scale,
    rise: vh * geometry.ground * scale,
  }
}

const artUrl = (key: LaneVehicleKey | AtlasVehicleKey) => {
  const asset = laneArt[key]
  return typeof asset === 'string' ? asset : asset.src
}

type StubPull = { way: VisitWay; dy: number; dragging: boolean }
type Press = { id: number; way: VisitWay; startY: number; moved: boolean; samples: Sample[] }
type Active = {
  code: string
  phase: 'lifted' | 'closing' | 'crossing'
  way?: VisitWay
  progress: number
  pull: StubPull | null
}
type Ghost = { key: number; code: string }
type Anchor = { zoom: number; at: GL.LngLat; x: number; y: number }
type StampNode = { node: HTMLElement; at: [number, number]; size: number }
type LandedStamp = { key: number; code: string; at: [number, number]; leaving: boolean }

let sequence = 0

function screenRings(map: GL.Map, geometry: StickerGeometry): Ring[] {
  const rings = projectOutline(geometry.rings, (lngLat) => map.project(lngLat))
  const sized = rings.map((ring) => ({ ring, box: bounds([ring]) }))
  const main = sized.reduce((best, item) =>
    item.box.width * item.box.height > best.box.width * best.box.height ? item : best,
  )
  const reach = 1.5 * Math.max(main.box.width, main.box.height, 24)
  const cx = main.box.left + main.box.width / 2,
    cy = main.box.top + main.box.height / 2
  return sized
    .filter(({ box }) => {
      const x = box.left + box.width / 2,
        y = box.top + box.height / 2
      return Math.hypot(x - cx, y - cy) <= reach
    })
    .map(({ ring }) => ring)
}

export function Sticker({
  control,
  locale,
  ownerId,
  name,
  geometryOf,
  record,
  onCovered,
}: {
  control: RefObject<StickerHandle | null>
  locale: Locale
  ownerId: string
  name: (code: string) => string
  geometryOf: (code: string) => StickerGeometry | null
  record: RecordVisit
  onCovered?: (codes: string[]) => void
}) {
  const { map } = useMap()
  const reduced = useReducedMotion() ?? false
  const mobile = useMobile()
  const [active, setActive] = useState<Active | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [stamps, setStamps] = useState<LandedStamp[]>([])
  const [, setFrame] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const faceFollow = useRef<SVGGElement>(null)
  const shadowFollow = useRef<HTMLDivElement>(null)
  const stampNodes = useRef(new Map<number, StampNode>())
  const anchor = useRef<Anchor | null>(null)
  const firstTab = useRef<HTMLButtonElement>(null)
  const swing = useRef<HTMLDivElement>(null)
  const flying = useRef(false)
  const motion = useRef<AnimationPlaybackControls | null>(null)
  const timers = useRef(new Set<number>())
  const activeRef = useRef(active)
  useLayoutEffect(() => {
    activeRef.current = active
  }, [active])
  const landing = useRef<{ code: string; land: () => void; announce: () => void } | null>(null)
  const pointerState = useRef<Press | null>(null)
  const closing = useRef<number | undefined>(undefined)
  const suppressClick = useRef(false)

  const later = useCallback((ms: number, run: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      run()
    }, ms)
    timers.current.add(id)
    return id
  }, [])
  useEffect(() => {
    const pending = timers.current
    return () => {
      motion.current?.stop()
      pending.forEach((id) => window.clearTimeout(id))
      pending.clear()
      landing.current?.announce()
      landing.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const at = map?.getCenter()
    anchor.current = map && at ? { zoom: map.getZoom(), at, ...map.project(at) } : null
    for (const node of [faceFollow.current, shadowFollow.current])
      if (node) node.style.transform = ''
  })

  const drawing = !!active || ghosts.length > 0 || stamps.length > 0
  useLayoutEffect(() => {
    if (!map || !drawing) return
    const root = rootRef.current
    const follow = () => {
      const from = anchor.current
      if (!from) return
      const scale = 2 ** (map.getZoom() - from.zoom)
      const now = map.project(from.at)
      const transform = `translate(${now.x - scale * from.x}px, ${now.y - scale * from.y}px) scale(${scale})`
      if (faceFollow.current) faceFollow.current.style.transform = transform
      if (shadowFollow.current) shadowFollow.current.style.transform = transform
      for (const { node, at, size } of stampNodes.current.values()) {
        const { x, y } = map.project(at)
        node.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
      }
      root?.setAttribute('data-moving', '')
    }
    const settle = () => {
      root?.removeAttribute('data-moving')
      if (flying.current) {
        flying.current = false
        if (!reduced) swingTag(swing.current)
      }
      setFrame((value) => value + 1)
    }
    map.on('move', follow)
    map.on('moveend', settle)
    return () => {
      map.off('move', follow)
      map.off('moveend', settle)
      root?.removeAttribute('data-moving')
    }
  }, [map, drawing, reduced])

  const coveredKey = [
    ...new Set([
      ...(active ? [active.code] : []),
      ...stamps.filter((stamp) => !stamp.leaving).map((stamp) => stamp.code),
    ]),
  ].join(',')
  useEffect(() => {
    onCovered?.(coveredKey ? coveredKey.split(',') : [])
    return () => onCovered?.([])
  }, [coveredKey, onCovered])

  const focusMap = useCallback(() => {
    map?.getCanvas().focus({ preventScroll: true })
  }, [map])

  const landStamp = useCallback(
    (code: string) => {
      const geometry = geometryOf(code)
      if (!geometry) return undefined
      const key = ++sequence
      setStamps((list) => [...list, { key, code, at: geometry.centre, leaving: false }])
      return () => {
        setStamps((list) =>
          list.map((item) => (item.key === key ? { ...item, leaving: true } : item)),
        )
        later(SETTLE_MS, () => setStamps((list) => list.filter((item) => item.key !== key)))
      }
    },
    [geometryOf, later],
  )

  const endCrossing = useCallback(() => {
    if (activeRef.current?.phase !== 'crossing') return
    motion.current?.stop()
    motion.current = null
    landing.current?.land()
    landing.current = null
    if (rootRef.current?.contains(document.activeElement)) focusMap()
    setActive((current) => (current?.phase === 'crossing' ? null : current))
  }, [focusMap])

  const revert = useCallback(
    (code: string) => {
      if (activeRef.current?.code === code && activeRef.current.phase === 'crossing') {
        motion.current?.stop()
        motion.current = null
        landing.current = null
        setActive(null)
      }
      const key = ++sequence
      setGhosts((list) => [...list, { key, code }])
      setStamps((list) =>
        list.map((item) => (item.code === code ? { ...item, leaving: true } : item)),
      )
      later(REVERT_MS, () => {
        setGhosts((list) => list.filter((item) => item.key !== key))
        setStamps((list) => list.filter((item) => item.code !== code || !item.leaving))
      })
    },
    [later],
  )

  const close = useCallback(() => {
    const current = activeRef.current
    if (!current || current.phase !== 'lifted') return false
    if (reduced) {
      setActive(null)
      return true
    }
    setActive({ ...current, phase: 'closing', pull: null })
    window.clearTimeout(closing.current)
    closing.current = later(SETTLE_MS, () =>
      setActive((value) =>
        value?.phase === 'closing' && value.code === current.code ? null : value,
      ),
    )
    return true
  }, [later, reduced])

  const lift = useCallback(
    (code: string) => {
      if (!map) return
      endCrossing()
      const geometry = geometryOf(code)
      if (!geometry) return
      flying.current = false
      setActive({ code, phase: 'lifted', progress: 0, pull: null })
      const box = bounds(screenRings(map, geometry))
      if (Math.max(box.width, box.height) >= SMALL_OUTLINE) return
      const container = map.getContainer()
      const lons = geometry.rings.flat().map((point) => point[0]),
        lats = geometry.rings.flat().map((point) => point[1])
      const dx = box.left + box.width / 2 - container.clientWidth / 2,
        dy = box.top + box.height / 2 - container.clientHeight / 2
      const travel = Math.hypot(dx, dy) / Math.hypot(container.clientWidth, container.clientHeight)
      const duration = reduced ? 0 : Math.round(Math.min(MAX_CAMERA_MS, travel * 2 * MAX_CAMERA_MS))
      flying.current = duration > 0
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        {
          padding: Math.min(container.clientWidth, container.clientHeight) / 3,
          maxZoom: 6,
          duration,
        },
      )
    },
    [map, geometryOf, endCrossing, reduced],
  )

  useImperativeHandle(control, () => ({ lift, dismiss: close, finish: endCrossing }), [
    lift,
    close,
    endCrossing,
  ])

  const liftedCode = active?.phase === 'lifted' ? active.code : null
  useEffect(() => {
    if (liftedCode) firstTab.current?.focus({ preventScroll: true })
    return () => {
      pointerState.current = null
    }
  }, [liftedCode])

  useLayoutEffect(() => {
    if (liftedCode && !flying.current && !reduced) swingTag(swing.current)
  }, [liftedCode, reduced])

  useEffect(() => {
    if (!liftedCode || !map) return
    const pan = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) close()
    }
    map.on('movestart', pan)
    return () => {
      map.off('movestart', pan)
    }
  }, [liftedCode, map, close])

  useEffect(() => {
    if (!liftedCode || !map) return
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target as Node | null
      if (!target || rootRef.current?.contains(target) || map.getContainer().contains(target))
        return
      close()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [liftedCode, map, close])

  if (!map) return null
  const geometry = active ? geometryOf(active.code) : null
  const rings = geometry ? screenRings(map, geometry) : null
  const box = rings ? bounds(rings) : null
  const centre: Point | null = box ? [box.left + box.width / 2, box.top + box.height / 2] : null
  const container = map.getContainer()
  const vehiclePx = mobile ? VEHICLE_PX_PHONE : VEHICLE_PX

  const knot: Point | null = rings
    ? rings.flat().reduce((low, point) => (point[1] > low[1] ? point : low))
    : null

  function cross(way: VisitWay) {
    const current = activeRef.current
    if (!current || current.phase !== 'lifted' || !box) return
    const code = current.code
    const { announce } = record(code, way, {
      revert: () => revert(code),
      land: () => landStamp(code),
    })
    landing.current = {
      code,
      announce,
      land: () => announce(landStamp(code)),
    }
    const pull = current.pull?.way === way ? { ...current.pull, dragging: false } : null
    setActive({ code, way, phase: 'crossing', progress: 0, pull })
    if (reduced) {
      landing.current.land()
      landing.current = null
      later(REDUCED_MS, () => {
        if (activeRef.current?.code === code) endCrossing()
      })
      return
    }
    const duration = Math.min(CROSS_MAX_MS, Math.max(CROSS_MIN_MS, CROSS_MIN_MS + box.width))
    motion.current = animate(0, [0, 1], {
      duration: duration / 1000,
      ease: EASE_IN_OUT,
      onUpdate: (value: number) =>
        setActive((now) =>
          now?.code === code && now.phase === 'crossing' ? { ...now, progress: value } : now,
        ),
      onComplete: endCrossing,
    })
  }

  function onStubClick(way: VisitWay) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    cross(way)
  }

  function onStubPointerDown(way: VisitWay, event: PointerEvent<HTMLButtonElement>) {
    if (activeRef.current?.phase !== 'lifted' || event.button !== 0 || pointerState.current) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointerState.current = {
      id: event.pointerId,
      way,
      startY: event.clientY,
      moved: false,
      samples: [],
    }
  }

  function onStubPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const press = pointerState.current
    if (!press || press.id !== event.pointerId || reduced) return
    const current = activeRef.current
    if (!current || current.phase !== 'lifted') return
    const raw = event.clientY - press.startY
    if (!press.moved) {
      if (Math.abs(raw) <= PULL_SLOP) return
      press.moved = true
    }
    const dy = raw >= 0 ? raw : -rubberBand(-raw, STUB_GIVE)
    press.samples = recentSamples(press.samples, event.timeStamp, dy)
    setActive({ ...current, pull: { way: press.way, dy, dragging: true } })
  }

  function onStubPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const press = pointerState.current
    if (!press || press.id !== event.pointerId) return
    pointerState.current = null
    const current = activeRef.current
    const pull = current?.pull
    if (!current || current.phase !== 'lifted' || !pull?.dragging) return
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    })
    const velocity = velocityOf(recentSamples(press.samples, event.timeStamp, pull.dy))
    if (pull.dy + velocity * PROJECTION_S >= STUB_TEAR) {
      cross(pull.way)
      return
    }
    release(current)
  }

  function onStubPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    const press = pointerState.current
    if (!press || press.id !== event.pointerId) return
    pointerState.current = null
    const current = activeRef.current
    if (current?.phase === 'lifted') release(current)
  }

  function release(current: Active) {
    if (current.pull) setActive({ ...current, pull: { ...current.pull, dy: 0, dragging: false } })
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    if (close()) focusMap()
  }

  const tagWidth = Math.min(container.clientWidth - 16, VISIT_WAYS.length * STUB_WIDTH)
  const hang: Point | null =
    knot && centre && !reduced
      ? [
          centre[0] + (knot[0] - centre[0]) * LIFT_SCALE,
          centre[1] + (knot[1] - centre[1]) * LIFT_SCALE,
        ]
      : knot
  const tagLeft = hang
    ? Math.min(Math.max(8, hang[0] - tagWidth / 2), container.clientWidth - 8 - tagWidth)
    : 0
  const tagTop = hang
    ? Math.min(Math.max(8, hang[1] + STRING), container.clientHeight - TAG_HEIGHT - 8)
    : 0
  const eyeletX = hang ? Math.min(Math.max(tagLeft + 16, hang[0]), tagLeft + tagWidth - 16) : 0
  const eyelet: Point | null =
    centre && !reduced
      ? [
          centre[0] + (eyeletX - centre[0]) / LIFT_SCALE,
          centre[1] + (tagTop + EYELET - centre[1]) / LIFT_SCALE,
        ]
      : [eyeletX, tagTop + EYELET]

  let face: ReactNode = null
  let shadow: ReactNode = null
  let vehicle: ReactNode = null
  if (active && rings && box && centre) {
    const d = pathOf(rings)
    const clipped = active.phase === 'crossing' && !reduced
    const id = `atlas-sticker-${active.code}`
    const frame = active.way ? vehicleFrame(active.way, vehiclePx) : null
    const length = frame?.length ?? vehiclePx
    const nose = box.left + active.progress * (box.width + length)
    const inked = nose - length / 2
    shadow = reduced ? null : (
      <div className="atlas-sticker-follow-html" ref={shadowFollow}>
        <svg
          key={active.code}
          className="atlas-sticker-shadow"
          data-phase={active.phase}
          aria-hidden="true"
          style={{ transformOrigin: `${centre[0]}px ${centre[1]}px` }}
        >
          <path d={d} />
        </svg>
      </div>
    )
    face = (
      <g
        key={active.code}
        className="atlas-sticker"
        data-phase={active.phase}
        data-reduced={reduced || undefined}
        style={{ transformOrigin: `${centre[0]}px ${centre[1]}px` }}
      >
        {clipped ? (
          <defs>
            <clipPath id={`${id}-cover`} clipPathUnits="userSpaceOnUse">
              <rect x={inked} y={box.top - 1} width={box.width + 2} height={box.height + 2} />
            </clipPath>
          </defs>
        ) : null}
        <path
          className="atlas-sticker-face"
          d={d}
          clipPath={clipped ? `url(#${id}-cover)` : undefined}
        />
        {knot && eyelet ? <TagString from={knot} to={eyelet} /> : null}
        <text className="atlas-sticker-name" x={centre[0]} y={centre[1]} textAnchor="middle">
          {name(active.code)}
        </text>
      </g>
    )
    if (clipped && frame) {
      const { key, family, geometry, width, height, rise } = frame
      const [vx, vy, vw, vh] = geometry.viewBox
      const ground = centre[1] + (family === 'air' ? vehiclePx * 0.2 : rise / 2)
      vehicle = (
        <g className="atlas-vehicle" data-way={active.way}>
          {family === 'air' ? (
            <ellipse
              className="atlas-vehicle-shadow"
              cx={nose - vehiclePx * 0.45}
              cy={ground + vehiclePx * 0.12}
              rx={vehiclePx * 0.38}
              ry={vehiclePx * 0.06}
            />
          ) : null}
          <g className="atlas-vehicle-bob">
            <svg
              className="lane-vehicle"
              x={nose - geometry.nose * width}
              y={ground - geometry.ground * height}
              width={width}
              height={height}
              style={{ width, height }}
              viewBox={`${vx} ${vy} ${vw} ${vh}`}
            >
              <use href={`${artUrl(key)}#lane-${key}`} x={vx} y={vy} width={vw} height={vh} />
            </svg>
          </g>
        </g>
      )
    }
  }

  const stampSize = mobile ? 120 : 160

  return (
    <div className="atlas-sticker-layer" ref={rootRef}>
      {shadow}
      <svg className="atlas-sticker-svg" aria-hidden="true">
        <g className="atlas-sticker-follow" ref={faceFollow}>
          {ghosts.map((ghost) => {
            const ghostGeometry = geometryOf(ghost.code)
            return ghostGeometry ? (
              <path
                key={ghost.key}
                className="atlas-sticker-face atlas-sticker-ghost"
                d={pathOf(screenRings(map, ghostGeometry))}
              />
            ) : null
          })}
          {face}
          {vehicle}
        </g>
      </svg>
      {active && box ? (
        <div
          key={active.code}
          role="group"
          aria-label={name(active.code)}
          className="atlas-sticker-tabs"
          data-phase={active.phase}
          onKeyDown={onKeyDown}
          style={{ transform: `translate(${tagLeft}px, ${tagTop}px)`, width: tagWidth }}
        >
          <div
            ref={swing}
            className="atlas-tag"
            style={{ transformOrigin: `${eyeletX - tagLeft}px ${EYELET}px` }}
          >
            <div className="atlas-tag-head" aria-hidden="true">
              <span className="atlas-tag-eyelet" style={{ left: eyeletX - tagLeft }} />
              <span className="atlas-tag-code">{stampMeta(active.code).iso3}</span>
              <span className="atlas-tag-barcode" />
            </div>
            <div className="atlas-tag-stubs">
              {VISIT_WAYS.map((way, index) => {
                const pull = active.pull?.way === way ? active.pull : null
                return (
                  <button
                    key={way}
                    ref={index === 0 ? firstTab : undefined}
                    type="button"
                    className="atlas-sticker-tab"
                    data-torn={(active.phase === 'crossing' && active.way === way) || undefined}
                    data-dragging={pull?.dragging || undefined}
                    style={pull ? ({ '--pull': `${pull.dy}px` } as CSSProperties) : undefined}
                    onClick={() => onStubClick(way)}
                    onPointerDown={(event) => onStubPointerDown(way, event)}
                    onPointerMove={onStubPointerMove}
                    onPointerUp={onStubPointerUp}
                    onPointerCancel={onStubPointerCancel}
                  >
                    <WayIcon way={way} />
                    <span>{WAY_LABELS[way][locale]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
      {stamps.map((stamp) => {
        const { x, y } = map.project(stamp.at)
        return (
          <div
            key={stamp.key}
            ref={(node) => {
              if (node) stampNodes.current.set(stamp.key, { node, at: stamp.at, size: stampSize })
              else stampNodes.current.delete(stamp.key)
            }}
            className="atlas-sticker-stamp"
            data-leaving={stamp.leaving || undefined}
            style={{
              width: stampSize,
              height: stampSize,
              transform: `translate(${x - stampSize / 2}px, ${y - stampSize / 2}px)`,
            }}
          >
            <div aria-hidden="true">
              <CountryStamp
                iso2={stamp.code}
                status="inked"
                size={stampSize}
                static={reduced}
                impressionId={`passport-atlas:${ownerId}:${stamp.code}:${stamp.key}`}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TagString({ from, to }: { from: Point; to: Point }) {
  const sag = Math.min(12, Math.hypot(to[0] - from[0], to[1] - from[1]) / 4)
  const control: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + sag]
  return (
    <path
      className="atlas-tag-string"
      d={`M${from[0]} ${from[1]}Q${control[0]} ${control[1]} ${to[0]} ${to[1]}`}
    />
  )
}

function swingTag(node: HTMLElement | null) {
  if (node) animate(node, { transform: [`rotate(${SWING_DEG}deg)`, 'rotate(0deg)'] }, SWING)
}

function WayIcon({ way }: { way: VisitWay }) {
  const Icon = WAY_ICONS[way]
  return <Icon size={18} aria-hidden="true" />
}
