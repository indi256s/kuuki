/** The comparison the screen is showing, derived from what was asked for and what has settled. */
export type CompareFlow =
  | { kind: 'off' }
  | { kind: 'invalid'; code: string }
  | { kind: 'loading'; code: string }
  | { kind: 'failed'; code: string }
  | { kind: 'ready'; code: string }

/** Settled outcomes only; the requested code is never stored here, so a stale failure cannot outlive it. */
export type CompareSettled = { failedCode: string | null; attempt: number }

export type CompareSettledEvent =
  | { type: 'failed'; code: string }
  | { type: 'loaded' | 'retry' | 'reset' }

export const initialCompareSettled: CompareSettled = { failedCode: null, attempt: 0 }

export function compareSettledReducer(
  state: CompareSettled,
  event: CompareSettledEvent,
): CompareSettled {
  switch (event.type) {
    case 'failed':
      return { ...state, failedCode: event.code }
    case 'retry':
      return { failedCode: null, attempt: state.attempt + 1 }
    case 'loaded':
    case 'reset':
      return state.failedCode === null ? state : { ...state, failedCode: null }
  }
}

export function compareFlow({
  desired,
  available,
  readyFor,
  failedFor,
}: {
  desired: string | null
  available: boolean
  readyFor: string | null
  failedFor: string | null
}): CompareFlow {
  if (!desired) return { kind: 'off' }
  if (!available) return { kind: 'invalid', code: desired }
  if (readyFor === desired) return { kind: 'ready', code: desired }
  if (failedFor === desired) return { kind: 'failed', code: desired }
  return { kind: 'loading', code: desired }
}
