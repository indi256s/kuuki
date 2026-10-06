'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import './plane-field.css'

/**
 * The brand panel's decoration (boards 1.1, 3.1 to 3.3, build notes 4.1): the くうき watermark with a field of drifting
 * planes over it. The planes are the lucide plane outline, one per `[x, y, size]`, laid out in the boards' SVG user space.
 * Both layouts are in the markup and CSS shows one, so the server and client agree without measuring the screen.
 *
 * Every plane is drawn rotated −18.4° (atan2(−800, 400) + 45°, so the nose points along its flight) and drifts along
 * (+400, −800) per cycle, transform only. The frame the boards draw is the frozen frame: the field is paused until it
 * is on screen and the page is visible, and is not animated at all under reduced motion.
 */
type Size = 's' | 'm' | 'l'
type Plane = readonly [x: number, y: number, size: Size]
type Layout = { width: number; height: number; planes: Plane[] }

const PLANE_PATH = 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'
const SCALE: Record<Size, number> = { s: 0.5, m: 0.67, l: 0.92 }
const ROTATION = -18.4
const DRIFT = { x: 400, y: -800 }
/** How far past the field's edge a plane's centre must be before it counts as gone (the large glyph is about 17px across). */
const EDGE = 16

const DESKTOP: Layout = { width: 420, height: 620, planes: [
  [29, 245, 's'], [45, 325, 'm'], [43, 377, 'm'], [73, 208, 'l'], [85, 440, 's'], [96, 575, 'm'], [99, 118, 'm'], [122, 575, 's'],
  [133, 605, 'm'], [148, 272, 'm'], [150, 380, 'l'], [158, 577, 'm'], [187, 226, 'l'], [201, 21, 'm'], [210, 576, 'l'], [221, 417, 's'],
  [233, 519, 's'], [244, 563, 's'], [268, 269, 'm'], [278, 317, 's'], [279, 48, 's'], [289, 504, 'l'], [303, 225, 'l'], [325, 240, 'l'],
  [336, 82, 's'], [347, 122, 'l'], [364, 342, 's'], [384, 78, 's'], [398, 602, 'm'], [17, 351, 's'],
] }
const MOBILE: Layout = { width: 390, height: 264, planes: [
  [199, 194, 's'], [323, 195, 'm'], [41, 194, 'l'], [188, 233, 's'], [261, 148, 'm'], [77, 162, 'l'], [157, 175, 's'],
  [128, 205, 'm'], [104, 135, 'l'], [283, 249, 's'], [321, 146, 'm'], [153, 131, 'l'], [40, 232, 's'], [372, 181, 'm'],
] }

/**
 * A plane's lap along its flight line, in drifts of (+400, −800) so 0 is the drawn position: where the lap starts and how
 * long it is. A lap runs from just outside the field on one side to just outside on the other, so the jump back to its
 * start happens out of sight and the field stays populated. Every plane moves at the same speed (one drift per
 * `--plane-cycle`), so a lap is shorter than a drift when the line crosses the field quickly. The stylesheet delays each
 * animation by the same start, so the first frame is the drawn one.
 */
function lap(width: number, height: number, [x, y]: Plane) {
  const enter = Math.max((-EDGE - x) / DRIFT.x, (y - height - EDGE) / -DRIFT.y)
  const leave = Math.min((width + EDGE - x) / DRIFT.x, (y + EDGE) / -DRIFT.y)
  const round = (value: number) => Math.round(value * 1e4) / 1e4
  return { '--plane-start': round(enter - 0.01), '--plane-span': round(leave - enter + 0.02) }
}

function Planes({ layout, className }: { layout: Layout; className: string }) {
  const { width, height, planes } = layout
  return <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
    {planes.map((plane, index) => {
      const [x, y, size] = plane
      return <g key={index} className="auth-plane" data-plane={size} style={lap(width, height, plane) as CSSProperties}>
        <g transform={`translate(${x},${y}) rotate(${ROTATION}) scale(${SCALE[size]}) translate(-12,-12)`}><path d={PLANE_PATH} /></g>
      </g>
    })}
  </svg>
}

export function PlaneField() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = root.current
    if (!element) return
    let onScreen = false
    const sync = () => { element.dataset.running = String(onScreen && !document.hidden) }
    const observer = new IntersectionObserver(entries => { onScreen = entries[entries.length - 1]!.isIntersecting; sync() })
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return <div ref={root} className="auth-plane-field">
    <div className="auth-watermark"><span>く</span><span>う</span><span>き</span></div>
    <div className="auth-planes">
      <Planes layout={DESKTOP} className="auth-planes-desktop" />
      <Planes layout={MOBILE} className="auth-planes-mobile" />
    </div>
  </div>
}
