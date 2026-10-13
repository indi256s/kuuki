'use client'
import { useState } from 'react'
// Keyline Upload is the platform share glyph (tray and arrow) the boards draw.
import { Check, Upload as ShareGlyph } from '@keyline-icons/react'
import { Field } from '../ui/field'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'
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
