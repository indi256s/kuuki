'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { Locale } from '../../lib/format'
import { useImportRuns } from './import-runs'

const ActiveDock = dynamic(() => import('./import-dock').then((mod) => mod.ImportDock), {
  ssr: false,
})

export function ImportDock({ locale }: { locale: Locale }) {
  const runs = useImportRuns()
  const visible = runs.some((entry) => !entry.viewed)
  const [activated, setActivated] = useState(false)
  if (visible && !activated) setActivated(true)
  return activated || visible ? <ActiveDock locale={locale} /> : null
}
