import type { ReactNode } from 'react'
import { MemberShell } from '../../client/shell'
import { getRequestLocale } from '../../server/locale'

export default async function MemberLayout({ children }: { children: ReactNode }) {
  return <MemberShell locale={await getRequestLocale()}>{children}</MemberShell>
}
