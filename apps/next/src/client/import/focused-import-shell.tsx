'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** The incoming route controls shell presentation, including while a previous page exits. */
export function FocusedImportShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="member-route" data-import-focused={pathname === '/import' || undefined}>
      {children}
    </div>
  )
}
