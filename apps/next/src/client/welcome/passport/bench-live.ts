// The passport bench's live layer: one rAF loop that writes attributes on refs inside the generated SVG, so React never
// re-renders per frame. Ported from the approved prototype (.scratch/onboarding-passport-figure/live.js).
import { mrzLines } from '../../profile/mrz'
import { BENCH } from './bench.generated'
import {
  BOARD_L,
  PAGES_L,
  PAGE_SEAMS,
  PP,
  impressionSvg,
  leafPlanes,
  leafSlab,
  plungerSvg,
  slotOf,
} from './bench-geom'
import { translateAlong } from './iso-kit.generated.js'
import './bench.generated.css'
import './bench.css'

/** The words the drawing prints; the passport preview owns the copy. */
export type BenchCopy = {
  cover: string
  foot: string
  holder: string
  placeholder: string
  eyebrow: string
  visa: string
}

/** Everything the drawing shows. Facts stay in the HTML captions; these only print onto the passport. */
export type BenchInput = {
  /** The cover is open from the flights step on. */
  open: boolean
  /** The ready step: the WELCOME entry stamp, then one MRZ read. */
  ready: boolean
  name: string
  locale: 'en' | 'ru'
  /** In arrival order: the order the bridge stamps them, newer ink on top. */
  countries: readonly string[]
  flights: number
  copy: BenchCopy
}

export type BenchController = { update(input: BenchInput): void; destroy(): void }

const P = BENCH.projection
const MONTHS = {
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  ru: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
} as const

// ---------- Timing (seconds) ----------
const OPEN_S = 0.75
const RIPPLE = 0.095
const PRESS = { down: 0.11, hold: 0.07, up: 0.28 }
const PRESS_S = PRESS.down + PRESS.hold + PRESS.up
const PARK_WAIT = 0.4
const SCAN_S = 0.9
const ROLL_S = 0.06
const OCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
const PARKED: Stop = [PP.PARK, 0]

type Stop = readonly [number, number]
type Move = { t0: number; t1: number; from: Stop; to: Stop }
type Press = {
  head: number
  slot: number | 'entry'
  t0: number
  inked?: boolean
  after?: () => void
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const pressDepth = (age: number) => {
  if (age <= 0) return 0
  if (age < PRESS.down) return (1 - Math.cos((age / PRESS.down) * Math.PI)) / 2
  if (age < PRESS.down + PRESS.hold) return 1
  if (age < PRESS_S) return 1 - easeOutCubic((age - PRESS.down - PRESS.hold) / PRESS.up)
  return 0
}
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]?.toLocaleUpperCase() ?? '')
    .join('')

/**
 * Mounts the bench in `stage` showing `init` as it already is: countries on the page are simply there, an open cover is
 * open and a ready passport carries its entry stamp, with no presses, swing or scan. Later `update`s animate.
 */
