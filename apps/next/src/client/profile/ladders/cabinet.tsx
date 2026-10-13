'use client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Sheet } from '../../ui/sheet'
import { useMobile } from '../../ui/use-mobile'
import { formatDateOnly, type Locale } from '../../../lib/format'
import { FoundingStub } from '../founding-crew'
import { notificationStorage } from '../storage'
import { unseenBadges } from '../unseen'
import {
  CLOSE,
  EARNED,
  FOUNDING,
  LADDER_NAME,
  NEW,
  RUNG_NAME,
  SHOW_ALL,
  SLOT_EARNED,
  SLOT_LOCKED,
  TOP_RUNG,
  normal,
  rungOf,
  sarcastic,
  toGo,
} from './copy'
import { LadderFigure, useStripK, type RungState } from './ladder-figure'
import {
  ladderOf,
  ladderValue,
  nextStep,
  rungValue,
  toTiles,
  visibleBadges,
  type LadderStats,
  type LadderTile,
} from './model'
import type { EarnedBadge } from '../achievements'
import type { LadderId } from './figures/types'
import '../profile.css'
import './ladders.css'

/** Mobile shows two rows of three before "Show all" (spec: 3-col grid). */
const COLLAPSED = 6

const tileKey = (tile: LadderTile) => (tile.kind === 'founding' ? 'founding' : tile.ladder)

/**
 * Earned achievements only: one tile per ladder at its highest rung, plus Founding crew. On the owner's page, tiles whose
 * ladder gained a rung since the last visit press into their slots once (the cabinet keeps its own per-owner baseline,
 * separate from the toast). A first-ever visit only records the baseline.
 */
