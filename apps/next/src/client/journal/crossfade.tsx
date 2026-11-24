'use client'

import { useState, type ReactNode } from 'react'
import './states.css'

export function Crossfade({ signature, children }: { signature: string; children: ReactNode }) {
  const [seen, setSeen] = useState({ signature, changes: 0 })
  if (seen.signature !== signature) setSeen({ signature, changes: seen.changes + 1 })
  const fade = seen.changes === 0 ? undefined : seen.changes % 2 === 1 ? 'a' : 'b'
  return (
    <div className="journal-crossfade" data-fade={fade}>
      {children}
    </div>
  )
}
