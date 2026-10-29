'use client'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
/** Incoming routes own presentation, including while the previous page exits. */
export function FocusedMemberShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div
      className="member-route"
      data-import-focused={pathname === '/import' || undefined}
      data-airport-focused={pathname.startsWith('/airports/') || undefined}
    >
      {children}
    </div>
  )
}
