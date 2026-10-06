'use client'

import { useState, type ReactNode } from 'react'
import { CircleHelp, Globe } from 'lucide-react'
import { setLocale } from '../appearance'
import { useAppearance } from '../preferences'
import { Dialog } from '../ui/dialog'
import type { Locale } from '../../lib/format'
import { ThemeControl } from './theme-control'
import './auth-card.css'

const words = {
  en: {
    language: 'Language', help: 'Help', close: 'Close', about: 'About Kuuki',
    body: ['Kuuki is a private flight journal.', 'Sign in with your email and password, or use a new email to start your journal. Your flights stay private until you share them.', 'Can’t sign in? Use the link next to Password.'],
  },
  ru: {
    language: 'Язык', help: 'Помощь', close: 'Закрыть', about: 'О Kuuki',
    body: ['Kuuki — личный журнал перелётов.', 'Войдите с почтой и паролем или укажите новую почту, чтобы начать журнал. Перелёты видны только вам, пока вы ими не поделитесь.', 'Не получается войти? Нажмите ссылку рядом с полем «Пароль».'],
  },
}

function LanguageControl({ locale }: { locale: Locale }) {
  const current = useAppearance(locale).locale
  return <span className="auth-corner-control" data-kind="language">
    <Globe size={16} strokeWidth={1.75} aria-hidden="true" />
    <span aria-hidden="true">{current.toUpperCase()}</span>
    <select aria-label={words[locale].language} value={current} onChange={event => setLocale(event.target.value as Locale)}>
      <option value="en">EN</option>
      <option value="ru">RU</option>
    </select>
  </span>
}

function HelpControl({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false)
  const t = words[locale]
  return <Dialog open={open} onOpenChange={setOpen} title={t.about} closeLabel={t.close}
    trigger={<button type="button" className="auth-corner-control" aria-label={t.help}><CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" /></button>}>
    {t.body.map(line => <p key={line}>{line}</p>)}
  </Dialog>
}

/**
 * Language, theme and help in the card corner (top right of the form panel on desktop, the band header on mobile).
 * Each control is at least 44×44. `theme` swaps the theme control; the default is the temporary `ThemeControl`.
 */
export function CornerControls({ locale, theme }: { locale: Locale; theme?: ReactNode }) {
  return <div className="auth-corner">
    <LanguageControl locale={locale} />
    {theme ?? <ThemeControl locale={locale} />}
    <HelpControl locale={locale} />
  </div>
}
