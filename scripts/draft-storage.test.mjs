import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearDrafts, listDrafts, loadDraft, saveDraft } from '../apps/next/src/client/capture/drafts.ts'

class Storage {
  values = new Map()
  get length() { return this.values.size }
  key(i) { return [...this.values.keys()][i] ?? null }
  getItem(k) { return this.values.get(k) ?? null }
  setItem(k, v) { this.values.set(k, v) }
  removeItem(k) { this.values.delete(k) }
}
const storage = new Storage()
globalThis.localStorage = storage
const id = '11111111-1111-4111-8111-111111111111'
const rowId = '22222222-2222-4222-8222-222222222222'
const draft = () => ({ schema: 1, id, ownerId: 'alice', createdAt: Date.now(), updatedAt: Date.now(), rows: [{
  id: rowId, selected: true, yearConfirmed: true, duplicate: false, edited: false, saved: false,
  flight: { date: '2025-02-01', origin: 'JFK', destination: 'LAX', airline_iata: 'AA', confidence: .9,
    raw_text: 'private document', field_confidence: { date: .8, raw_text: 'nested private document' } },
}] })

test('drafts keep only structured fields and isolate owners', () => {
  clearDrafts()
  assert.deepEqual(saveDraft(draft()), { ok: true })
  assert.equal(listDrafts('alice')[0].count, 1)
  assert.equal(listDrafts('bob').length, 0)
  assert.equal(loadDraft('bob', id), null)
  assert.equal(loadDraft('alice', id).rows[0].flight.raw_text, undefined)
  assert.equal(loadDraft('alice', id).rows[0].flight.field_confidence.raw_text, undefined)
  assert.doesNotMatch([...storage.values.values()].join(''), /private document/)
})

test('acknowledged rows remain unselected after reload', () => {
  clearDrafts()
  const saved = draft()
  saved.rows[0].saved = true
  assert.deepEqual(saveDraft(saved), { ok: true })
  const loaded = loadDraft('alice', id)
  assert.equal(loaded.rows[0].saved, true)
  assert.equal(loaded.rows[0].selected, false)
})

test('expired drafts are removed and unavailable storage is explicit', () => {
  const old = { ...draft(), createdAt: Date.now() - 31 * 86400_000 }
  storage.setItem(`kuuki-import-draft:v1:alice:${id}`, JSON.stringify(old))
  assert.equal(loadDraft('alice', id), null)
  storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
  assert.deepEqual(saveDraft(draft()), { ok: false, reason: 'quota' })
})
