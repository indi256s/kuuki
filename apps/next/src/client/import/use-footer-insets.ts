'use client'

import { useEffect, type RefObject } from 'react'

const FOOTER = '--import-footer-height'
const KEYBOARD = '--import-keyboard-inset'

export function useFooterInsets(root: RefObject<HTMLElement | null>, shown: boolean) {
  useEffect(() => {
    const bar = root.current?.querySelector<HTMLElement>('.ui-action-bar')
    if (!shown || !bar) return
    const style = document.documentElement.style
    const viewport = window.visualViewport
    const update = () => {
      style.setProperty(FOOTER, `${bar.getBoundingClientRect().height}px`)
      const inset =
        viewport && viewport.scale === 1
          ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
          : 0
      style.setProperty(KEYBOARD, `${inset}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      observer.disconnect()
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      style.removeProperty(FOOTER)
      style.removeProperty(KEYBOARD)
    }
  }, [root, shown])
}
