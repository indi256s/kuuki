'use client'

import type { SectionId } from '@kuuki/shared/overview/prefs'
import { formatCount } from '../../../lib/format'
import { Button } from '../../ui/button'
import { Menu, MenuItem } from '../../ui/menu'
import { SECTIONS } from '../sections/registry'
import { useOverview } from '../store/overview-context'
import { t } from '../copy'
import './layout.css'

export function HiddenFooter({
  hidden,
  onShow,
}: {
  hidden: SectionId[]
  onShow: (id: SectionId | 'all') => void
}) {
  const { locale } = useOverview()
  return (
    <footer className="ov3-hidden" data-region="hidden">
      {hidden.length ? (
        <>
          <span>
            {formatCount(locale, hidden.length, {
              en: { one: '{count} hidden section', other: '{count} hidden sections' },
              ru: {
                one: '{count} скрытый раздел',
                few: '{count} скрытых раздела',
                many: '{count} скрытых разделов',
                other: '{count} скрытого раздела',
              },
            })}{' '}
            ·{' '}
          </span>
          <Menu
            trigger={
              <Button variant="ghost" data-section-show>
                {t({ en: 'Show', ru: 'Показать' }, locale)}
              </Button>
            }
          >
            {hidden.map((id) => (
              <MenuItem key={id} onSelect={() => onShow(id)}>
                {t(SECTIONS[id].title, locale)}
              </MenuItem>
            ))}
            <MenuItem onSelect={() => onShow('all')}>
              {t({ en: 'Show all', ru: 'Показать все' }, locale)}
            </MenuItem>
          </Menu>
        </>
      ) : null}
    </footer>
  )
}
