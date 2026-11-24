'use client'

import { ChevronRight } from '@keyline-icons/react'
import { useReducedMotion } from 'motion/react'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { formatCount, type Locale } from '../../../lib/format'
import { ATLAS_VISIT_TOKENS, BUCKET_LABELS, visitBucket } from '../../../lib/map-buckets'
import { SegmentedControl } from '../../ui/segmented-control'
import { useMobile } from '../../ui/use-mobile'
import { useScrollFade } from '../../ui/use-scroll-fade'
import type { PassportEntry } from '../model'
import type { AtlasPaging, QuickVisit } from './map'
import { atlasPages, pageName, type AtlasAxis, type AtlasPage } from './pages'
import './atlas.css'

export type { QuickVisit }

export type PassportAtlasProps = {
  locale: Locale
  entries: PassportEntry[]
  pending: PassportEntry[]
  owner: boolean
  name: (code: string) => string
  onSelectCountry: (code: string) => void
  quickVisit?: QuickVisit | null
}

const AtlasMap = lazy(() => import('./map'))
const noSubscription = () => () => {}
const useClient = () =>
  useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

const COUNT = {
  en: { one: '{count} country on the map', other: '{count} countries on the map' },
  ru: {
    one: '{count} страна на карте',
    few: '{count} страны на карте',
    many: '{count} стран на карте',
    other: '{count} страны на карте',
  },
}
const COUNTRIES = {
  en: { one: '{count} country', other: '{count} countries' },
  ru: {
    one: '{count} страна',
    few: '{count} страны',
    many: '{count} стран',
    other: '{count} страны',
  },
}
const NEW_COUNTRIES = {
  en: { one: '{count} new country', other: '{count} new countries' },
  ru: {
    one: '{count} новая страна',
    few: '{count} новые страны',
    many: '{count} новых стран',
    other: '{count} новых стран',
  },
}
const VISITS = {
  en: { one: '{count} visit', other: '{count} visits' },
  ru: {
    one: '{count} визит',
    few: '{count} визита',
    many: '{count} визитов',
    other: '{count} визита',
  },
}

const COPY = {
  en: {
    map: 'Map of visited countries',
    list: 'Countries on the map',
    axis: 'Group the map by',
    regions: 'Regions',
    years: 'Years',
    strip: { regions: 'Regions on the map', years: 'Years on the map' },
    unavailable: 'Map unavailable. The countries are listed below.',
    pending: 'pending',
    visits: 'Visits',
  },
  ru: {
    map: 'Карта посещённых стран',
    list: 'Страны на карте',
    axis: 'Группировать карту',
    regions: 'Регионы',
    years: 'Годы',
    strip: { regions: 'Регионы на карте', years: 'Годы на карте' },
    unavailable: 'Карта недоступна. Страны перечислены ниже.',
    pending: 'ждёт подтверждения',
    visits: 'Визиты',
  },
} as const