export function AchievementCabinet({
  badges,
  stats,
  locale,
  ownerId,
  initials,
}: {
  badges: EarnedBadge[]
  stats: LadderStats | null
  locale: Locale
  ownerId: string | null
  initials?: string
}) {
  const mobile = useMobile() === true
  const tiles = toTiles(badges)
  const [open, setOpen] = useState<LadderTile | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [fresh, setFresh] = useState<string[]>([])
  useEffect(() => {
    if (!ownerId) return
    const result = unseenBadges(
      ownerId,
      visibleBadges(badges),
      notificationStorage(),
      'badge-cabinet',
    )
    const keys = [
      ...new Set(
        result.badges.map((item) =>
          item.badge.code === 'founding-user'
            ? 'founding'
            : (ladderOf(item.badge.code)?.ladder ?? ''),
        ),
      ),
    ].filter(Boolean)
    // Effects run twice in development; the in-memory baseline makes the second pass empty, so keep the first.
    // oxlint-disable-next-line hooks-compat/set-state-in-effect -- one-shot, derived from device storage that cannot be read during render
    if (keys.length) setFresh(keys)
  }, [ownerId, badges])
  return (
    <>
      <ul className="profile-badges" data-collapsed={!expanded || undefined}>
        {tiles.map((tile) => {
          const key = tileKey(tile)
          const order = fresh.indexOf(key)
          return (
            <li
              key={key}
              data-fresh={order >= 0 || undefined}
              style={order >= 0 ? ({ '--fresh-i': order } as CSSProperties) : undefined}
            >
              <button
                type="button"
                className="profile-badge"
                aria-haspopup="dialog"
                onClick={() => setOpen(tile)}
              >
                <span className="profile-badge-mark">
                  {tile.kind === 'founding' ? (
                    <FoundingStub />
                  ) : (
                    <LadderFigure
                      ladder={tile.ladder}
                      rung={tile.rung}
                      size="thumb"
                      initials={initials}
                    />
                  )}
                  {order >= 0 && <span className="profile-badge-new">{NEW[locale]}</span>}
                </span>
                {tile.kind === 'founding' ? (
                  <>
                    <strong>{FOUNDING.name[locale]}</strong>
                  </>
                ) : (
                  <>
                    <strong>{RUNG_NAME[tile.ladder][tile.rung - 1][locale]}</strong>
                    <small>{rungOf(tile.rung, tile.rungs, locale)}</small>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {tiles.length > COLLAPSED && !expanded && (
        <button type="button" className="profile-badges-more" onClick={() => setExpanded(true)}>
          {SHOW_ALL(tiles.length, locale)}
        </button>
      )}
      <Sheet
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        side={mobile ? 'bottom' : 'right'}
        title={
          open
            ? open.kind === 'founding'
              ? FOUNDING.name[locale]
              : RUNG_NAME[open.ladder][open.rung - 1][locale]
            : ''
        }
        description={
          open?.kind === 'ladder'
            ? `${LADDER_NAME[open.ladder][locale]} · ${rungOf(open.rung, open.rungs, locale)}`
            : undefined
        }
        closeLabel={CLOSE[locale]}
        className="profile-badge-sheet ladder-sheet"
      >
        {open?.kind === 'founding' && (
          <>
            <div className="ladder-stage ladder-stage-founding">
              <FoundingStub />
            </div>
            <p>{FOUNDING.normal[locale]}</p>
            <p className="ladder-sarcastic">{FOUNDING.sarcastic[locale]}</p>
            <Earned item={open.item} locale={locale} />
          </>
        )}
        {open?.kind === 'ladder' && (
          <LadderDetail tile={open} stats={stats} locale={locale} initials={initials} />
        )}
      </Sheet>
    </>
  )
}

function Earned({ item, locale }: { item: EarnedBadge; locale: Locale }) {
  return (
    <p className="profile-badge-earned">
      <time dateTime={item.earned_at}>
        {EARNED(formatDateOnly(locale, item.earned_at), locale)}
      </time>
    </p>
  )
}

function LadderDetail({
  tile,
  stats,
  locale,
  initials,
}: {
  tile: Extract<LadderTile, { kind: 'ladder' }>
  stats: LadderStats | null
  locale: Locale
  initials?: string
}) {
  const { ladder, rung, rungs } = tile
  const value = stats ? ladderValue(ladder, stats) : rungValue(ladder, rung)
  const step = nextStep(ladder, rung, stats)
  return (
    <>
      <div className="ladder-stage">
        <LadderFigure ladder={ladder} rung={rung} size="hero" initials={initials} />
      </div>
      <p>{normal(ladder, value, locale)}</p>
      <p className="ladder-sarcastic">{sarcastic(ladder, rung, value, locale)}</p>
      <Earned item={tile.item} locale={locale} />
      <RungStrip
        ladder={ladder}
        rung={rung}
        rungs={rungs}
        step={step}
        locale={locale}
        initials={initials}
      />
    </>
  )
}

function RungStrip({
  ladder,
  rung,
  rungs,
  step,
  locale,
  initials,
}: {
  ladder: LadderId
  rung: number
  rungs: number
  step: ReturnType<typeof nextStep>
  locale: Locale
  initials?: string
}) {
  const k = useStripK(ladder)
  const strip = useRef<HTMLOListElement>(null)
  // The strip scrolls sideways. When the next rung would open out of view, start the strip at the current rung instead.
  useEffect(() => {
    const list = strip.current
    const current = list?.children[rung - 1]
    const next = list?.children[Math.min(rung, rungs - 1)]
    if (!list || !current || !next) return
    const box = list.getBoundingClientRect()
    if (next.getBoundingClientRect().right <= box.right) return
    list.scrollLeft +=
      current.getBoundingClientRect().left -
      box.left -
      parseFloat(getComputedStyle(list).paddingInlineStart)
  }, [rung, rungs])
  return (
    <>
      <ol ref={strip} className="ladder-strip">
        {Array.from({ length: rungs }, (_, i) => {
          const n = i + 1
          const state: RungState = n <= rung ? 'earned' : n === rung + 1 ? 'next' : 'later'
          const name = RUNG_NAME[ladder][i][locale]
          return (
            <li key={n} className="ladder-slot" data-state={state}>
              <LadderFigure
                ladder={ladder}
                rung={n}
                size="thumb"
                state={state}
                k={k}
                initials={initials}
              />
              <span className="ladder-slot-name">{name}</span>
              {state === 'next' && step && (
                <span className="ladder-slot-togo">{toGo(ladder, step.remaining, locale)}</span>
              )}
              {state !== 'next' && (
                <span className="sr-only">
                  {(state === 'earned' ? SLOT_EARNED : SLOT_LOCKED)[locale]}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {rung === rungs && <p className="ladder-top">{TOP_RUNG[locale]}</p>}
    </>
  )
}
