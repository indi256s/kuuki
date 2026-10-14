// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { clearCapturePreferences } from '../../capture/capture-preferences'
import {
  createDraftWriter,
  draftStorageKey,
  readDraft,
  removeDraft,
  writeDraft,
  type Draft,
} from './draft'
import { blankState, emptyLeg, newId } from './model'

const place = {
  source: 'geonames' as const,
  id: '611717',
  name: 'Tbilisi',
  nameRu: 'Тбилиси',
  nameEn: 'Tbilisi',
  countryCode: 'GE',
  region: 'Tbilisi',
  lat: 41.69,
  lon: 44.8,
  timezone: 'Asia/Tbilisi',
  catalogVersion: 'v1',
}

function draft(): Draft {
  const state = blankState('rail')
  state.legs = [{ ...emptyLeg(place), title: undefined } as never]
  state.title = 'Caucasus'
  return { v: 1, journeyId: newId(), baseVersion: null, state, pending: null }
}

beforeEach(() => localStorage.clear())

describe('ground drafts', () => {
  it('never show one owner another owner’s unfinished input', () => {
    expect(writeDraft('owner-a', 'new-rail', draft())).toBe(true)
    expect(readDraft('owner-a', 'new-rail', 'rail').status).toBe('ok')
    expect(readDraft('owner-b', 'new-rail', 'rail').status).toBe('none')
    expect(draftStorageKey('owner-a', 'new-rail')).toContain('owner-a')
  })

  it('are removed by the identity reset, only for the departing owner', () => {
    writeDraft('owner-a', 'new-rail', draft())
    writeDraft('owner-b', 'new-rail', draft())
    clearCapturePreferences('owner-a')
    expect(readDraft('owner-a', 'new-rail', 'rail').status).toBe('none')
    expect(readDraft('owner-b', 'new-rail', 'rail').status).toBe('ok')
  })

  it('discard a draft of another schema version or mode instead of half-restoring it', () => {
    const key = draftStorageKey('owner-a', 'new-rail')
    localStorage.setItem(key, JSON.stringify({ ...draft(), v: 2 }))
    expect(readDraft('owner-a', 'new-rail', 'rail').status).toBe('invalid')
    localStorage.setItem(key, 'not json')
    expect(readDraft('owner-a', 'new-rail', 'rail').status).toBe('invalid')
    writeDraft('owner-a', 'new-rail', draft())
    expect(readDraft('owner-a', 'new-rail', 'road').status).toBe('invalid')
  })

  it('drop a stored place that is no longer a valid snapshot', () => {
    const stored = draft()
    ;(stored.state.legs[0] as { from: unknown }).from = { ...place, countryCode: 'georgia' }
    writeDraft('owner-a', 'new-rail', stored)
    const read = readDraft('owner-a', 'new-rail', 'rail')
    expect(read.status === 'ok' && read.draft.state.legs[0].from).toBeNull()
  })

  it('debounce writes and report a storage failure', async () => {
    const results: boolean[] = []
    const writer = createDraftWriter('owner-a', 'new-rail', (stored) => results.push(stored), 5)
    writer.schedule(draft())
    writer.schedule(draft())
    expect(localStorage.getItem(draftStorageKey('owner-a', 'new-rail'))).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(results).toEqual([true])
    removeDraft('owner-a', 'new-rail')
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      writer.schedule(draft())
      writer.flush()
    } finally {
      Storage.prototype.setItem = original
    }
    expect(results).toEqual([true, false])
  })
})