export function PassportAtlas({
  locale,
  entries,
  pending,
  name,
  onSelectCountry,
  quickVisit = null,
}: PassportAtlasProps) {
  const [failed, setFailed] = useState(false)
  const client = useClient()
  const mobile = useMobile()
  const copy = COPY[locale]
  const visits = useMemo(
    () => new Map(entries.map((entry) => [entry.code, entry.visits])),
    [entries],
  )
  const pendingCodes = useMemo(() => pending.map((entry) => entry.code), [pending])
  const marked = entries.length + pending.length > 0
  const firsts = useMemo(
    () => new Map([...entries, ...pending].map((entry) => [entry.code, entry.first])),
    [entries, pending],
  )
  const dated = useMemo(() => [...firsts.values()].some(Boolean), [firsts])
  const [chosenAxis, setAxis] = useState<AtlasAxis>('regions')
  const axis = dated ? chosenAxis : 'regions'

  const pages = useMemo(
    () => atlasPages(axis, visits, pendingCodes, name, (code) => firsts.get(code) ?? null),
    [axis, visits, pendingCodes, name, firsts],
  )
  const [pageId, setPageId] = useState<AtlasPage['id']>('world')
  const page = Math.max(
    0,
    pages.findIndex((entry) => entry.id === pageId),
  )
  const [turn, setTurn] = useState<number | null>(null)
  const [reframe, setReframe] = useState(0)
  const [announced, setAnnounced] = useState('')
  const choose = useCallback(
    (index: number) => {
      const next = pages[index]
      if (!next) return
      if (index === page) {
        setReframe((count) => count + 1)
        return
      }
      setPageId(next.id)
      setTurn(Math.sign(index - page))
      setAnnounced(
        `${pageName(locale, next.id)}, ${formatCount(locale, next.codes.length, COUNTRIES)}`,
      )
    },
    [pages, page, locale],
  )
  const switchAxis = useCallback(
    (next: AtlasAxis) => {
      setAxis(next)
      setPageId('world')
      setTurn(0)
      setAnnounced(next === 'years' ? copy.years : copy.regions)
    },
    [copy],
  )
  const follow = useRef<((position: number) => void) | null>(null)
  const onProgress = useCallback((position: number) => follow.current?.(position), [])
  const paging = useMemo<AtlasPaging | null>(
    () => (mobile ? { pages, page, onPage: choose, reframe, onProgress } : null),
    [mobile, pages, page, choose, reframe, onProgress],
  )

  return (
    <div className="passport-atlas" data-paged={mobile ? '' : undefined}>
      <section aria-label={copy.map} className="passport-atlas-map">
        {failed ? (
          <p role="status" className="passport-atlas-note">
            {copy.unavailable}
          </p>
        ) : !client || mobile === null ? (
          <div className="passport-atlas-canvas" aria-hidden="true" />
        ) : (
          <Suspense fallback={<div className="passport-atlas-canvas" aria-hidden="true" />}>
            <AtlasMap
              locale={locale}
              entries={visits}
              pending={pendingCodes}
              name={name}
              onSelectCountry={onSelectCountry}
              quickVisit={quickVisit}
              fail={() => setFailed(true)}
              paging={paging}
            />
          </Suspense>
        )}
      </section>
      {!marked ? null : mobile ? (
        <AtlasPagesList
          locale={locale}
          axis={axis}
          onAxis={dated ? switchAxis : null}
          pages={pages}
          page={page}
          turn={turn}
          onPage={choose}
          follow={follow}
          mapless={failed}
          visits={visits}
          name={name}
          onSelectCountry={onSelectCountry}
          legend={
            entries.length ? <AtlasLegend locale={locale} pending={pending.length > 0} /> : null
          }
        />
      ) : mobile === false ? (
        <div className="passport-atlas-countries">
          <div className="passport-atlas-heading">
            <h3 className="passport-atlas-count">
              {formatCount(locale, entries.length + pending.length, COUNT)}
            </h3>
            {entries.length ? <AtlasLegend locale={locale} pending={pending.length > 0} /> : null}
          </div>
          <ul aria-label={copy.list} className="passport-atlas-list">
            {entries.map((entry) => (
              <li key={entry.code}>
                <button type="button" onClick={() => onSelectCountry(entry.code)}>
                  {name(entry.code)}
                </button>
              </li>
            ))}
            {pending.map((entry) => (
              <li key={entry.code}>
                <button type="button" onClick={() => onSelectCountry(entry.code)}>
                  {name(entry.code)} · {copy.pending}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="sr-only" role="status">
        {announced}
      </p>
    </div>
  )
}

function AtlasLegend({ locale, pending }: { locale: Locale; pending: boolean }) {
  const copy = COPY[locale]
  return (
    <div className="passport-atlas-legend">
      <span>{copy.visits}</span>
      <ul>
        {BUCKET_LABELS[locale].map((label, index) => (
          <li key={label}>
            <span
              className="passport-atlas-swatch"
              style={{ background: `var(${ATLAS_VISIT_TOKENS[index]})` }}
              aria-hidden="true"
            />
            {label}
          </li>
        ))}
        {pending ? (
          <li>
            <span className="passport-atlas-swatch" data-pending="" aria-hidden="true" />
            {copy.pending}
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function Swatch({ count }: { count: number | undefined }) {
  return count !== undefined ? (
    <span
      className="passport-atlas-swatch"
      style={{ background: `var(${ATLAS_VISIT_TOKENS[Math.max(1, visitBucket(count)) - 1]})` }}
      aria-hidden="true"
    />
  ) : (
    <span className="passport-atlas-swatch" data-pending="" aria-hidden="true" />
  )
}

function AtlasPagesList({
  locale,
  axis,
  onAxis,
  pages,
  page,
  turn,
  onPage,
  follow,
  mapless,
  visits,
  name,
  onSelectCountry,
  legend,
}: {
  locale: Locale
  axis: AtlasAxis
  onAxis: ((axis: AtlasAxis) => void) | null
  pages: AtlasPage[]
  page: number
  turn: number | null
  onPage: (index: number) => void
  follow: Ref<(position: number) => void>
  mapless: boolean
  visits: ReadonlyMap<string, number>
  name: (code: string) => string
  onSelectCountry: (code: string) => void
  legend: ReactNode
}) {
  const copy = COPY[locale]
  const reduced = useReducedMotion() ?? false
  const strip = useRef<HTMLElement>(null)
  const thumb = useRef<HTMLLIElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const shown = useRef(page)
  const driven = useRef(false)
  const focusTitle = useRef(false)
  const layout = useRef<{
    tabs: { x: number; y: number; w: number; h: number }[]
    w: number
    h: number
  }>({
    tabs: [],
    w: 0,
    h: 0,
  })
  const current = pages[page]
  const cover = current.id === 'world'

  const measureTabs = useCallback(() => {
    const list = thumb.current?.parentElement
    if (!list) return
    layout.current = {
      tabs: [...list.querySelectorAll<HTMLElement>('li > button')].map((tab) => ({
        x: tab.offsetLeft,
        y: tab.offsetTop,
        w: tab.offsetWidth,
        h: tab.offsetHeight,
      })),
      w: list.offsetWidth,
      h: list.offsetHeight,
    }
  }, [])
  const draw = useCallback(
    (position: number, glide: boolean) => {
      const nav = strip.current,
        mark = thumb.current
      const { tabs, w, h } = layout.current
      if (!nav || !mark || !tabs.length) return
      shown.current = position
      const last = tabs.length - 1
      const clamped = Math.max(0, Math.min(last, position))
      const index = Math.floor(clamped),
        t = clamped - index
      const a = tabs[index],
        b = tabs[Math.min(last, index + 1)]
      const x = a.x + (b.x - a.x) * t
      const width = a.w + (b.w - a.w) * t
      mark.toggleAttribute('data-glide', glide && !reduced)
      mark.style.clipPath = `inset(${a.y}px ${w - x - width}px ${h - a.y - a.h}px ${x}px round var(--radius-sm))`
      if (nav.scrollWidth <= nav.clientWidth) return
      const left = Math.round(x + width / 2 - nav.clientWidth / 2)
      if (glide) nav.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
      else if (left !== nav.scrollLeft) nav.scrollLeft = left
    },
    [reduced],
  )
  useImperativeHandle(
    follow,
    () => (position: number) => {
      driven.current = true
      draw(position, false)
    },
    [draw],
  )
  useEffect(() => {
    if (mapless) driven.current = false
  }, [mapless])
  useLayoutEffect(() => {
    measureTabs()
    draw(shown.current, false)
  }, [pages, measureTabs, draw])
  useLayoutEffect(() => {
    if (!driven.current) draw(page, true)
  }, [page, draw])
  useEffect(() => {
    const list = thumb.current?.parentElement
    if (!list) return
    const observer = new ResizeObserver(() => {
      measureTabs()
      draw(shown.current, false)
    })
    observer.observe(list)
    return () => observer.disconnect()
  }, [measureTabs, draw])

  useScrollFade(strip, pages.length)
  useEffect(() => {
    if (!focusTitle.current) return
    focusTitle.current = false
    title.current?.focus({ preventScroll: true })
  }, [page])

  const arrows = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = Math.max(
      0,
      Math.min(pages.length - 1, page + (event.key === 'ArrowRight' ? 1 : -1)),
    )
    if (next === page) return
    onPage(next)
    strip.current?.querySelectorAll<HTMLButtonElement>('li > button')[next]?.focus()
  }
  const openPage = (index: number) => {
    focusTitle.current = true
    onPage(index)
    strip.current
      ?.closest('.passport-atlas')
      ?.querySelector('.passport-atlas-map')
      ?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }
  const count = (entry: AtlasPage) =>
    formatCount(
      locale,
      entry.codes.length,
      typeof entry.id === 'number' ? NEW_COUNTRIES : COUNTRIES,
    )

  return (
    <>
      <nav ref={strip} className="passport-atlas-strip" aria-label={copy.strip[axis]}>
        <ul>
          <li ref={thumb} className="passport-atlas-strip-thumb" aria-hidden="true" />
          {pages.map((entry, index) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-current={index === page ? 'true' : undefined}
                onClick={() => onPage(index)}
                onKeyDown={arrows}
              >
                {pageName(locale, entry.id)}
                <span className="passport-atlas-strip-count">{entry.codes.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="passport-atlas-countries">
        <div
          key={current.id}
          className="passport-atlas-page"
          data-turn={turn ?? undefined}
          style={{ '--turn': turn ?? 0 } as CSSProperties}
        >
          <div className="passport-atlas-heading">
            <h3 ref={title} tabIndex={-1} className="passport-atlas-title">
              {pageName(locale, current.id)}
            </h3>
            <span className="passport-atlas-total">{count(current)}</span>
            {cover && onAxis ? (
              <div className="passport-atlas-axis">
                <SegmentedControl
                  dense
                  label={copy.axis}
                  value={axis}
                  onChange={onAxis}
                  options={[
                    { value: 'regions', label: copy.regions },
                    { value: 'years', label: copy.years },
                  ]}
                />
              </div>
            ) : null}
          </div>
          {legend}
          <ul key={axis} aria-label={copy.list} className="passport-atlas-rows">
            {cover
              ? pages.slice(1).map((entry, index) => (
                  <li key={entry.id}>
                    <button type="button" data-group="" onClick={() => openPage(index + 1)}>
                      <span>{pageName(locale, entry.id)}</span>
                      <span className="passport-atlas-row-inks" aria-hidden="true">
                        {entry.codes.slice(0, 6).map((code) => (
                          <Swatch key={code} count={visits.get(code)} />
                        ))}
                      </span>
                      <span className="passport-atlas-row-meta">{count(entry)}</span>
                      <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </li>
                ))
              : current.codes.map((code) => {
                  const visitCount = visits.get(code)
                  return (
                    <li key={code}>
                      <button type="button" onClick={() => onSelectCountry(code)}>
                        <Swatch count={visitCount} />
                        <span>{name(code)}</span>
                        <span className="passport-atlas-row-meta">
                          {visitCount === undefined
                            ? copy.pending
                            : visitCount
                              ? formatCount(locale, visitCount, VISITS)
                              : null}
                        </span>
                        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
          </ul>
        </div>
      </div>
    </>
  )
}
