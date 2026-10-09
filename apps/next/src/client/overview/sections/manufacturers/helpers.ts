import type { MakerKey } from '@kuuki/data/aircraft-makers'

// Cells stop growing at this size so a wide card keeps a compact waffle (pitch 32 with the widest gap).
export const WAFFLE_MAX_CELL = 28
export function waffleLayout(units: number, width: number) {
  const total = Number.isFinite(units) ? Math.max(0, units) : 0
  const available = Number.isFinite(width) ? Math.max(7, width) : 7
  let unit = 1
  let columns = Math.max(10, Math.ceil(total / 10))
  let gap = Math.max(1, Math.min(4, Math.round(available / columns * 0.2)))
  let cell = (available - (columns - 1) * gap) / columns
  if (cell > WAFFLE_MAX_CELL) cell = WAFFLE_MAX_CELL
  if (cell < 6) {
    cell = 6; gap = 1; columns = Math.max(1, Math.floor((available + 1) / 7))
    unit = 5
    while (Math.ceil(total / unit / columns) > 10) unit *= 5
  }
  return { unit, cell, gap, columns, rows: Math.ceil(total / unit / columns) }
}
export function percentCells(rows: { key: MakerKey; value: number }[]) {
  const values = rows.map(row => Number.isFinite(row.value) ? Math.max(0, row.value) : 0)
  const sum = values.reduce((a, b) => a + b, 0)
  if (!sum) return rows.map(row => ({ key: row.key, cells: 0 }))
  const exact = values.map(value => value / sum * 100)
  const cells = exact.map(Math.floor)
  const order = exact.map((value, i) => ({ i, remainder: value - cells[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
  const remaining = 100 - cells.reduce((a, b) => a + b, 0)
  for (let i = 0; i < remaining; i++) cells[order[i].i]++
  return rows.map((row, i) => ({ key: row.key, cells: cells[i] }))
}
