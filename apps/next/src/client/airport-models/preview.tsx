'use client'
import { useSyncExternalStore } from 'react'
import type { AirportCatalogEntry } from '../../lib/airport-models/model'
import { useLocale } from '../preferences'
import './preview.css'
function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  window.addEventListener('kuuki:appearance', notify)
  return () => {
    observer.disconnect()
    window.removeEventListener('kuuki:appearance', notify)
  }
}
/** Height-based sizing preserves the prepared orthographic metres per pixel at every aspect ratio. */
export function AirportPreview({
  entry,
  className,
}: {
  entry: AirportCatalogEntry
  className?: string
}) {
  const locale = useLocale()
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
    () => 'light' as const,
  )
  return (
    <div className={`airport-preview ${className ?? ''}`}>
      <picture>
        <source media="(max-width: 700px)" srcSet={entry.previews.mobile[theme]} />
        <img
          src={entry.previews.desktop[theme]}
          alt={`${entry.name} — ${locale === 'ru' ? 'схема аэропорта' : 'airport plan'}`}
        />
      </picture>
    </div>
  )
}
