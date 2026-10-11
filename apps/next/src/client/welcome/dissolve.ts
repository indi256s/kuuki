/** Reads a duration token (`--dur-moment`) from the root, in milliseconds. */
function tokenMs(name: string, fallback: number) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const ms = value.endsWith('ms')
    ? parseFloat(value)
    : value.endsWith('s')
      ? parseFloat(value) * 1000
      : NaN
  return Number.isFinite(ms) ? ms : fallback
}

/**
 * The card's exit into the Overview: opacity, scale and blur over `--dur-moment` with `--ease-out`.
 * Reduced motion keeps only the crossfade. Resolves half way through, so the caller starts the navigation while the
 * fade finishes: the old document keeps painting it until the Overview's first paint, instead of a blank wait after
 * an empty card. Resolves at once without WAAPI.
 */
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
  // A cancelled animation still leaves.
  await Promise.race([animation.finished.then(noop, noop), halfway])
}

const noop = () => undefined
