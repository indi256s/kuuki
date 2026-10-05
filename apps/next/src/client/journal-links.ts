/** Dispatched on `window` when the member follows a link to /journal from outside the Journal; `detail` is the link's href. */
export const JOURNAL_LINK_EVENT = 'kuuki:journal-link'

/**
 * The next/link `onNavigate` for a shell link to `href`, or undefined when it does not lead to /journal. Link calls it only for a plain, local click
 * that nobody cancelled, just before navigating. A mounted Journal treats the announcement like Reset or Back: the destination supersedes the
 * Journal's own pending filter navigation, so its drafts and next change start from where the member is going.
 */
export function announceJournalLink(href: string): (() => void) | undefined {
  if (new URL(href, 'http://kuuki.invalid').pathname !== '/journal') return undefined
  return () => { window.dispatchEvent(new CustomEvent<string>(JOURNAL_LINK_EVENT, { detail: href })) }
}
