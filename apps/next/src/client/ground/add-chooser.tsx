'use client'
// The page's Add control: a Menu offering Train or Road trip, each linking to its form. The existing Add flight menu
// (desktop header, Journal on phones) is untouched. The rows reuse the Add flight menu's look (`.add-button`, `.add-menu`).

import { NavigationLink as Link } from '../navigation-link'
import { Car, Plus, Train } from '@keyline-icons/react'
import type { Locale } from '../../lib/format'
import { ChevronIcon } from '../ui/icon-morph'
import { Menu, MenuItem } from '../ui/menu'
import { copy } from './copy'
import { withReturn, type GroundView } from './url'

export function AddChooser({ locale, view }: { locale: Locale; view: GroundView }) {
  const t = copy[locale]
  return (
    <Menu
      align="end"
      sideOffset={8}
      className="add-menu"
      scrim="mobile"
      trigger={
        <button type="button" className="add-button">
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          {t.add}
          <ChevronIcon size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      }
    >
      <MenuItem asChild>
        <Link href={withReturn('/ground-travel/new?mode=rail', view)} data-ground-add="rail">
          <Train size={20} strokeWidth={2} aria-hidden="true" />
          {t.addTrain}
        </Link>
      </MenuItem>
      <MenuItem asChild>
        <Link href={withReturn('/ground-travel/new?mode=road', view)} data-ground-add="road">
          <Car size={20} strokeWidth={2} aria-hidden="true" />
          {t.addRoad}
        </Link>
      </MenuItem>
    </Menu>
  )
}
