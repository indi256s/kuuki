export const MAX_TEXT_CHARS = 100_000

const V2_HEADER = 'KUUKI FLIGHTS v2'

export function hasV2Header(text: string): boolean {
  let rest = text.trimStart()
  if (rest.startsWith('```')) {
    const newline = rest.indexOf('\n')
    rest = newline === -1 ? '' : rest.slice(newline + 1)
  }
  return rest.trimStart().startsWith(V2_HEADER)
}

export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select')) return true
  return target instanceof HTMLElement && target.isContentEditable
}

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
