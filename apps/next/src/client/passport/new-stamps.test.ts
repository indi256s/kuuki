import { expect, it } from 'vitest'
import { unseenCountries } from './new-stamps'

const storage = () => {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

it('records the first visit as a baseline, then returns each later arrival once', () => {
  const store = storage()
  expect(unseenCountries('baseline-owner', ['NO', 'GE'], store)).toEqual([])
  expect(unseenCountries('baseline-owner', ['NO', 'GE', 'IS'], store)).toEqual(['IS'])
  expect(unseenCountries('baseline-owner', ['NO', 'GE', 'IS'], store)).toEqual([])
  // A hidden country keeps its place in the seen set, so restoring it does not press it again.
  expect(unseenCountries('baseline-owner', ['NO', 'GE'], store)).toEqual([])
  expect(unseenCountries('baseline-owner', ['NO', 'GE', 'IS'], store)).toEqual([])
})

it('keeps owners apart and survives blocked storage with a tab-local baseline', () => {
  const blocked = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    },
  }
  expect(unseenCountries('blocked-owner', ['NO'], blocked)).toEqual([])
  expect(unseenCountries('blocked-owner', ['NO', 'PT'], blocked)).toEqual(['PT'])
  expect(unseenCountries('other-owner', ['NO', 'PT'], storage())).toEqual([])
})
