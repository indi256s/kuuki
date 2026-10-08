import { expect, it } from 'vitest'
import { waffleLayout, percentCells } from './helpers'
it('keeps 69 unit cells readable and groups 640 units at narrow widths', () => {
  expect(waffleLayout(69, 230)).toMatchObject({ unit: 1, columns: 10, rows: 7 })
  expect(waffleLayout(640, 230)).toMatchObject({ unit: 5, cell: 6, columns: 33, rows: 4 })
  expect(waffleLayout(10000, 0)).toMatchObject({ columns: 1, cell: 6 })
  expect(waffleLayout(0, 230).rows).toBe(0)
})
it('allocates exactly 100 percent cells, with stable remainder ties and zero safeguards', () => {
  const result = percentCells([{ key: 'airbus', value: 1 }, { key: 'boeing', value: 1 }, { key: 'atr', value: 1 }])
  expect(result.map(row => row.cells)).toEqual([34, 33, 33])
  expect(result.reduce((sum, row) => sum + row.cells, 0)).toBe(100)
  expect(percentCells([{ key: 'unknown', value: 0 }])).toEqual([{ key: 'unknown', cells: 0 }])
  expect(percentCells([{ key: 'unknown', value: NaN }, { key: 'other', value: -1 }]).map(row => row.cells)).toEqual([0, 0])
})
