import { createContext, useContext, useMemo } from 'react'
import { fitBox } from '../iso/scene'

export type FigureBox = { width: number; height: number }

export const STAGE_BOX: FigureBox = { width: 300, height: 160 }
const STAGE_MAX_K = 1.8

export const READING_COLUMN = 636
export const FIGURE_GAP = 40
export const WIDE_MIN = 1000
export const ROOMY_MIN = 840
const ROOMY_BOX: FigureBox = { width: 420, height: 224 }
const WIDE_STEPS: readonly (FigureBox & { column: number })[] = [
  { column: 520, width: 520, height: 320 },
  { column: 440, width: 440, height: 268 },
  { column: 0, width: 320, height: 196 },
]

export function cardLayout(width: number): { wide: boolean; box: FigureBox } {
  if (width < ROOMY_MIN) return { wide: false, box: STAGE_BOX }
  if (width < WIDE_MIN) return { wide: false, box: ROOMY_BOX }
  const column = width - READING_COLUMN - FIGURE_GAP
  const step =
    WIDE_STEPS.find((item) => column >= item.column) ?? WIDE_STEPS[WIDE_STEPS.length - 1]!
  return { wide: true, box: { width: step.width, height: step.height } }
}

export const FigureBoxContext = createContext<FigureBox>(STAGE_BOX)
export const useFigureBox = () => useContext(FigureBoxContext)

export function boxK(box: FigureBox, build: (k: number) => { width: number; height: number }) {
  const scale = Math.min(box.width / STAGE_BOX.width, box.height / STAGE_BOX.height)
  return Math.min(STAGE_MAX_K * scale, fitBox(box.width, box.height, build))
}

export function useFigureK(key: string, build: (k: number) => { width: number; height: number }) {
  const box = useFigureBox()
  return useMemo(
    () => boxK(box, build),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `build` is a fresh closure every render; `key` carries what sizes it.
    [box.width, box.height, key],
  )
}
