// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  clearCapturePreferences,
  readCapturePreference,
  writeCapturePreference,
} from './capture-preferences'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

it('clears only the departing owner when an owner is given', () => {
  writeCapturePreference('owner-a', 'recent', ['TBS'])
  writeCapturePreference('owner-ab', 'recent', ['IST'])
  sessionStorage.setItem('unrelated', '1')
  clearCapturePreferences('owner-a')
  expect(readCapturePreference('owner-a', 'recent', null)).toBeNull()
  // A prefix-sharing owner id is a different owner.
  expect(readCapturePreference('owner-ab', 'recent', null)).toEqual(['IST'])
  expect(sessionStorage.getItem('unrelated')).toBe('1')
})

it('clears every owner without an owner', () => {
  writeCapturePreference('owner-a', 'recent', ['TBS'])
  writeCapturePreference('owner-b', 'recent', ['IST'])
  clearCapturePreferences()
  expect(readCapturePreference('owner-a', 'recent', null)).toBeNull()
  expect(readCapturePreference('owner-b', 'recent', null)).toBeNull()
})

it('keeps recents and disclosure across new tab sessions without leaking to another owner', () => {
  writeCapturePreference('owner-a', 'airports', ['TBS', 'IST'])
  writeCapturePreference('owner-a', 'details', true)
  sessionStorage.clear() // a fresh tab has no departing tab's session state
  expect(readCapturePreference('owner-a', 'airports', [])).toEqual(['TBS', 'IST'])
  expect(readCapturePreference('owner-a', 'details', false)).toBe(true)
  expect(readCapturePreference('owner-b', 'airports', [])).toEqual([])
  clearCapturePreferences('owner-a') // existing identity-reset caller
  expect(readCapturePreference('owner-a', 'airports', [])).toEqual([])
  expect(readCapturePreference('owner-a', 'details', false)).toBe(false)
})

it('clears capture data from both stores while preserving unrelated persistent data', () => {
  localStorage.setItem('kuuki:capture:owner-a:airports', '["TBS"]')
  sessionStorage.setItem('kuuki:capture:owner-a:airports', '["IST"]')
  localStorage.setItem('kuuki:capture:owner-ab:airports', '["NRT"]')
  localStorage.setItem('unrelated', '1')
  clearCapturePreferences('owner-a')
  expect(localStorage.getItem('kuuki:capture:owner-a:airports')).toBeNull()
  expect(sessionStorage.getItem('kuuki:capture:owner-a:airports')).toBeNull()
  expect(localStorage.getItem('kuuki:capture:owner-ab:airports')).toBe('["NRT"]')
  expect(localStorage.getItem('unrelated')).toBe('1')
  clearCapturePreferences()
  expect(localStorage.getItem('kuuki:capture:owner-ab:airports')).toBeNull()
})

it('tolerates unavailable persistent storage and malformed values', () => {
  localStorage.setItem('kuuki:capture:owner-a:airports', '{broken')
  expect(readCapturePreference('owner-a', 'airports', [])).toEqual([])
  vi.stubGlobal('localStorage', {
    getItem() {
      throw Error('blocked')
    },
    setItem() {
      throw Error('blocked')
    },
    get length() {
      throw Error('blocked')
    },
  })
  expect(() => writeCapturePreference('owner-a', 'airports', ['TBS'])).not.toThrow()
  expect(readCapturePreference('owner-a', 'airports', [])).toEqual([])
  sessionStorage.setItem('kuuki:capture:owner-a:airports', '["IST"]')
  expect(() => clearCapturePreferences('owner-a')).not.toThrow()
  expect(sessionStorage.getItem('kuuki:capture:owner-a:airports')).toBeNull()
})
