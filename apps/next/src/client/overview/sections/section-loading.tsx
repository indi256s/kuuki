'use client'

import { ChapterCard } from '../layout/chapter-card'

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
