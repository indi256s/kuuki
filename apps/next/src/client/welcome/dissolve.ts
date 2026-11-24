function tokenMs(name: string, fallback: number) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const ms = value.endsWith('ms')
    ? parseFloat(value)
    : value.endsWith('s')
      ? parseFloat(value) * 1000
      : NaN
  return Number.isFinite(ms) ? ms : fallback
}

export async function dissolve(card: HTMLElement | null): Promise<void> {
  if (!card || typeof card.animate !== 'function') return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()
  const duration = reduced ? tokenMs('--dur-fast', 150) : tokenMs('--dur-moment', 450)
  const animation = card.animate(
    reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' },
          { opacity: 0, transform: 'scale(1.04)', filter: 'blur(6px)' },
        ],
    {
      duration,
      easing: easing || 'ease-out',
      fill: 'forwards',
    },
  )
  const halfway = new Promise<void>((resolve) => setTimeout(resolve, duration / 2))
  await Promise.race([animation.finished.then(noop, noop), halfway])
}

const noop = () => undefined
