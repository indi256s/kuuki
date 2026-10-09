'use client'

import { useEffect } from 'react'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import type { OverviewPrefs } from '@kuuki/shared/overview/prefs'
import type { Locale } from '../../../lib/format'
import { setTheme } from '../../../client/appearance'
import { OverviewPage } from '../../../client/overview/page/overview-page'

const saveLocally = async (prefs: OverviewPrefs) => prefs
export function DevOverview({
  payload,
  prefs,
  theme,
  locale,
}: {
  payload: OverviewPayload
  prefs: OverviewPrefs
  theme: 'light' | 'dark'
  locale: Locale
}) {
  useEffect(() => {
    setTheme(theme)
  }, [theme])
  return (
    <main id="main">
      <OverviewPage
        payload={payload}
        prefs={prefs}
        ownerKey="dev"
        name=""
        locale={locale}
        saver={saveLocally}
        live={false}
      />
    </main>
  )
}
