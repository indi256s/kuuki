import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The stamp grid's column rule, read from the stylesheet itself (no browser layout): the columns follow the
// width the grid actually has, so a stamp cell never pushes the page past its gutter.
const css = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const passport = css('./passport.css')
const signature = css('../signature/signature.css')
const reads = css('../../app/reads.css')

const repeat = (block: string) => Number(/grid-template-columns:repeat\((\d+),minmax\(0,1fr\)\)/.exec(block)?.[1])
const base = repeat(/\.passport-grid\{([^}]*)\}/.exec(passport)![1])
const steps = [...passport.matchAll(/@container \(min-width: (\d+)px\)\{\.passport-grid\{([^}]*)\}/g)]
  .map(([, width, block]) => ({ width: Number(width), columns: repeat(block) }))
const columnGap = (width: number) => width >= 720 ? 16 : 12
const columnsAt = (width: number) => steps.filter(step => width >= step.width).at(-1)?.columns ?? base
const cellAt = (width: number) => (width - (columnsAt(width) - 1) * columnGap(width)) / columnsAt(width)

// Content width = viewport minus two page gutters (24px; 16px at 700px and below).
const content = (viewport: number) => viewport - 2 * (viewport <= 700 ? 16 : 24)

describe('passport stamp grid', () => {
  it('uses 6 columns on desktop, 3 at a 390px phone and 2 at 320px', () => {
    expect(columnsAt(Math.min(content(1440), 1200))).toBe(6)
    expect(columnsAt(content(390))).toBe(3)
    expect(columnsAt(content(320))).toBe(2)
  })

  it('keeps every phone cell at least 104px wide, including right at the three-column threshold', () => {
    expect(steps.map(step => step.width)).toEqual([336, 720])
    for (const width of [content(320), steps[0].width, content(375), content(390), content(430), 719]) {
      expect(cellAt(width), `${width}px`).toBeGreaterThanOrEqual(104)
    }
  })

  it('lets the shared stamp shrink to its cell instead of forcing a minimum width', () => {
    const stamp = /\.stamp\{[^}]*\}/.exec(signature)![0]
    expect(stamp).toContain('min-width:0')
    expect(stamp).not.toMatch(/min-width:[1-9]/)
  })

  it('leaves no legacy stamp face rules (rotation, borders, fixed minimum) in the read styles', () => {
    expect(reads).not.toMatch(/(^|\})\.stamp(-face)?\{/)
    expect(reads).not.toContain('.stamp.claim')
  })
})
