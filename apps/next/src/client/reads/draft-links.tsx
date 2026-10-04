'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { listDrafts, type DraftSummary } from '../capture/drafts'

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener('kuuki:draft-change', listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener('kuuki:draft-change', listener) }
}
export function DraftLinks({ ownerId, locale }: { ownerId: string; locale: 'en' | 'ru' }) {
  const stored = useSyncExternalStore(subscribe, () => JSON.stringify(listDrafts(ownerId)), () => '[]')
  const drafts = JSON.parse(stored) as DraftSummary[]
  if (!drafts.length) return null
  return <section aria-label={locale === 'ru' ? 'Черновики импорта' : 'Import drafts'} className="read-panel">
    <h2>{locale === 'ru' ? 'Черновики' : 'Drafts'}</h2>
    <p>{locale === 'ru' ? 'Сохранены в этом браузере на 30 дней. Продолжите проверку несохранённых перелётов.' : 'Stored in this browser for 30 days. Continue reviewing the flights that remain unsaved.'}</p>
    <ul>{drafts.map(draft => <li key={draft.id}><Link href={`/import?draft=${draft.id}`}>{locale === 'ru' ? 'Продолжить импорт' : 'Continue import'} · {draft.count}</Link></li>)}</ul>
  </section>
}
