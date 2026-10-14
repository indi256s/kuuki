export type DeleteReceipt = { key: number; ids: number[]; remaining: number | null }

const storageKey = (ownerId: string) => `kuuki-journal-delete:${ownerId}`

/** Receipts stay in this tab and contain only IDs, never flight or account details. */
export function readDeleteReceipts(ownerId: string): DeleteReceipt[] {
  const value: unknown = JSON.parse(sessionStorage.getItem(storageKey(ownerId)) ?? '[]')
  if (!Array.isArray(value)) throw new Error('Invalid delete receipt')
  return value.filter(
    (item): item is DeleteReceipt =>
      item &&
      Number.isSafeInteger(item.key) &&
      item.key > 0 &&
      Array.isArray(item.ids) &&
      item.ids.length > 0 &&
      item.ids.every((id: unknown) => Number.isSafeInteger(id) && Number(id) > 0) &&
      (item.remaining === null ||
        (Number.isFinite(item.remaining) && item.remaining >= 0 && item.remaining <= 6000)),
  )
}

export function writeDeleteReceipts(ownerId: string, receipts: DeleteReceipt[]): boolean {
  try {
    if (receipts.length) sessionStorage.setItem(storageKey(ownerId), JSON.stringify(receipts))
    else sessionStorage.removeItem(storageKey(ownerId))
    return true
  } catch {
    return false
  }
}

/** Identity changes clear deferred intentions even while the Journal is unmounted. */
export function clearDeleteReceipts(ownerId: string): void {
  writeDeleteReceipts(ownerId, [])
}
