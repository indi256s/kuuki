import { createContext, useContext } from 'react'

/** Where a chapter is drawn: a sheet slide or a full desktop card. `active` is false for a slide that is not the open chapter. */
export type ChapterContext = { span: 'sheet' | 'full'; active: boolean }

export const FULL_CARD: ChapterContext = { span: 'full', active: true }
export const SHEET_ACTIVE: ChapterContext = { span: 'sheet', active: true }
export const SHEET_IDLE: ChapterContext = { span: 'sheet', active: false }

// Without a provider a chapter reads as a desktop card, the always-active case.
export const ChapterContext = createContext<ChapterContext>(FULL_CARD)
export const useChapter = () => useContext(ChapterContext)
