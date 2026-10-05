import type { ReactNode } from 'react'
import { MemberShell } from '../../client/shell'
import { requireOnboardedMember } from '../../server/gates'
import { getRequestLocale } from '../../server/locale'

// Awaited before any shell byte so hard loads get a real redirect; pages still gate on soft navigation.
export default async function MemberLayout({ children }: { children: ReactNode }) {
  await requireOnboardedMember()
  return <MemberShell locale={await getRequestLocale()}>{children}</MemberShell>
}
