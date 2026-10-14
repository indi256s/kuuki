'use client'

import { useLocale } from './preferences'

import { Plus } from '@keyline-icons/react'
import { AddActions } from './add-actions'
import { ChevronIcon } from './ui/icon-morph'
import { Menu } from './ui/menu'

/** Desktop capture entry: one "Add flight" button opening the four capture rows (and the review queue when it has items). */
export function AddMenu({ locale: initialLocale = 'en' }: { locale?: 'en' | 'ru' }) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru'
  return (
    <Menu
      align="end"
      sideOffset={8}
      className="add-menu"
      trigger={
        <button type="button" className="add-button">
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          {ru ? 'Добавить перелёт' : 'Add flight'}
          <ChevronIcon size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      }
    >
      <AddActions locale={locale} />
    </Menu>
  )
}
