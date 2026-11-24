import type { MetadataRoute } from 'next'
import { THEME_COLOR } from '../lib/theme-colors'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Kuuki',
    short_name: 'Kuuki',
    description: 'Keep your journeys close.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      {
        src: '/screenshots/overview-wide.png',
        sizes: '1280x800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Flight statistics and travel map',
      },
      {
        src: '/screenshots/passport-wide.png',
        sizes: '1280x800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Visited countries and passport stamps',
      },
      {
        src: '/screenshots/overview-narrow.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Flight statistics',
      },
      {
        src: '/screenshots/passport-narrow.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Visited countries and passport stamps',
      },
    ],
  }
}
