'use client'
import { useEffect, useState, type CSSProperties } from 'react'
// Keyline Upload is the platform share glyph (tray and arrow) the boards draw.
import { Check, Upload as ShareGlyph } from '@keyline-icons/react'
import { Field } from '../ui/field'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import {
  badgeDescription,
  badgeEventId,
  badgeName,
  badgeTier,
  type EarnedBadge,
} from './achievements'
import { notificationStorage } from './storage'
import { unseenBadges } from './unseen'
import { formatDateOnly, type Locale } from '../../lib/format'
import './profile.css'

/** Native share sheet on touch devices that have one; everywhere else the link is copied (spec: owner Share). */
export function ShareProfile({
  url,
  title,
  locale,
}: {
  url: string
  title: string
  locale: Locale
}) {
  const [result, setResult] = useState<'copied' | 'fallback' | null>(null)
  const ru = locale === 'ru'
  const idle = ru ? 'Поделиться профилем' : 'Share profile'
  const copied = ru ? 'Ссылка скопирована' : 'Link copied'
  return (
    <div className="profile-share">
      <Button
        variant="primary"
        morphText
        icon={
          result === 'copied' ? (
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ShareGlyph size={16} strokeWidth={1.75} aria-hidden="true" />
          )
        }
        textAlternatives={[idle, copied]}
        onClick={async () => {
          if (
            typeof navigator.share === 'function' &&
            window.matchMedia?.('(pointer: coarse)').matches
          ) {
            try {
              await navigator.share({ url, title })
              return
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') return
            }
          }
          try {
            await navigator.clipboard.writeText(url)
            setResult('copied')
          } catch {
            setResult('fallback')
          }
        }}
      >
        {result === 'copied' ? copied : idle}
      </Button>
      {result === 'copied' && (
        <p className="sr-only" role="status">
          {ru ? 'Ссылка скопирована.' : 'Link copied.'}
        </p>
      )}
      {result === 'fallback' && (
        <Field
          label={ru ? 'Скопируйте ссылку вручную' : 'Copy this link manually'}
          readOnly
          value={url}
          autoFocus
          onFocus={(event) => event.target.select()}
        />
      )}
    </div>
  )
}

/** Tier glyphs drawn as shapes (the boards' 24px marks), never as text: font coverage of ⬟/⬡ varies. */
function BadgeGlyph({ tier }: { tier: string | null }) {
  const shape =
    tier === 'gold' ? (
      <path d="M12 3l8.5 6.2-3.2 10H6.7l-3.2-10z" className="profile-glyph-fill" />
    ) : tier === 'platinum' ? (
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />
    ) : tier === 'silver' ? (
      <path d="M12 4l7 8-7 8-7-8z" />
    ) : tier === 'bronze' ? (
      <path d="M12 4l9 16H3z" />
    ) : tier === 'diamond' ? (
      <path d="M12 4l7 8-7 8-7-8z" className="profile-glyph-fill" />
    ) : (
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    )
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      {shape}
    </svg>
  )
}

/** Mobile shows two rows of three before "Show all" (spec: 3-col grid). */
const COLLAPSED = 6

/**
 * Earned badges only. On the owner's page, badges earned since their last visit press into their slots once (the
 * cabinet keeps its own per-owner baseline, separate from the toast). A first-ever visit only records the baseline.
 */
export function BadgeCabinet({
  badges,
  locale,
  ownerId,
}: {
  badges: EarnedBadge[]
  locale: Locale
  ownerId: string | null
}) {
  const ru = locale === 'ru'
  const mobile = useMobile() === true
  const [open, setOpen] = useState<EarnedBadge | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [fresh, setFresh] = useState<string[]>([])
  useEffect(() => {
    if (!ownerId) return
    const result = unseenBadges(ownerId, badges, notificationStorage(), 'badge-cabinet')
    // Effects run twice in development; the in-memory baseline makes the second pass empty, so keep the first.
    // oxlint-disable-next-line hooks-compat/set-state-in-effect -- one-shot, derived from device storage that cannot be read during render
    if (result.badges.length) setFresh(result.badges.map(badgeEventId))
  }, [ownerId, badges])
  const tier = open ? badgeTier(open.badge.tier, locale) : null
  return (
    <>
      <ul className="profile-badges" data-collapsed={!expanded || undefined}>
        {badges.map((item) => {
          const order = fresh.indexOf(badgeEventId(item))
          const name = badgeName(item, locale)
          const label = badgeTier(item.badge.tier, locale).label
          return (
            <li
              key={item.id}
              data-fresh={order >= 0 || undefined}
              style={order >= 0 ? ({ '--fresh-i': order } as CSSProperties) : undefined}
            >
              <button
                type="button"
                className="profile-badge"
                aria-haspopup="dialog"
                onClick={() => setOpen(item)}
              >
                <span className="profile-badge-mark" data-tier={item.badge.tier ?? 'special'}>
                  <BadgeGlyph tier={item.badge.tier} />
                  {order >= 0 && <span className="profile-badge-new">{ru ? 'Новое' : 'New'}</span>}
                </span>
                <strong>{name}</strong>
                <small>{label}</small>
              </button>
            </li>
          )
        })}
      </ul>
      {badges.length > COLLAPSED && !expanded && (
        <button type="button" className="profile-badges-more" onClick={() => setExpanded(true)}>
          {ru ? `Показать все: ${badges.length}` : `Show all ${badges.length}`}
        </button>
      )}
      <Sheet
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        side={mobile ? 'bottom' : 'right'}
        title={open ? badgeName(open, locale) : ''}
        description={tier?.label}
        closeLabel={ru ? 'Закрыть' : 'Close'}
        className="profile-badge-sheet"
      >
        {open && (
          <>
            <span className="profile-badge-mark" data-tier={open.badge.tier ?? 'special'}>
              <BadgeGlyph tier={open.badge.tier} />
            </span>
            <p>{badgeDescription(open, locale)}</p>
            <p className="profile-badge-earned">
              {ru ? 'Получено' : 'Earned'}{' '}
              <time dateTime={open.earned_at}>{formatDateOnly(locale, open.earned_at)}</time>
            </p>
          </>
        )}
      </Sheet>
    </>
  )
}
