import { createContext, useContext } from 'react'

export type ChapterContext = { span: 'sheet' | 'full'; active: boolean }

export const FULL_CARD: ChapterContext = { span: 'full', active: true }
export const SHEET_ACTIVE: ChapterContext = { span: 'sheet', active: true }
export const SHEET_IDLE: ChapterContext = { span: 'sheet', active: false }

export const ChapterContext = createContext<ChapterContext>(FULL_CARD)
export const useChapter = () => useContext(ChapterContext)
