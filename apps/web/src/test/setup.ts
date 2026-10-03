import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Keep storage behavior realistic: receipts must survive a write/read round trip.
const stored = new Map<string, string>()
const localStorageMock = {
  get length() { return stored.size },
  key: vi.fn((index: number) => [...stored.keys()][index] ?? null),
  getItem: vi.fn((key: string) => stored.get(String(key)) ?? null),
  setItem: vi.fn((key: string, value: string) => { stored.set(String(key), String(value)) }),
  removeItem: vi.fn((key: string) => { stored.delete(String(key)) }),
  clear: vi.fn(() => { stored.clear() }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
beforeEach(() => stored.clear())
