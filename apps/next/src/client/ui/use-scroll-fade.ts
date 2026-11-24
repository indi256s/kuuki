'use client'
import { useEffect, type RefObject } from 'react'

export function useScrollFade(ref: RefObject<HTMLElement | null>, content?: unknown) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      element.toggleAttribute('data-fade-start', element.scrollLeft > 1)
      element.toggleAttribute(
        'data-fade-end',
        element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      )
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      element.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ref, content])
}
