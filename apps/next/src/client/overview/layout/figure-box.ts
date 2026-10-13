import { createContext, useContext, useMemo } from 'react'
import { fitBox } from '../iso/scene'

/** The box a chapter card's figure is drawn to fit. */
export type FigureBox = { width: number; height: number }

/** The figure stage of the sheet and the standard desktop card. */
export const STAGE_BOX: FigureBox = { width: 300, height: 160 }
// The cap on k in the stage box; a bigger box raises it in proportion, so a figure that fits the stage by width keeps its look.
const STAGE_MAX_K = 1.8

/** The reading column of a wide card: the width every chart is tuned for (rhythm's AVAILABLE.full, the 592 skeleton). */
export const READING_COLUMN = 636
export const FIGURE_GAP = 40
/** The card content width from which the figure gets its own column. */
export const WIDE_MIN = 1000
/** From here to WIDE_MIN the figure keeps its place beside the hero, in a bigger stage. */
export const ROOMY_MIN = 840
const ROOMY_BOX: FigureBox = { width: 420, height: 224 }
// A few fixed boxes, not the measured width: a window drag redraws the figure only when it crosses a step, and each step's builds stay cached.
const WIDE_STEPS: readonly (FigureBox & { column: number })[] = [
  { column: 520, width: 520, height: 320 },
  { column: 440, width: 440, height: 268 },
  { column: 0, width: 320, height: 196 },
]

/** How a desktop card whose content is `width` wide draws its figure: in its own column (`wide`) or in the top row, and in which box. */
export function cardLayout(width: number): { wide: boolean; box: FigureBox } {
  if (width < ROOMY_MIN) return { wide: false, box: STAGE_BOX }
  if (width < WIDE_MIN) return { wide: false, box: ROOMY_BOX }
  const column = width - READING_COLUMN - FIGURE_GAP
  const step =
    WIDE_STEPS.find((item) => column >= item.column) ?? WIDE_STEPS[WIDE_STEPS.length - 1]!
  return { wide: true, box: { width: step.width, height: step.height } }
}

/** Set by ChapterCard for its figure; anything drawn outside a card gets the stage box. */
export const FigureBoxContext = createContext<FigureBox>(STAGE_BOX)
export const useFigureBox = () => useContext(FigureBoxContext)

/** The k that fits `build` in a box, capped like the stage (1.8 there) and scaled with the box. */
export function boxK(box: FigureBox, build: (k: number) => { width: number; height: number }) {
  const scale = Math.min(box.width / STAGE_BOX.width, box.height / STAGE_BOX.height)
  return Math.min(STAGE_MAX_K * scale, fitBox(box.width, box.height, build))
}

/** The k for a chapter figure in the card's current box. `key` names what `build`'s size depends on; k is refitted only when it or the box changes. */
export function useFigureK(key: string, build: (k: number) => { width: number; height: number }) {
  const box = useFigureBox()
  return useMemo(
    () => boxK(box, build),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `build` is a fresh closure every render; `key` carries what sizes it.
    [box.width, box.height, key],
  )
}
