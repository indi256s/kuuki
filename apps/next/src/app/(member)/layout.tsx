import type { ReactNode } from 'react'
import { BadgeNotifications } from '../../client/profile/badge-notifications'
import { MemberShell } from '../../client/shell'
import { requireOnboardedMember } from '../../server/gates'
import { getRequestLocale } from '../../server/locale'

// Awaited before any shell byte so hard loads get a real redirect; pages still gate on soft navigation.
export default async function MemberLayout({ children }: { children: ReactNode }) {
  const own = await requireOnboardedMember()
  const locale = await getRequestLocale()
  return <MemberShell locale={locale}><BadgeNotifications key={own.ownerId} ownerId={own.ownerId} locale={locale} />{children}</MemberShell>
}
