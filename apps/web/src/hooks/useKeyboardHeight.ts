import { useState, useEffect } from 'react'

/**
 * Hook to detect keyboard height using the Visual Viewport API.
 *
 * On mobile devices, when the virtual keyboard appears, the visual viewport
 * shrinks. This hook calculates the keyboard height by comparing window height
 * to visual viewport height.
 *
 * This is essential for bottom sheets that need to resize when the keyboard
 * opens, keeping form inputs visible above the keyboard.
 *
 * @returns The keyboard height in pixels (0 when keyboard is not visible)
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    // Check if we're in a browser environment with visualViewport support
    if (typeof window === 'undefined' || !window.visualViewport) {
      return
    }

    const viewport = window.visualViewport

    const calculateKeyboardHeight = () => {
      // Keyboard height = window height - visual viewport height
      // The visual viewport shrinks when the keyboard appears
      const height = window.innerHeight - viewport.height

      // Only update if there's a meaningful difference (> 100px)
      // This filters out minor viewport changes from address bar hiding
      setKeyboardHeight(height > 100 ? height : 0)
    }

    // Calculate initial state
    calculateKeyboardHeight()

    // Listen for viewport changes
    viewport.addEventListener('resize', calculateKeyboardHeight)
    viewport.addEventListener('scroll', calculateKeyboardHeight)

    return () => {
      viewport.removeEventListener('resize', calculateKeyboardHeight)
      viewport.removeEventListener('scroll', calculateKeyboardHeight)
    }
  }, [])

  return keyboardHeight
}
