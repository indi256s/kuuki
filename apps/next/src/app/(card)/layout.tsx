import type { ReactNode } from 'react'
import { RingBackdrop } from '../../client/auth-card/ring-backdrop'

export default function CardLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="auth-page">
      <RingBackdrop />
      {children}
    </main>
  )
}
