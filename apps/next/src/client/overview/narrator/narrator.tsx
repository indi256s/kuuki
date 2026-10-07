'use client'

import { useOverview } from '../store/overview-context'
import { pickLine } from './pick'
import type { NarratorSlot } from './triggers'

export function Narrator({ slot }: { slot: NarratorSlot }) {
  const { scope, all, ownerKey, locale } = useOverview()
  if (!scope || !all) return null
  const line = pickLine(slot, scope, all, ownerKey, locale)
  return line === null ? null : <p className="narrator">{line}</p>
}
