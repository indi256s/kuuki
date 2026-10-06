const STORAGE_PREFIX = 'kuuki-flight-create-operation:'

interface PendingOperation {
  key: string
  payload: string
  createdAt: number
}

const SAFE_RETRY_MS = 6 * 24 * 60 * 60 * 1000

export class ExpiredFlightOperationError extends Error {
  constructor() {
    super('This save is too old to retry safely. Check your flights before starting a new save.')
    this.name = 'ExpiredFlightOperationError'
  }
}

export class UnconfirmedFlightOperationError extends Error {
  constructor() {
    super('A previous flight save is unconfirmed. Retry that save or start a new one.')
    this.name = 'UnconfirmedFlightOperationError'
  }
}

export class SettledFlightOperationError extends Error {
  constructor() {
    super('The original save was settled or replaced elsewhere. Check your journal before starting a new save.')
    this.name = 'SettledFlightOperationError'
  }
}

const fallback = new Map<string, PendingOperation>()

function read(id: string): PendingOperation | undefined {
  if (typeof localStorage === 'undefined') return fallback.get(id)
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + id)
    if (!stored) return fallback.get(id)
    const receipt = JSON.parse(stored) as PendingOperation
    if (typeof receipt.key !== 'string' || typeof receipt.payload !== 'string') throw new Error('Invalid receipt')
    return receipt
  } catch {
    if (fallback.has(id)) return fallback.get(id)
    throw new Error('Stored flight retry receipt is damaged. Start a new save only after checking your flights.')
  }
}

function write(id: string, operation: PendingOperation): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(operation))
    if (localStorage.getItem(STORAGE_PREFIX + id) !== JSON.stringify(operation)) throw new Error('Receipt verification failed')
  } catch {
    throw new Error('Could not store a safe flight retry receipt. Check browser storage and try again.')
  }
  fallback.set(id, operation)
}

function expired(operation: PendingOperation): boolean {
  return !Number.isFinite(operation.createdAt) || operation.createdAt > Date.now() || Date.now() - operation.createdAt >= SAFE_RETRY_MS
}

function scope(userId: string, operationId: string): string {
  return `${userId}:${operationId}`
}

/** Keep the exact payload and key together. An explicit retry must supply its captured key, never mint a new one. */
export function getFlightCreateOperation(userId: string, operationId: string, payload: object, retryKey?: string): { key: string; body: object } {
  const serialized = JSON.stringify(payload)
  const id = scope(userId, operationId)
  const existing = read(id)
  if (retryKey !== undefined && (!existing || existing.key !== retryKey)) throw new SettledFlightOperationError()
  if (existing && expired(existing)) throw new ExpiredFlightOperationError()
  if (existing?.payload === serialized) return { key: existing.key, body: JSON.parse(existing.payload) as object }
  if (existing) throw new UnconfirmedFlightOperationError()
  const created = { key: crypto.randomUUID(), payload: serialized, createdAt: Date.now() }
  write(id, created)
  return { key: created.key, body: payload }
}

export function pendingFlightCreateOperation(userId: string, operationId: string): { key: string; body: object; expired: boolean } | null {
  try {
    const pending = read(scope(userId, operationId))
    if (!pending) return null
    const body: unknown = JSON.parse(pending.payload)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid receipt payload')
    return { key: pending.key, body, expired: expired(pending) }
  } catch {
    return { key: '', body: {}, expired: true }
  }
}

/** Recover only this user's import receipts after reload or navigation. */
export function pendingImportFlightOperations(userId: string): Array<{ operationId: string; key: string; body: object; expired: boolean }> {
  // Import operation IDs are a run UUID followed by a row number.
  return pendingFlightCreateOperations(userId)
    .filter(receipt => /^[0-9a-f-]{36}:\d+$/.test(receipt.operationId))
    .sort((a, b) => a.operationId.localeCompare(b.operationId))
}

/**
 * Every stored create receipt of this user, whatever wrote it and whatever its operation id looks like (a plain UUID,
 * a run and row number, or any prefixed id), so an unresolved save can be found again after a reload. A damaged receipt
 * is listed as expired with an empty body and no key.
 */
export function pendingFlightCreateOperations(userId: string): Array<{ operationId: string; key: string; body: object; expired: boolean }> {
  const owner = `${userId}:`
  const ids = new Set<string>()
  for (const id of fallback.keys()) if (id.startsWith(owner)) ids.add(id.slice(owner.length))
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX + owner)) ids.add(key.slice(STORAGE_PREFIX.length + owner.length))
    }
  } catch { /* Storage may be unavailable. */ }
  const receipts: Array<{ operationId: string; key: string; body: object; expired: boolean }> = []
  for (const operationId of [...ids].sort()) {
    const pending = pendingFlightCreateOperation(userId, operationId)
    if (pending) receipts.push({ operationId, ...pending })
  }
  return receipts
}

export function abandonFlightCreateOperation(userId: string, operationId: string): void {
  const id = scope(userId, operationId)
  fallback.delete(id)
  try { localStorage.removeItem(STORAGE_PREFIX + id) } catch { /* Explicit new operation; storage may be unavailable. */ }
}

export function completeFlightCreateOperation(userId: string, operationId: string, key: string): void {
  const id = scope(userId, operationId)
  if (read(id)?.key !== key) return
  fallback.delete(id)
  try { localStorage.removeItem(STORAGE_PREFIX + id) } catch { /* Storage may be unavailable. */ }
}

export function clearFlightCreateOperations(userId?: string): void {
  const scopePrefix = userId === undefined ? '' : `${userId}:`
  for (const id of fallback.keys()) if (id.startsWith(scopePrefix)) fallback.delete(id)
  try {
    const prefix = STORAGE_PREFIX + scopePrefix
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) localStorage.removeItem(key)
    }
  } catch { /* Storage may be unavailable. */ }
}

/** Session storage survives refresh while keeping independent tabs' manual attempts separate. */
export function currentFlightOperationId(kind: string): string {
  const key = `kuuki-flight-operation-${kind}`
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function rotateFlightOperationId(kind: string): string {
  const id = crypto.randomUUID()
  try { sessionStorage.setItem(`kuuki-flight-operation-${kind}`, id) } catch { /* Current request still has its key. */ }
  return id
}
