'use client'

import clsx from 'clsx'
import { useLayoutEffect, useState, type CSSProperties } from 'react'
import { FRAME_WEIGHTS, frames, restTilt, type ShapeName } from '../../lib/stamp-art/frame'
import { impressionTransform } from '../../lib/stamp-art/impression'
import type { Locale } from '../../lib/format'
import { markPressed, wasPressed } from '../signature/stamp'
import { emWidth } from './ring-fit'
import { stampMeta, type StampMeta } from './stamp-meta'
import './country-stamp.css'

export type StampPreview = {
  meta: StampMeta
  engraving?: string
  rings: Partial<Record<ShapeName, string>>
}

export type CountryStampProps = {
  preview?: StampPreview
  iso2: string
  locale?: Locale
  status: 'inked' | 'pending'
  size?: number
  impressionId?: string
  static?: boolean
  worn?: boolean
  viewTransitionName?: string
  shape?: ShapeName
  pose?: 'hover' | 'focus' | 'press'
  className?: string
}

export const DEFAULT_STAMP_SIZE = 160
const PENDING_STROKE = 1.6

type FaceProps = {
  iso2: string
  shape: ShapeName
  iso3: string
  engraved: boolean
  ringed: boolean
  pending: boolean
  preview?: StampPreview
}

function Face({ iso2, shape, iso3, engraved, ringed, pending, preview }: FaceProps) {
  const f = frames[shape]
  const [wx, wy, ww, wh] = f.windowBox
  const big = Math.min(wh * 0.34, (Math.min(ww, wh * 1.5) * 0.62) / (emWidth(iso3) + 0.16))
  const file = iso2.toLowerCase()
  return (
    <span className="cs-face">
      {engraved ? (
        <span
          className="cs-engraving"
          style={{ maskImage: `url("${preview?.engraving ?? `/stamps/${file}.svg`}")` }}
        />
      ) : null}
      {ringed ? (
        <span
          className="cs-engraving"
          style={{ maskImage: `url("${preview?.rings[shape] ?? `/stamps/ring/${file}.svg`}")` }}
        />
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
  preview,
}: CountryStampProps) {
  const meta = preview?.meta ?? stampMeta(iso2)
  const shape = shapeOverride ?? meta.shape
  const pending = status === 'pending'
  const engraved = meta.tier === 'engraved' && shape === meta.shape
  const tilt = restTilt(meta.iso2, shape)
  const imp = impressionTransform(meta.iso2, tilt)

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
      ringed={(preview ? !!preview.rings[shape] : shape === meta.shape) && !pending}
      preview={preview}
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
