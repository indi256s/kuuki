'use client'

import { useEffect, useState } from 'react'

/** Keyboard-triggered surfaces settle instantly; a pointer starts a new motion session once closed. */
export function useKeyboardMotion(open: boolean, initialKeyboard?: boolean) {
  const [keyboard, setKeyboard] = useState(
    () =>
      initialKeyboard ??
      (typeof document === 'undefined'
        ? false
        : (document.activeElement?.matches(':focus-visible') ?? false)),
  )
  useEffect(() => {
    const key = () => setKeyboard(true)
    const pointer = () => {
      if (!open) setKeyboard(false)
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('pointerdown', pointer, true)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('pointerdown', pointer, true)
    }
  }, [open])
  return keyboard
}
