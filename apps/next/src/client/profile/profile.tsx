'use client'
import { useRef, useState } from 'react'
import { Button } from '../ui/button'
import { badgeName, badgeTier, badgeDescription, type EarnedBadge } from './achievements'
import { formatDateOnly, type Locale } from '../../lib/format'
import './profile.css'

export function ShareProfile({ url, locale }: { url: string; locale: Locale }) {
  const [result, setResult] = useState<'copied' | 'fallback' | null>(null)
  const ru = locale === 'ru'
  return <div className="profile-share"><Button morphText textAlternatives={[ru ? 'Скопировать ссылку' : 'Copy profile link', ru ? 'Скопировано' : 'Copied']} onClick={async () => { try { await navigator.clipboard.writeText(url); setResult('copied') } catch { setResult('fallback') } }}>{result === 'copied' ? (ru ? 'Скопировано' : 'Copied') : (ru ? 'Скопировать ссылку' : 'Copy profile link')}</Button>
    {result === 'copied' && <p role="status">{ru ? 'Ссылка скопирована.' : 'Link copied.'}</p>}
    {result === 'fallback' && <label>{ru ? 'Скопируйте ссылку вручную' : 'Copy this link manually'}<input readOnly value={url} autoFocus onFocus={event => event.target.select()} /></label>}
  </div>
}
function BadgeDetails({ item, locale }: { item: EarnedBadge; locale: Locale }) {
  const pointerFocus = useRef(false)
  const tier = badgeTier(item.badge.tier, locale)
  return <details onPointerDownCapture={() => { pointerFocus.current = true }} onBlurCapture={() => { pointerFocus.current = false }} onFocusCapture={event => { if (!pointerFocus.current) event.currentTarget.open = true }}>
    <summary tabIndex={0}><span aria-hidden="true" className="badge-shape" data-tier={item.badge.tier}>{tier.shape}</span><span><strong>{badgeName(item, locale)}</strong><small>{tier.label}</small></span></summary>
    <p>{badgeDescription(item, locale)}</p><p>{locale === 'ru' ? 'Получено' : 'Earned'} <time dateTime={item.earned_at}>{formatDateOnly(locale, item.earned_at)}</time></p>
  </details>
}
export function Achievements({ badges, locale }: { badges: EarnedBadge[]; locale: Locale }) {
  return badges.length ? <ul className="profile-badges">{badges.map(item => <li key={item.id}><BadgeDetails item={item} locale={locale} /></li>)}</ul> : <p>{locale === 'ru' ? 'Достижений пока нет.' : 'No achievements yet.'}</p>
}