export function mountBench(stage: HTMLElement, init: BenchInput): BenchController {
  stage.innerHTML = BENCH.svg
  const svg = stage.querySelector('svg')!
  const q = <T extends Element = SVGElement>(sel: string) => svg.querySelector<T>(sel)!
  const still = matchMedia('(prefers-reduced-motion: reduce)')

  const S = { ...init, countries: [...init.countries] }
  const A = {
    clock: 0,
    theta: { x: init.open ? Math.PI : 0, from: 0, to: init.open ? Math.PI : 0, t0: -1 },
    moves: [] as Move[],
    presses: [] as Press[],
    bridgeFree: 0,
    bridgeAt: PARKED as Stop,
    park: null as Move | null,
    scan: null as { t0: number } | null,
    entryOn: init.ready,
    lastRoll: -1,
  }

  // ---------- Refs ----------
  const bridge = [...svg.querySelectorAll<SVGGElement>('[data-bridge]')]
  const heads = PP.HEADS.map((y, i) => ({
    y,
    g: q(`[data-head="${i}"]`),
    foot: q(`[data-foot="${i}"]`),
    plunger: q(`[data-plunger="${i}"]`),
    depth: 0,
    lit: false,
  }))
  const leaf = {
    base: q('[data-leaf-base]'),
    page: q('[data-leaf-page]'),
    cover: q('[data-leaf-cover]'),
    edge: q('[data-leaf-edge]'),
    haloLeft: q('[data-halo-left]'),
  }
  const impLayer = q('[data-imps]')
  const slots: SVGGElement[] = []
  const slotRings = [...svg.querySelectorAll<SVGElement>('[data-slot-ring]')]
  const entry = q('[data-entry]')
  const mrz = [q('[data-mrz="0"]'), q('[data-mrz="1"]')]
  const scanLine = q('[data-scan]')
  const text = {
    coverTitle: q('[data-cover-title]'),
    coverFoot: q('[data-cover-foot]'),
    coverHolder: q('[data-cover-holder]'),
    coverName: q<SVGTextElement>('[data-cover-name]'),
    eyebrow: q('[data-eyebrow]'),
    visa: q('[data-visa-title]'),
    pageName: q<SVGTextElement>('[data-page-name]'),
    issued: q('[data-issued]'),
    ghost: q('[data-ghost]'),
    entryDate: q('[data-entry-date]'),
  }

  // ---------- Text ----------
  const today = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const dateText = (locale: 'en' | 'ru') =>
    `${pad2(today.getDate())} ${MONTHS[locale][today.getMonth()]} ${today.getFullYear()}`
  const shortDate = `${pad2(today.getMonth() + 1)}·${String(today.getFullYear()).slice(2)}`
  const issued = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`
  const lines = () =>
    mrzLines({
      name: S.name,
      handle: S.name,
      flights: S.flights,
      countries: S.countries.length,
      issued,
    })

  /** Measures printed text even while its page is hidden (a closed leaf is display:none, and hidden text measures 0). */
  function shown<T>(read: () => T): T {
    const hidden = [leaf.page, leaf.cover].filter((g) => g.style.display === 'none')
    hidden.forEach((g) => (g.style.display = ''))
    const value = read()
    hidden.forEach((g) => (g.style.display = 'none'))
    return value
  }
  const measure = (node: SVGTextContentElement) =>
    typeof node.getComputedTextLength === 'function' ? shown(() => node.getComputedTextLength()) : 0

  /**
   * Sets printed text and shrinks it to `max` page units. A name that would print below `wrapAt` breaks onto two lines
   * at the word boundary nearest its middle, the first line on the original baseline and the second below it (the field
   * label sits right above, so the block only grows down), shrinking again if a line is still too wide, never below
   * `least`.
   */
  function fit(
    node: SVGTextElement,
    value: string,
    size: number,
    max: number,
    least: number,
    wrapAt: number,
  ) {
    node.textContent = value
    node.style.fontSize = `${size}px`
    const width = measure(node)
    let next = width > max ? (size * max) / width : size
    const words = value.trim().split(/\s+/)
    if (next < wrapAt && words.length > 1) {
      let best = 1,
        bestDiff = Infinity
      for (let i = 1; i < words.length; i++) {
        const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length)
        if (diff < bestDiff) {
          best = i
          bestDiff = diff
        }
      }
      const x = node.getAttribute('x') ?? '0'
      node.textContent = ''
      ;[words.slice(0, best).join(' '), words.slice(best).join(' ')].forEach((line, i) => {
        const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
        span.setAttribute('x', x)
        span.setAttribute('dy', i ? '1.15em' : '0')
        span.textContent = line
        node.appendChild(span)
      })
      node.style.fontSize = `${size}px`
      const widest = Math.max(...[...node.children].map((span) => measure(span as SVGTSpanElement)))
      next = widest > max ? (size * max) / widest : size
    }
    node.style.fontSize = `${Math.max(least, next)}px`
  }

  function writeText() {
    const t = S.copy
    const name = S.name.trim()
    text.coverTitle.textContent = t.cover
    text.coverFoot.textContent = t.foot
    text.coverHolder.textContent = t.holder
    fit(text.coverName, name || t.placeholder, 6.4, 80, 3.4, 4.4)
    if (name) text.coverName.removeAttribute('data-empty')
    else text.coverName.setAttribute('data-empty', '')
    text.eyebrow.textContent = t.eyebrow
    text.visa.textContent = t.visa
    fit(text.pageName, name || t.placeholder, 5.4, 47, 2.6, 3.8)
    text.issued.textContent = dateText(S.locale)
    text.ghost.textContent = initials(name)
    text.entryDate.textContent = dateText('en')
    if (!A.scan) lines().forEach((line, i) => (mrz[i].textContent = line))
  }

  /** Inserts stamp i's impression (still unseen); later stamps are appended, so newer ink lies on top. */
  function inkSlot(i: number) {
    if (slots[i]) return
    impLayer.insertAdjacentHTML('beforeend', impressionSvg(i, S.countries[i] ?? '', shortDate))
    slots[i] = impLayer.lastElementChild as SVGGElement
  }
  function showSlot(i: number) {
    slots[i]?.setAttribute('opacity', '1')
    if (slotRings[i]) slotRings[i].style.display = 'none'
  }

  // ---------- Model → drawing ----------
  function drawLeaf(theta: number) {
    const a = theta - Math.PI
    const cover = leafSlab(BOARD_L, 0, PP.TC, a, P)
    const pages = leafSlab(PAGES_L, PP.TC, PP.HS, a, P, { seams: PAGE_SEAMS })
    const planes = leafPlanes(a, P)
    const pageUp = planes.pageSide > 0
    const first = pageUp
      ? (['iso-solid pp-cover', cover] as const)
      : (['iso-solid pp-pages', pages] as const)
    const second = pageUp
      ? (['iso-solid pp-pages', pages] as const)
      : (['iso-solid pp-cover', cover] as const)
    leaf.base.innerHTML =
      `<g class="${first[0]}">${first[1].base}<path class="iso-line iso-edge" data-tone="hi" d="${first[1].outline}"/></g>` +
      `<g class="${second[0]}">${second[1].base}</g>`
    leaf.edge.setAttribute('class', second[0])
    leaf.edge.innerHTML = `<path class="iso-line iso-edge" data-tone="hi" d="${second[1].outline}"/>`
    leaf.page.style.display = pageUp ? '' : 'none'
    leaf.cover.style.display = pageUp ? 'none' : ''
    leaf.page.setAttribute('transform', planes.page)
    leaf.cover.setAttribute('transform', planes.cover)
    const h = Math.min(1, Math.max(0, (theta - Math.PI * 0.86) / (Math.PI * 0.14)))
    leaf.haloLeft.style.opacity = String(h * h * (3 - 2 * h))
  }

  /** The bridge's stop [x along the rails, cross-slide] at time t. */
  function bridgeAt(t: number): Stop {
    let at: Stop = PARKED
    for (const m of A.moves) {
      if (t < m.t0) break
      const e = t >= m.t1 ? 1 : easeInOut((t - m.t0) / (m.t1 - m.t0))
      at = [m.from[0] + (m.to[0] - m.from[0]) * e, m.from[1] + (m.to[1] - m.from[1]) * e]
    }
    return at
  }

  let lastBridge: string | null = null
  let lastTheta: number | null = null
  function draw() {
    const t = A.clock
    if (A.theta.t0 >= 0) {
      const share = Math.min(1, (t - A.theta.t0) / OPEN_S)
      A.theta.x = A.theta.from + (A.theta.to - A.theta.from) * easeInOut(Math.max(0, share))
      if (share >= 1) A.theta.t0 = -1
    }
    if (A.theta.x !== lastTheta) {
      drawLeaf(A.theta.x)
      lastTheta = A.theta.x
    }
    const [bx, by] = bridgeAt(t)
    const key = `${bx} ${by}`
    if (key !== lastBridge) {
      const rails = translateAlong(P, [bx, 0, 0])
      // Trucks and posts ride the rails; the beam and its heads also ride the cross-slide.
      bridge.forEach((node) =>
        node.setAttribute(
          'transform',
          node.dataset.bridge === 'mid' ? translateAlong(P, [bx, by, 0]) : rails,
        ),
      )
      lastBridge = key
    }
    const depth = heads.map(() => 0)
    const lit = heads.map(() => false)
    for (const p of A.presses) {
      const age = t - p.t0
      depth[p.head] = Math.max(depth[p.head], pressDepth(age))
      if (age > -0.04 && age < PRESS_S) lit[p.head] = true
      if (!p.inked && age >= PRESS.down) {
        p.inked = true
        if (p.slot === 'entry') entry.setAttribute('opacity', '1')
        else showSlot(p.slot)
        p.after?.()
      }
    }
    heads.forEach((h, i) => {
      if (h.depth !== depth[i]) {
        h.depth = depth[i]
        const drop = depth[i] * PP.STROKE
        h.foot.setAttribute('transform', translateAlong(P, [0, 0, -drop]))
        h.plunger.innerHTML = plungerSvg(h.y, PP.FOOT_REST - drop, P)
      }
      if (h.lit !== lit[i]) {
        h.lit = lit[i]
        const set = (node: Element) =>
          lit[i] ? node.setAttribute('data-lit', '') : node.removeAttribute('data-lit')
        set(h.g)
        h.foot.querySelectorAll('.iso-solid').forEach(set)
      }
    })
    drawScan(t)
  }

  function drawScan(t: number) {
    if (!A.scan) return
    const share = (t - A.scan.t0) / SCAN_S
    if (share < 0) return
    const next = lines()
    if (share >= 1) {
      A.scan = null
      scanLine.setAttribute('opacity', '0')
      next.forEach((line, i) => (mrz[i].textContent = line))
      return
    }
    const u = share * PP.W
    scanLine.setAttribute('opacity', String(Math.min(1, share * 8, (1 - share) * 8)))
    scanLine.setAttribute('transform', `translate(${u.toFixed(2)} 0)`)
    if (t - A.lastRoll >= ROLL_S) {
      A.lastRoll = t
      const char = 4.1 * 0.62
      next.forEach((line, i) => {
        const done = Math.max(0, Math.floor((u - 4.5) / char))
        mrz[i].textContent =
          line.slice(0, done) +
          [...line.slice(done)].map(() => OCR[Math.floor(Math.random() * OCR.length)]).join('')
      })
    }
  }

  // ---------- Scheduling ----------
  const coverReady = () => (A.theta.t0 >= 0 ? A.theta.t0 + OPEN_S : 0)
  function unpark() {
    if (A.park && A.park.t0 > A.clock) {
      A.moves.splice(A.moves.indexOf(A.park), 1)
      A.bridgeAt = A.park.from
      A.bridgeFree = Math.max(A.clock, A.park.t0 - PARK_WAIT)
    }
    A.park = null
  }
  const isParked = () => A.bridgeAt[0] === PP.PARK && A.bridgeAt[1] === 0
  /** Queues a bridge move to `to` = [x, slide]; rails and cross-slide move together. */
  function travel(to: Stop, wait = 0): Move | null {
    const t0 = Math.max(A.clock, A.bridgeFree, coverReady()) + wait
    const from = A.bridgeAt
    const dist = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]) * 2)
    if (dist < 1e-6) {
      A.bridgeFree = t0
      return null
    }
    const m = { t0, t1: t0 + 0.22 + dist / 240, from, to }
    A.moves.push(m)
    A.bridgeFree = m.t1
    A.bridgeAt = to
    return m
  }

  /** Presses one stamp per newly found country, a short ripple between countries that arrive together. */
  function add(next: readonly string[]) {
    const first = S.countries.length
    S.countries.push(...next)
    next.forEach((_, j) => inkSlot(first + j))
    writeText()
    if (still.matches) {
      next.forEach((_, j) => showSlot(first + j))
      return
    }
    unpark()
    let stop = -1
    next.forEach((_, j) => {
      const i = first + j
      const s = slotOf(i)
      if (s.stop !== stop) {
        if (stop >= 0) A.bridgeFree += PRESS_S - RIPPLE
        travel([s.x, s.slide])
        stop = s.stop
      }
      A.presses.push({ head: s.head, slot: i, t0: Math.max(A.bridgeFree, A.clock) })
      A.bridgeFree = Math.max(A.bridgeFree, A.clock) + RIPPLE
    })
    A.bridgeFree += PRESS_S - RIPPLE
    A.park = travel(PARKED, PARK_WAIT)
  }

  /** The list changed other than by arrivals (a country dropped): the page is redrawn as it now is, without presses. */
  function restamp(list: readonly string[]) {
    A.presses = A.presses.filter((p) => p.slot === 'entry')
    impLayer.replaceChildren()
    slots.length = 0
    slotRings.forEach((ring) => (ring.style.display = ''))
    S.countries = [...list]
    S.countries.forEach((_, i) => {
      inkSlot(i)
      showSlot(i)
    })
  }

  function stampEntry() {
    if (A.entryOn) return
    A.entryOn = true
    if (still.matches) {
      entry.setAttribute('opacity', '1')
      return
    }
    unpark()
    travel([PP.ENTRY.x, 0])
    const t0 = Math.max(A.bridgeFree, A.clock)
    A.bridgeFree = t0 + PRESS_S
    // The bridge leaves right after the release and the scan waits for it to sit on the pad,
    // so nothing hangs over the name, the date or the MRZ while the line runs.
    const park = travel(PARKED)
    A.park = null
    const scanAt = (park ? park.t1 : A.bridgeFree) + 0.15
    A.presses.push({ head: 3, slot: 'entry', t0, after: () => (A.scan = { t0: scanAt }) })
  }

  function clearEntry() {
    A.entryOn = false
    A.presses = A.presses.filter((p) => p.slot !== 'entry' || A.clock - p.t0 >= PRESS_S)
    entry.setAttribute('opacity', '0')
    A.scan = null
    scanLine.setAttribute('opacity', '0')
    lines().forEach((line, i) => (mrz[i].textContent = line))
  }

  function setCover(open: boolean) {
    const to = open ? Math.PI : 0
    if (A.theta.to === to && (A.theta.t0 >= 0 || A.theta.x === to)) return
    if (still.matches) {
      A.theta = { x: to, from: to, to, t0: -1 }
      return
    }
    // Closing waits for the bridge to clear the page.
    const t0 = open ? A.clock : Math.max(A.clock, A.bridgeFree)
    A.theta = { x: A.theta.x, from: A.theta.x, to, t0 }
  }

  // ---------- Loop ----------
  let frame = 0,
    last = 0,
    visible = false
  function busy() {
    if (A.theta.t0 >= 0 || A.scan) return true
    if (A.moves.some((m) => A.clock < m.t1)) return true
    return A.presses.some((p) => A.clock - p.t0 < PRESS_S)
  }
  function tick(now: number) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
    last = now
    A.clock += dt
    draw()
    frame = visible && busy() ? requestAnimationFrame(tick) : 0
    if (!frame) last = 0
  }
  function kick() {
    draw()
    if (!frame && visible && busy()) {
      last = 0
      frame = requestAnimationFrame(tick)
    }
  }
  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            visible = entries[entries.length - 1]!.isIntersecting
            if (visible) kick()
          },
          { rootMargin: '120px 0px' },
        )
      : null
  observer?.observe(stage)

  /** Reduced motion switched on mid-animation: every running motion jumps to where it was going. */
  function snap() {
    A.theta = { x: A.theta.to, from: A.theta.to, to: A.theta.to, t0: -1 }
    for (const p of A.presses) {
      if (p.slot === 'entry') entry.setAttribute('opacity', '1')
      else showSlot(p.slot)
    }
    A.presses = []
    A.moves = []
    A.park = null
    A.bridgeAt = PARKED
    A.bridgeFree = A.clock
    A.scan = null
    scanLine.setAttribute('opacity', '0')
    lastBridge = null
    writeText()
    draw()
  }
  const onMotion = () => {
    if (still.matches) snap()
  }
  still.addEventListener('change', onMotion)

  function update(input: BenchInput) {
    const textChanged =
      input.name !== S.name ||
      input.locale !== S.locale ||
      input.flights !== S.flights ||
      input.copy !== S.copy
    S.name = input.name
    S.locale = input.locale
    S.flights = input.flights
    S.copy = input.copy
    if (S.ready && !input.ready) clearEntry()
    S.ready = input.ready
    if (input.open !== S.open || A.theta.to !== (input.open ? Math.PI : 0)) {
      S.open = input.open
      if (!input.open) {
        // Queued countries remain part of the preview when Back interrupts their press.
        A.presses = A.presses.filter((p) => {
          if (A.clock - p.t0 >= 0) return true
          if (p.slot !== 'entry') showSlot(p.slot)
          return false
        })
        unpark()
        if (!isParked()) A.park = travel(PARKED)
      }
      setCover(input.open)
    }
    const list = input.countries
    // Review can insert an earlier draft's countries before existing ones. Keep the drawing in arrival order,
    // and press membership additions even when the incoming list is reordered.
    const kept = S.countries.filter((code) => list.includes(code))
    if (kept.length !== S.countries.length) {
      restamp(kept)
      writeText()
    }
    const arrivals = list.filter((code) => !S.countries.includes(code))
    if (input.open && arrivals.length) add(arrivals)
    else if (textChanged) writeText()
    if (input.ready && input.open) stampEntry()
    kick()
  }

  // First render: whatever the state already holds is simply there, with no presses and no scan.
  S.countries.forEach((_, i) => {
    inkSlot(i)
    showSlot(i)
  })
  if (A.entryOn) entry.setAttribute('opacity', '1')
  writeText()
  void document.fonts?.ready.then(() => {
    if (frame !== -1) writeText()
  })
  draw()

  return {
    update,
    destroy() {
      cancelAnimationFrame(frame)
      frame = -1
      observer?.disconnect()
      still.removeEventListener('change', onMotion)
      stage.replaceChildren()
    },
  }
}
