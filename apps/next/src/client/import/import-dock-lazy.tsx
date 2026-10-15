'use client'

import dynamic from 'next/dynamic'

/**
 * The dock renders into the toast slot, which exists only after hydration, so it has nothing to server-render. Loading
 * it after the page keeps its review rules, airport tables and sheet motion out of every route's first load.
 */
export const ImportDock = dynamic(() => import('./import-dock').then((mod) => mod.ImportDock), {
  ssr: false,
})
