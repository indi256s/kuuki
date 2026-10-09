import { HttpError } from '../../functions/api/_lib/http'
import { MAX_OUTPUT_BYTES } from '../../functions/api/_services/importRuntime'

type Frame = {
  kind: '{' | '['
  state: 'key' | 'colon' | 'value' | 'comma'
  start: number
  count: number
  key?: string
  flights: boolean
}
export interface ScannedFlight {
  ordinal: number
  value: unknown
}
const invalid = () => new HttpError(502, 'Invalid extraction envelope', 'PROVIDER_INVALID_RESPONSE')

/** Incremental JSON grammar, with bounded in-memory envelope reconciliation. Nothing is stored or logged. */
export class FlightScanner {
  private text = ''
  private bytes = 0
  private stack: Frame[] = []
  private stringStart = -1
  private escaped = false
  private primitiveStart = -1
  private complete = false
  private foundFlights = false;

  *push(chunk: string): Generator<ScannedFlight> {
    const encoded = new TextEncoder().encode(chunk)
    const remaining = MAX_OUTPUT_BYTES - this.bytes
    const limited = encoded.byteLength > remaining
    this.bytes += Math.min(encoded.byteLength, remaining)
    // Decode only the fitting prefix, omitting any incomplete UTF-8 character at the cap.
    if (limited) chunk = new TextDecoder().decode(encoded.subarray(0, remaining), { stream: true })
    const start = this.text.length
    this.text += chunk
    try {
      for (let i = start; i < this.text.length; i++) {
        const c = this.text[i]
        if (this.stringStart >= 0) {
          if (this.escaped) {
            this.escaped = false
            continue
          }
          if (c === '\\') {
            this.escaped = true
            continue
          }
          if (c !== '"') continue
          let token: string
          try {
            token = JSON.parse(this.text.slice(this.stringStart, i + 1)) as string
          } catch {
            throw invalid()
          }
          this.stringStart = -1
          const frame = this.stack.at(-1)!
          if (frame.kind === '{' && frame.state === 'key') {
            if (this.stack.length === 1 && token === 'flights') {
              if (this.foundFlights) throw invalid()
              this.foundFlights = true
            }
            frame.key = token
            frame.state = 'colon'
          } else this.endValue()
          continue
        }
        if (this.primitiveStart >= 0) {
          if (!/[\s,\]}]/.test(c)) continue
          try {
            JSON.parse(this.text.slice(this.primitiveStart, i))
          } catch {
            throw invalid()
          }
          this.primitiveStart = -1
          this.endValue()
          // The delimiter belongs to the enclosing array/object.
        }
        if (/\s/.test(c)) continue
        if (this.complete) throw invalid()
        const frame = this.stack.at(-1)
        if (c === '}' || c === ']') {
          if (!frame || frame.kind !== (c === '}' ? '{' : '[')) throw invalid()
          const empty = frame.count === 0 && frame.state === (frame.kind === '{' ? 'key' : 'value')
          if (!empty && frame.state !== 'comma') throw invalid()
          this.stack.pop()
          const parent = this.stack.at(-1)
          if (frame.kind === '{' && parent?.flights) {
            let value: unknown
            try {
              value = JSON.parse(this.text.slice(frame.start, i + 1))
            } catch {
              throw invalid()
            }
            const ordinal = parent.count
            this.endValue()
            yield { ordinal, value }
          } else this.endValue()
          continue
        }
        if (frame?.state === 'colon') {
          if (c !== ':') throw invalid()
          frame.state = 'value'
          continue
        }
        if (frame?.state === 'comma') {
          if (c !== ',') throw invalid()
          frame.state = frame.kind === '{' ? 'key' : 'value'
          continue
        }
        if (
          frame?.state === 'value' &&
          this.stack.length === 1 &&
          frame.key === 'flights' &&
          c !== '['
        )
          throw invalid()
        if (c === '"') {
          if (!frame) throw invalid()
          this.stringStart = i
          continue
        }
        if (frame?.state === 'key') throw invalid()
        if (c === '{' || c === '[') {
          if (!frame && (i !== this.text.search(/\S/) || c !== '{')) throw invalid()
          const flights = this.stack.length === 1 && frame?.key === 'flights'
          if (flights && c !== '[') throw invalid()
          if (this.stack.length >= 64) throw invalid()
          this.stack.push({
            kind: c,
            state: c === '{' ? 'key' : 'value',
            start: i,
            count: 0,
            flights,
          })
        } else {
          if (!frame || !/[\d\-tfn]/.test(c)) throw invalid()
          this.primitiveStart = i
        }
      }
    } catch (error) {
      // Keep the size refusal authoritative for an oversized malformed tail, as before.
      if (!limited) throw error
    }
    if (limited) throw new HttpError(502, 'Extraction output limit exceeded', 'OUTPUT_LIMIT')
  }

  private endValue() {
    const frame = this.stack.at(-1)
    if (!frame) {
      this.complete = true
      return
    }
    frame.state = 'comma'
    frame.count++
  }

  finish(): unknown[] {
    if (
      !this.complete ||
      !this.foundFlights ||
      this.stack.length ||
      this.stringStart >= 0 ||
      this.primitiveStart >= 0
    )
      throw invalid()
    try {
      const value = JSON.parse(this.text) as { flights?: unknown[] }
      if (!Array.isArray(value.flights)) throw invalid()
      return value.flights
    } catch {
      throw invalid()
    }
  }
}
