'use client'

import clsx from 'clsx'
import { useLayoutEffect, useState, type CSSProperties } from 'react'
import { FRAME_WEIGHTS, frames, restTilt, type ShapeName } from '../../lib/stamp-art/frame'
import { impressionTransform } from '../../lib/stamp-art/impression'
import type { Locale } from '../../lib/format'
import { markPressed, wasPressed } from '../signature/stamp'
import { emWidth } from './ring-fit'
import { stampMeta } from './stamp-meta'
import './country-stamp.css'

export type CountryStampProps = {
  iso2: string
  /** Not used by the stamp: the ring text is baked in its own script and English at generation time. Kept so callers need no change. */
  locale?: Locale
  /** `pending` is the dashed outline without ink. */
  status: 'inked' | 'pending'
  /** Edge length in px. */
  size?: number
  /**
   * Immutable ID of the press event. The full impression (scale-in and ink drying into the worn
   * layer) plays once per ID per browser session; remounts and refetches never replay it.
   * The memory is shared with the legacy `Stamp`: the same ID never replays across both.
   */
  impressionId?: string
  /** No motion at all (grids, print). */
  static?: boolean
  /** Wear texture (B1). `false` shows the clean, full-density stamp. Default true. */
  worn?: boolean
  /** Hook for view transitions. */
  viewTransitionName?: string
  /** Frame override for previews (worst-case names). Drops the engraving when it differs from the country's own shape. */
  shape?: ShapeName
  /** Forces a pose for contact sheets: the state CSS normally reached through hover, focus or press. */
  pose?: 'hover' | 'focus' | 'press'
  className?: string
}

export const DEFAULT_STAMP_SIZE = 160
/** Pending stamps draw the outer rule alone, thinner than the inked one. */
const PENDING_STROKE = 1.6

type FaceProps = {
  iso2: string
  shape: ShapeName
  iso3: string
  engraved: boolean
  /** The baked ring text exists for the country's own shape only. */
  ringed: boolean
  pending: boolean
}

/** One complete copy of the stamp: frame, baked ring text, engraving. */
function Face({ iso2, shape, iso3, engraved, ringed, pending }: FaceProps) {
  const f = frames[shape]
  const [wx, wy, ww, wh] = f.windowBox
  // Fallback tier: the ISO3 code set large in the window.
  const big = Math.min(wh * 0.34, (Math.min(ww, wh * 1.5) * 0.62) / (emWidth(iso3) + 0.16))
  const file = iso2.toLowerCase()
  return (
    <span className="cs-face">
      {engraved ? (
        <span className="cs-engraving" style={{ maskImage: `url(/stamps/${file}.svg)` }} />
      ) : null}
      {ringed ? (
        <span className="cs-engraving" style={{ maskImage: `url(/stamps/ring/${file}.svg)` }} />
      ) : null}
      <svg className="cs-frame" viewBox={f.viewBox} aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" className="cs-rules">
          <path d={f.outer[0]} strokeWidth={pending ? PENDING_STROKE : FRAME_WEIGHTS.outer} />
          {pending ? null : (
            <>
              <path d={f.outer[1]} strokeWidth={FRAME_WEIGHTS.inner} />
              <path d={f.window} strokeWidth={FRAME_WEIGHTS.window} />
            </>
          )}
        </g>
        {pending ? null : (
          <>
            {engraved ? null : (
              <text
                className="cs-ring cs-code"
                x={wx + ww / 2}
                y={wy + wh / 2}
                fontSize={big}
                letterSpacing={big * 0.08}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {iso3}
              </text>
            )}
          </>
        )}
      </svg>
    </span>
  )
}

/**
 * Country stamp: ink frame with ring text, engraving as a CSS mask in the ink colour, a worn
 * impression layer over it, and the Q34 motion. Decorative: the card carries the name and status.
 *
 * Layers (back to front, all inside the tilting wrapper):
 *   `.cs-worn`  frame + engraving masked by the shared wear texture (per-shape, offset and turned per country)
 *   `.cs-full`  the same content without the texture, opacity 0 at rest; press fades it in, a new
 *               impression starts at 1 and dries into the worn layer
 * With `worn={false}` only a clean layer is rendered. Pending renders the dashed frame alone.
 *
 * Motion needs a host: put `data-stamp-host` on the card (or use an `a`/`button`) so its hover,
 * focus-visible and active states drive the stamp. The stamp itself is not focusable.
 */
export function CountryStamp({
  iso2,
  status,
  size = DEFAULT_STAMP_SIZE,
  impressionId,
  static: isStatic,
  worn = true,
  viewTransitionName,
  shape: shapeOverride,
  pose,
  className,
}: CountryStampProps) {
  const meta = stampMeta(iso2)
  const shape = shapeOverride ?? meta.shape
  const pending = status === 'pending'
  const engraved = meta.tier === 'engraved' && shape === meta.shape
  const tilt = restTilt(meta.iso2, shape)
  const imp = impressionTransform(meta.iso2, tilt)

  // Decided after hydration so server markup never depends on session memory; marked synchronously so remounts cannot replay.
  const [played, setPlayed] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (isStatic || pending || !impressionId) return
    if (wasPressed(impressionId)) return
    markPressed(impressionId)
    // oxlint-disable-next-line hooks-compat/set-state-in-effect -- one-shot, derived from browser-session memory that cannot be read during render
    setPlayed(impressionId)
  }, [isStatic, pending, impressionId])

  const style = {
    '--cs-size': `${size}px`,
    '--cs-tilt': `${tilt}deg`,
    '--cs-ink': pending ? 'var(--text-muted)' : `var(--stamp-ink-${meta.ink})`,
    '--imp-dx': imp.dx,
    '--imp-dy': imp.dy,
    '--imp-rot': `${imp.rotate}deg`,
    viewTransitionName,
  } as CSSProperties
  const face = (
    <Face
      iso2={meta.iso2}
      shape={shape}
      iso3={meta.iso3}
      engraved={engraved && !pending}
      ringed={shape === meta.shape && !pending}
      pending={pending}
    />
  )
  const layered = worn && !pending
  return (
    <span
      className={clsx('country-stamp', className)}
      data-shape={shape}
      data-status={status}
      data-ink={meta.ink}
      data-tier={engraved ? 'engraved' : 'fallback'}
      data-static={isStatic ? '' : undefined}
      data-worn={layered ? '' : undefined}
      data-pose={pose}
      style={style}
      aria-hidden="true"
    >
      <span className="cs-tilt" key={played ?? 'rest'} data-impress={played ? '' : undefined}>
        {layered ? (
          <span className="cs-worn" data-shape={shape}>
            <span className="cs-content">{face}</span>
          </span>
        ) : null}
        {!layered || !isStatic ? <span className="cs-full">{face}</span> : null}
      </span>
    </span>
  )
}
