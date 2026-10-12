'use client'

import { Skeleton } from '../../ui/skeleton'
import { S, t } from '../copy'
import { useOverview } from '../store/overview-context'

export function SectionLoading() {
  const { locale } = useOverview()
  return <Skeleton height={220} label={t(S.loading, locale)} />
}
