import { expect, it } from 'vitest'
import { periodLabel, periodName } from './period-label'

it('names every period shape the filter can hold', () => {
  expect(periodLabel(undefined, 'ru')).toBe('Всё время')
  expect(periodLabel({ years: [] }, 'en')).toBe('All time')
  expect(periodLabel({ years: [2024] }, 'ru')).toBe('2024')
  expect(periodLabel({ years: [2024, 2022, 2023] }, 'ru')).toBe('2022–2024')
  expect(periodLabel({ years: [2022, 2019] }, 'en')).toBe('2019, 2022')
  expect(periodLabel({ years: [2024, 2019, 2022] }, 'en')).toBe('2019, 2022 +1')
  expect(periodLabel({ from: '2024-03-12', to: '2024-11-05' }, 'ru')).toBe('12.03–05.11.24')
  expect(periodLabel({ from: '2023-03-12', to: '2024-01-05' }, 'en')).toBe('03/12/23–01/05/24')
  // Legacy month bounds expand to whole months.
  expect(periodLabel({ from: '2023-03', to: '2023-04' }, 'ru')).toBe('01.03–30.04.23')
  expect(periodName({ years: [2024] }, 'en')).toBe('Period: 2024')
})
