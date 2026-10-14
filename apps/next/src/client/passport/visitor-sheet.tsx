'use client'

import { CountryStamp } from '../stamps'
import { Sheet } from '../ui/sheet'
import type { Locale } from '../../lib/format'
import { isCatalogCountry } from './model'
import { SHEET_STAMP_SIZE } from './stamp-sizes'
import './passport.css'

/**
 * The read-only country sheet for visitors and the owner's visitor preview: the large stamp and the name, nothing
 * else. A catalog country outside the public set shows the name alone, with no stamp that would claim a visit.
 */
export function VisitorSheet({
  code: selected,
  inCollection,
  locale,
  mobile,
  name,
  onClose,
  onCloseAutoFocus,
}: {
  code: string | null
  /** True when the code is in the public set. */
  inCollection: boolean
  locale: Locale
  mobile: boolean
  name: (code: string) => string
  onClose: () => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const ru = locale === 'ru'
  const code = selected && isCatalogCountry(selected) ? selected : null
  return (
    <Sheet
      open={!!code}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      side={mobile ? 'bottom' : 'right'}
      initialDetent={1}
      title={code ? name(code) : ''}
      description={inCollection ? undefined : ru ? 'Нет в этом паспорте' : 'Not in this passport'}
      closeLabel={ru ? 'Закрыть' : 'Close'}
      className="passport-sheet-panel"
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="passport-sheet">
        {code && inCollection ? (
          <div className="passport-sheet-stamp">
            <CountryStamp iso2={code} status="inked" size={SHEET_STAMP_SIZE} static />
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}
