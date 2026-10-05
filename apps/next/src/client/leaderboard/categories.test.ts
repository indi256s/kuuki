import { expect, it } from 'vitest'
import { categoryName, categoryUnit } from './categories'
it.each([
  ['flights', 'en', 1, 'flight'], ['flights', 'en', 2, 'flights'], ['flights', 'ru', 1, 'перелёт'], ['flights', 'ru', 2, 'перелёта'], ['flights', 'ru', 5, 'перелётов'],
  ['distance', 'en', 1, 'km'], ['distance', 'ru', 1, 'км'], ['countries', 'en', 2, 'countries and territories'], ['countries', 'ru', 5, 'стран и территорий'],
  ['cities', 'en', 1, 'airport'], ['cities', 'ru', 2, 'аэропорта'], ['airlines', 'en', 1, 'airline'], ['airlines', 'ru', 5, 'авиакомпаний'],
] as const)('formats the real value unit (%s %s %i)', (category, locale, count, unit) => expect(categoryUnit(category, count, locale)).toBe(unit))
it('keeps the bookmarked cities category airport-labelled in both languages', () => {
  expect(categoryName('cities', 'en')).toBe('Airports')
  expect(categoryName('cities', 'ru')).toBe('Аэропорты')
})
