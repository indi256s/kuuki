import { describe, expect, it } from 'vitest'
import { ADDRESS_PATTERN, deriveAddress, normalizeName, withSuffix } from './address'

describe('deriveAddress', () => {
  it.each([
    ['Alex Mor', 'alex-mor'],
    ['Александра', 'aleksandra'],
    ['Щукин Юрий', 'shchukin-iurii'],
    ['José Núñez', 'jose-nunez'],
  ])('%s -> %s', (name, address) => {
    expect(deriveAddress(name)).toBe(address)
  })

  it.each(['李明', 'A', ''])('%j falls back to a pilot address', (name) => {
    expect(deriveAddress(name)).toMatch(/^pilot-[a-z0-9]{4}$/)
  })

  it('cuts a long name to a valid address', () => {
    const address = deriveAddress('Bartholomew '.repeat(5).trim())
    expect(address.length).toBeLessThanOrEqual(30)
    expect(address).toMatch(ADDRESS_PATTERN)
    expect(address.endsWith('-')).toBe(false)
  })
})

describe('withSuffix', () => {
  it('keeps the whole address within 30 characters', () => {
    const result = withSuffix('a'.repeat(30), 12)
    expect(result).toBe(`${'a'.repeat(27)}-12`)
    expect(result).toMatch(ADDRESS_PATTERN)
  })
})

it('normalizeName trims and collapses whitespace', () => {
  expect(normalizeName('  Alex   Mor ')).toBe('Alex Mor')
})
