'use client'

import { ChapterCard } from '../layout/chapter-card'

/** While a chapter's code loads: the card's own loading bands, so nothing moves when the chapter arrives. */
export function SectionLoading() {
  return (
    <ChapterCard
      state="loading"
      figure={null}
      hero={{ value: '', caption: null }}
      chart={{ caption: '', plot: null }}
    />
  )
}
