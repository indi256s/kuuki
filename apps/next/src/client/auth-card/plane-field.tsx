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
 * is on screen and the page is visible, while focus is inside the form (auth-card.tsx), and is not animated at all
 * under reduced motion.
 *
 * The mobile field is wider than the phone (700px, centred), so the side margins fill in on wider screens and planes
 * enter from beyond the phone's edges. The desktop field is taller than the card's minimum (620px) because the card
 * grows with its content.
 */
type Size = 's' | 'm' | 'l'
type Plane = readonly [x: number, y: number, size: Size]
type Layout = { width: number; height: number; planes: Plane[] }

const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'
const SCALE: Record<Size, number> = { s: 0.5, m: 0.67, l: 0.92 }
const ROTATION = -18.4
const DRIFT = { x: 400, y: -800 }
/** How far past the field's edge a plane's centre must be before it counts as gone (the large glyph is about 17px across). */
const EDGE = 16
/** Half of a plane's width across its flight line, stroke included, in px (measured from the glyph at each size). */
const HALF_WIDTH: Record<Size, number> = { s: 5.4, m: 7.2, l: 9.9 }
/** Unit normal to the flight line: a plane's lane is its centre projected onto it. */
const NORMAL = { x: 0.8944, y: 0.4472 }
/** Clear space kept between the outlines of two planes in neighbouring lanes. */
const LANE_GAP = 2

const DESKTOP: Layout = {
  width: 420,
  height: 720,
  planes: [
    [29, 245, 's'],
    [45, 325, 'm'],
    [43, 377, 'm'],
    [73, 208, 'l'],
    [85, 440, 's'],
    [96, 575, 'm'],
    [99, 118, 'm'],
    [122, 575, 's'],
    [133, 605, 'm'],
    [148, 272, 'm'],
    [150, 380, 'l'],
    [158, 577, 'm'],
    [187, 226, 'l'],
    [201, 21, 'm'],
    [210, 576, 'l'],
    [221, 417, 's'],
    [233, 519, 's'],
    [244, 563, 's'],
    [268, 269, 'm'],
    [278, 317, 's'],
    [279, 48, 's'],
    [289, 504, 'l'],
    [303, 225, 'l'],
    [325, 240, 'l'],
    [336, 82, 's'],
    [347, 122, 'l'],
    [364, 342, 's'],
    [384, 78, 's'],
    [398, 602, 'm'],
    [17, 351, 's'],
    [60, 650, 'm'],
    [130, 690, 's'],
    [215, 660, 'l'],
    [290, 700, 's'],
    [360, 640, 'm'],
  ],
}
/**
 * The first 14 are the boards' planes, shifted by (+155, −15) from the 390×264 field so a 390px phone frames the same frame.
 * The next 8 fill the side margins. The last 9 are drawn in the top 30px, under the header mask (fully clear down to y=48), so the
 * still frame is unchanged; in flight they enter late in their laps and keep the band populated (a plane is on screen for about
 * two thirds of its lap, so the 14 drawn in view alone would average about 9 in motion).
 */
const MOBILE: Layout = {
  width: 700,
  height: 302,
  planes: [
    [354, 179, 's'],
    [478, 180, 'm'],
    [196, 179, 'l'],
    [343, 218, 's'],
    [416, 133, 'm'],
    [232, 147, 'l'],
    [312, 160, 's'],
    [283, 190, 'm'],
    [259, 120, 'l'],
    [438, 234, 's'],
    [476, 131, 'm'],
    [308, 116, 'l'],
    [195, 217, 's'],
    [527, 166, 'm'],
    [35, 230, 'm'],
    [80, 140, 's'],
    [125, 255, 'l'],
    [570, 250, 's'],
    [610, 170, 'l'],
    [655, 240, 'm'],
    [590, 90, 'm'],
    [680, 120, 's'],
    [185, 22, 's'],
    [240, 12, 'm'],
    [300, 26, 'l'],
    [355, 8, 's'],
    [410, 20, 'm'],
    [465, 28, 's'],
    [520, 14, 'l'],
    [90, 18, 'm'],
    [610, 24, 's'],
  ],
}

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
  return { start: enter - 0.01, span: leave - enter + 0.02 }
}

/**
 * Every plane's lap, with neighbouring lanes kept in step. Planes whose lanes are closer than their outlines plus
 * `LANE_GAP` would drift into each other as their laps of different lengths wrap at different times, so such planes
 * (and, transitively, their neighbours) share the longest lap in the group. They keep their own starts, so the drawn
 * frame is unchanged, and at one speed and one period they hold their spacing for ever.
 */
function laps({ width, height, planes }: Layout) {
  const own = planes.map((plane) => lap(width, height, plane))
  const lane = ([x, y]: Plane) => x * NORMAL.x + y * NORMAL.y
  const root = planes.map((_, index) => index)
  const find = (index: number): number =>
    root[index] === index ? index : (root[index] = find(root[index]!))
  planes.forEach((a, i) => {
    for (let j = i + 1; j < planes.length; j++) {
      const b = planes[j]!
      if (Math.abs(lane(a) - lane(b)) < HALF_WIDTH[a[2]] + HALF_WIDTH[b[2]] + LANE_GAP)
        root[find(i)] = find(j)
    }
  })
  const longest = new Map<number, number>()
  own.forEach(({ span }, i) => longest.set(find(i), Math.max(longest.get(find(i)) ?? 0, span)))
  const round = (value: number) => Math.round(value * 1e4) / 1e4
  return own.map(({ start }, i) => ({
    '--plane-start': round(start),
    '--plane-span': round(longest.get(find(i))!),
  }))
}

function Planes({ layout, className }: { layout: Layout; className: string }) {
  const { width, height, planes } = layout
  const timing = laps(layout)
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {planes.map((plane, index) => {
        const [x, y, size] = plane
        return (
          <g
            key={index}
            className="auth-plane"
            data-plane={size}
            style={timing[index] as CSSProperties}
          >
            <g
              transform={`translate(${x},${y}) rotate(${ROTATION}) scale(${SCALE[size]}) translate(-12,-12)`}
            >
              <path d={PLANE_PATH} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}

export function PlaneField() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = root.current
    if (!element) return
    let onScreen = false
    const sync = () => {
      element.dataset.running = String(onScreen && !document.hidden)
    }
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1]!.isIntersecting
      sync()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  return (
    <div ref={root} className="auth-plane-field">
      <div className="auth-watermark">
        <span>く</span>
        <span>う</span>
        <span>き</span>
      </div>
      <div className="auth-planes">
        <Planes layout={DESKTOP} className="auth-planes-desktop" />
        <Planes layout={MOBILE} className="auth-planes-mobile" />
      </div>
    </div>
  )
}
