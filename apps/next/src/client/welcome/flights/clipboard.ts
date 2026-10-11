// Clipboard and event helpers for the first-flight step. Pure of React so each rule is easy to read.

/** The longest text the import accepts (`MAX_TEXT_LENGTH` in functions/api/import/_extract.ts). */
export const MAX_TEXT_CHARS = 100_000

const V2_HEADER = 'KUUKI FLIGHTS v2'

/** True when the text, after an optional leading code-fence line, starts with the v2 header (O16). */
export function hasV2Header(text: string): boolean {
  let rest = text.trimStart()
  if (rest.startsWith('```')) {
    const newline = rest.indexOf('\n')
    rest = newline === -1 ? '' : rest.slice(newline + 1)
  }
  return rest.trimStart().startsWith(V2_HEADER)
}

/** An element the member types into: pastes there belong to that field, not to the step. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select')) return true
  return target instanceof HTMLElement && target.isContentEditable
}

/** The event carries files (a drag from the desktop), as opposed to selected text or a link. */
export function carriesFiles(data: DataTransfer | null | undefined): boolean {
  return Array.from(data?.types ?? []).includes('Files') || (data?.files?.length ?? 0) > 0
}

export type ClipboardRead =
  | { kind: 'file'; file: File }
  | { kind: 'text'; text: string }
  | { kind: 'empty' }
  | { kind: 'denied' }

const text = (value: string): ClipboardRead =>
  value.trim() ? { kind: 'text', text: value } : { kind: 'empty' }

/**
 * Reads the clipboard inside a click: an image item first, then text, then `readText()` for browsers without
 * `read()`. One attempt only: a denial is reported and never retried.
 */
export async function readClipboard(): Promise<ClipboardRead> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (!clipboard) return { kind: 'denied' }
  if (typeof clipboard.read === 'function') {
    try {
      const items = await clipboard.read()
      for (const item of items) {
        const type = item.types.find((candidate) => candidate.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        const extension = type === 'image/jpeg' ? 'jpg' : type.slice('image/'.length)
        return { kind: 'file', file: new File([blob], `clipboard.${extension}`, { type }) }
      }
      for (const item of items) {
        if (item.types.includes('text/plain'))
          return text(await (await item.getType('text/plain')).text())
      }
      return { kind: 'empty' }
    } catch (error) {
      // A refusal is final; anything else (an unsupported type, a missing API) falls back to `readText()`.
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        return { kind: 'denied' }
    }
  }
  try {
    return text(await clipboard.readText())
  } catch {
    return { kind: 'denied' }
  }
}
