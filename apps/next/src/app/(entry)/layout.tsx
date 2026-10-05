import type { ReactNode } from 'react'
import { BrandShell } from '../../client/shell'
import { getRequestLocale } from '../../server/locale'

export default async function EntryLayout({ children }: { children: ReactNode }) {
  return <BrandShell locale={await getRequestLocale()}>{children}</BrandShell>
}
