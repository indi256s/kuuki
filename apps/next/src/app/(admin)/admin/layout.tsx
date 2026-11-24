import type { ReactNode } from 'react'
import { RouteStage } from '../../../client/route-transitions'
import { MemberShell } from '../../../client/shell'
import { getRequestLocale } from '../../../server/locale'
import { requireUserAnalyticsAdmin } from '../../../server/user-analytics'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireUserAnalyticsAdmin()
  const locale = await getRequestLocale()
  return (
    <MemberShell locale={locale}>
      <RouteStage stage="page">{children}</RouteStage>
    </MemberShell>
  )
}
