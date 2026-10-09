'use client'

import { NavigationLink as Link } from './navigation-link'
import { useAwaiting } from './awaiting'
import { formatNumber } from '../lib/format'
import { ClipboardCheck, ClipboardPaste, PenLine, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { MenuItem } from './ui/menu'

type Action = {
  id: 'upload' | 'paste' | 'manual'
  href: string
  en: string
  ru: string
  icon: ReactNode
}

/** The capture entry points. One list feeds the desktop split-Add menu and the mobile action sheet. */
export const ADD_ACTIONS: readonly Action[] = [
  {
    id: 'upload',
    href: '/import?source=file',
    en: 'Upload a boarding pass or PDF',
    ru: 'Загрузить посадочный или PDF',
    icon: <Upload size={20} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'paste',
    href: '/import?source=text',
    en: 'Paste text',
    ru: 'Вставить текст',
    icon: <ClipboardPaste size={20} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'manual',
    href: '/add',
    en: 'Enter manually',
    ru: 'Ввести вручную',
    icon: <PenLine size={20} strokeWidth={2} aria-hidden="true" />,
  },
]

function Label({ action }: { action: Action }) {
  return (
    <>
      <span className="locale-en">{action.en}</span>
      <span className="locale-ru" lang="ru">
        {action.ru}
      </span>
    </>
  )
}

/** `menu` renders Radix menu items (inside a Menu); `sheet` renders a plain list of links for the action sheet. */
export function AddActions({
  variant,
  onNavigate,
}: {
  variant: 'menu' | 'sheet'
  onNavigate?: () => void
}) {
  const { data } = useAwaiting()
  const queueLink =
    data && data.actionableCount > 0 ? (
      <Link
        href="/journal?queue=awaiting"
        className={variant === 'sheet' ? 'add-action' : undefined}
        data-add-action="queue"
        onClick={onNavigate}
      >
        <ClipboardCheck size={20} strokeWidth={2} aria-hidden="true" />
        <span className="locale-en">
          Awaiting action: {formatNumber('en', data.actionableCount)}
        </span>
        <span className="locale-ru">Ждут действия: {formatNumber('ru', data.actionableCount)}</span>
      </Link>
    ) : null
  if (variant === 'menu') {
    return (
      <>
        {ADD_ACTIONS.map((action) => (
          <MenuItem key={action.id} asChild>
            <Link href={action.href} data-add-action={action.id}>
              {action.icon}
              <Label action={action} />
            </Link>
          </MenuItem>
        ))}
        {queueLink ? <MenuItem asChild>{queueLink}</MenuItem> : null}
      </>
    )
  }
  return (
    <ul className="add-actions">
      {ADD_ACTIONS.map((action) => (
        <li key={action.id}>
          <Link
            href={action.href}
            className="add-action"
            data-add-action={action.id}
            onClick={onNavigate}
          >
            {action.icon}
            <Label action={action} />
          </Link>
        </li>
      ))}
      {queueLink ? <li>{queueLink}</li> : null}
    </ul>
  )
}
