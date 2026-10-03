import { beforeEach, expect, it, vi } from 'vitest'
import {
  clearFlightCreateOperations,
  completeFlightCreateOperation,
  getFlightCreateOperation,
  pendingFlightCreateOperation,
  UnconfirmedFlightOperationError,
  ExpiredFlightOperationError,
  pendingImportFlightOperations,
} from './flightCreateOperations'

beforeEach(() => clearFlightCreateOperations())

it('reuses both key and original payload after an uncertain response', () => {
  const first = getFlightCreateOperation('alice', 'manual', { date: '2026-01-01', origin: 'TBS', destination: 'LHR' })
  const retry = getFlightCreateOperation('alice', 'manual', { date: '2026-01-01', origin: 'TBS', destination: 'LHR' })
  expect(retry).toEqual(first)
  expect(() => getFlightCreateOperation('alice', 'manual', { date: '2026-01-02', origin: 'TBS', destination: 'LHR' }))
    .toThrow(UnconfirmedFlightOperationError)
  expect(pendingFlightCreateOperation('alice', 'manual')).toMatchObject({ ...first, expired: false })
})

it('clears only the acknowledged operation and keeps users isolated', () => {
  const first = getFlightCreateOperation('alice', 'manual', { date: '2026-01-01' })
  const other = getFlightCreateOperation('bob', 'manual', { date: '2026-01-01' })
  completeFlightCreateOperation('alice', 'manual', first.key)
  expect(pendingFlightCreateOperation('alice', 'manual')).toBeNull()
  expect(pendingFlightCreateOperation('bob', 'manual')).toMatchObject({ ...other, expired: false })
})

it('recovers only the current user import receipts', () => {
  getFlightCreateOperation('alice', '11111111-1111-4111-8111-111111111111:0', { date: '2026-01-01' })
  getFlightCreateOperation('bob', '22222222-2222-4222-8222-222222222222:0', { date: '2026-01-01' })
  expect(pendingImportFlightOperations('alice')).toMatchObject([
    { operationId: '11111111-1111-4111-8111-111111111111:0', body: { date: '2026-01-01' }, expired: false },
  ])
})

it('refuses to replay a receipt older than the safe retention window', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    getFlightCreateOperation('alice', 'manual', { date: '2026-01-01' })
    vi.setSystemTime(new Date('2026-01-08T00:00:00Z'))
    expect(() => getFlightCreateOperation('alice', 'manual', { date: '2026-01-01' })).toThrow(ExpiredFlightOperationError)
    expect(pendingFlightCreateOperation('alice', 'manual')?.expired).toBe(true)
  } finally {
    vi.useRealTimers()
  }
})

it('does not permit a create when its durable receipt cannot be written', () => {
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  try {
    expect(() => getFlightCreateOperation('alice', 'manual', { date: '2026-01-01' }))
      .toThrow('Could not store a safe flight retry receipt')
    expect(pendingFlightCreateOperation('alice', 'manual')).toBeNull()
  } finally {
    write.mockRestore()
  }
})

it('does not mint a new key over a damaged receipt', () => {
  localStorage.setItem('kuuki-flight-create-operation:alice:manual', '{bad json')
  expect(() => getFlightCreateOperation('alice', 'manual', { date: '2026-01-01' }))
    .toThrow('Stored flight retry receipt is damaged')
  expect(pendingFlightCreateOperation('alice', 'manual')?.expired).toBe(true)
})
