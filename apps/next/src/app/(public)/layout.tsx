import type { ReactNode } from 'react'
import { BadgeNotifications } from '../../client/profile/badge-notifications'
import { MemberShell, BrandShell } from '../../client/shell'
import { getOptionalPublicViewer } from '../../server/identity'
import { getRequestLocale } from '../../server/locale'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [locale, viewer] = await Promise.all([getRequestLocale(), getOptionalPublicViewer()])
  return viewer ? <MemberShell locale={locale}><BadgeNotifications key={viewer.id} ownerId={viewer.id} locale={locale} />{children}</MemberShell> : <BrandShell locale={locale} actions>{children}</BrandShell>
}
