import { HttpError } from '../_lib/http'

/** Validate the entire base64 payload and its actual decoded byte count. */
export function decodedBase64Size(base64: string): number {
  // Keep this regex flat: repeating quartet groups can exhaust the stack on a
  // valid 10 MiB file. Padding is allowed only in the final quartet.
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new HttpError(400, 'Invalid file encoding', 'INVALID_BODY')
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const bytes = (base64.length / 4) * 3 - padding
  const finalValue = base64.charCodeAt(base64.length - padding - 1)
  const sextet =
    finalValue >= 97
      ? finalValue - 71
      : finalValue >= 65
        ? finalValue - 65
        : finalValue >= 48
          ? finalValue + 4
          : finalValue === 43
            ? 62
            : 63
  if ((padding === 2 && (sextet & 15) !== 0) || (padding === 1 && (sextet & 3) !== 0)) {
    throw new HttpError(400, 'Invalid file encoding', 'INVALID_BODY')
  }
  return bytes
}
