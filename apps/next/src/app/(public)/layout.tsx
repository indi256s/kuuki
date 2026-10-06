import type { ReactNode } from 'react'
import { BadgeNotifications } from '../../client/profile/badge-notifications'
import { RouteStage } from '../../client/route-transitions'
import { MemberShell, BrandShell } from '../../client/shell'
import { getOptionalPublicViewer } from '../../server/identity'
import { getRequestLocale } from '../../server/locale'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [locale, viewer] = await Promise.all([getRequestLocale(), getOptionalPublicViewer()])
  const page = <RouteStage stage="page">{children}</RouteStage>
  return viewer ? <MemberShell locale={locale}><BadgeNotifications key={viewer.id} ownerId={viewer.id} locale={locale} />{page}</MemberShell> : <BrandShell locale={locale} actions>{page}</BrandShell>
}
