import type { MapOptions } from 'maplibre-gl'

const GESTURE_HELP = {
  en: {
    'CooperativeGesturesHandler.WindowsHelpText': 'Use Ctrl + scroll to zoom the map',
    'CooperativeGesturesHandler.MacHelpText': 'Use ⌘ + scroll to zoom the map',
    'CooperativeGesturesHandler.MobileHelpText': 'Use two fingers to move the map',
  },
  ru: {
    'CooperativeGesturesHandler.WindowsHelpText': 'Чтобы изменить масштаб, прокручивайте с Ctrl',
    'CooperativeGesturesHandler.MacHelpText': 'Чтобы изменить масштаб, прокручивайте с ⌘',
    'CooperativeGesturesHandler.MobileHelpText': 'Чтобы сдвинуть карту, используйте два пальца',
  },
} as const

export function mapOptions(locale: 'en' | 'ru'): Omit<MapOptions, 'container' | 'style'> {
  return {
    center: [0, 20],
    zoom: 0,
    renderWorldCopies: true,
    attributionControl: false,
    scrollZoom: true,
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    locale: GESTURE_HELP[locale],
  }
}
