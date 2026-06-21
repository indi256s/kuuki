import { useTheme } from '@/hooks/useTheme'

/** Design-token map palette (CSS variables in index.css). */
export function useMapColors() {
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'

  return {
    isLight,
    background: 'var(--map-background)',
    backgroundEnd: 'var(--map-background-end)',
    gradientStart: 'var(--map-gradient-start)',
    gradientEnd: 'var(--map-gradient-end)',
    country: 'var(--map-country)',
    countryHover: 'var(--map-country-hover)',
    stroke: 'var(--map-stroke)',
    label: 'var(--map-label)',
    dot: 'var(--map-dot)',
    routeFallback: 'var(--map-route-fallback)',
    markerLabel: 'var(--map-marker-label)',
    panel: 'var(--map-panel)',
  } as const
}
