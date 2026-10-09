import type { ReactNode } from 'react'

/** The auth card owns the whole page: no guest header, its own wordmark and corner controls. */
export default function CardLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="auth-page">
      {children}
    </main>
  )
}
