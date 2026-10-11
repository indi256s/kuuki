import type { ReactNode } from 'react'
import { RingBackdrop } from '../../client/auth-card/ring-backdrop'

/** The auth card owns the whole page: no guest header, its own wordmark and corner controls, over the ring backdrop. */
export default function CardLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="auth-page">
      <RingBackdrop />
      {children}
    </main>
  )
}
