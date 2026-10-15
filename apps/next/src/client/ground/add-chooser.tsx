'use client'
// The empty list's way in: Train or Road trip, each a link to its form carrying the list view as return context.
// Everywhere else, adding lives in the shared Add list (desktop header menu, the rail's + card).

import { NavigationLink as Link } from '../navigation-link'
import { Car, Train } from '@keyline-icons/react'
import type { Locale } from '../../lib/format'
import { copy } from './copy'
import { withReturn, type GroundView } from './url'

export function AddChooser({ locale, view }: { locale: Locale; view: GroundView }) {
  const t = copy[locale]
  return (
    <div className="gt-empty-actions">
      <Link
        className="ui-button"
        data-variant="primary"
        href={withReturn('/ground-travel/new?mode=rail', view)}
        data-ground-add="rail"
      >
        <span>
          <Train size={18} strokeWidth={2} aria-hidden="true" />
          {t.addTrain}
        </span>
      </Link>
      <Link
        className="ui-button"
        href={withReturn('/ground-travel/new?mode=road', view)}
        data-ground-add="road"
      >
        <span>
          <Car size={18} strokeWidth={2} aria-hidden="true" />
          {t.addRoad}
        </span>
      </Link>
    </div>
  )
}
