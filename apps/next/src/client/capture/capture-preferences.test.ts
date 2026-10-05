// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { clearCapturePreferences, readCapturePreference, writeCapturePreference } from './capture-preferences'

beforeEach(() => sessionStorage.clear())

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
