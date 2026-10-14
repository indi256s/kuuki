'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function PageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <main id="main" className="page-shell" data-wide={pathname === '/overview' || undefined}>
      {children}
    </main>
  )
}
