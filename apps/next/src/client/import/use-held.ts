'use client'

import { useState } from 'react'

export function useHeld(open: boolean) {
  const [held, setHeld] = useState(false)
  if (open && !held) setHeld(true)
  return [open || held, () => setHeld(false)] as const
}
