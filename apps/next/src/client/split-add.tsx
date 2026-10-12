'use client'

import { useState } from 'react'
import { NavigationLink as Link } from './navigation-link'
import { ChevronIcon } from './ui/icon-morph'
import { Plus } from './ui/animated-icons'
import { AddActions } from './add-actions'
import { Menu } from './ui/menu'

/** Arc split-button composition, adapted through existing route links and Menu (MIT; ui/ARC-LICENSE.txt). Desktop capture entry: the main half is manual add; the chevron lists upload, paste and manual. */
export function SplitAdd({ locale = 'en' }: { locale?: 'en' | 'ru' }) {
  const ru = locale === 'ru'
  const [keyboard, setKeyboard] = useState(false)
  return (
    <div
      className="split-add"
      data-icon-instant={keyboard ? 'true' : undefined}
      onKeyDownCapture={() => setKeyboard(true)}
      onPointerDownCapture={() => setKeyboard(false)}
    >
      <Link href="/add" className="split-add-main">
        <Plus size={18} strokeWidth={2} aria-hidden="true" />
        <span className="locale-en">Add</span>
        <span className="locale-ru" lang="ru">
          Добавить
        </span>
      </Link>
      <Menu
        align="end"
        trigger={
          <button
            type="button"
            className="split-add-more"
            aria-label={ru ? 'Другие способы добавить' : 'More ways to add'}
          >
            <ChevronIcon size={18} strokeWidth={2} />
          </button>
        }
      >
        <AddActions variant="menu" locale={locale} />
      </Menu>
    </div>
  )
}
