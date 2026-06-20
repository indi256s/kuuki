// Canonical timestamp helpers for D1.
//
// SQLite has no date type — every timestamp is stored as a TEXT string. To keep
// string comparisons (expiry checks, ORDER BY claimed_at, sliding sessions) correct,
// EVERY timestamp written to D1 — new rows AND imported Supabase rows — must use the
// single canonical format produced by Date.prototype.toISOString():
//
//     YYYY-MM-DDTHH:MM:SS.sssZ   (UTC, millisecond precision, 'T' separator, 'Z' suffix)
//
// Mixing this with Postgres' default rendering ("2026-06-20 10:00:00+00") silently
// breaks lexicographic ordering and `expires_at > ?` comparisons.

/** Current time as a canonical UTC ISO-8601 string. */
export function nowIso(): string {
  return new Date().toISOString()
}

/** A canonical ISO string `seconds` into the future from `from` (defaults to now). */
export function isoPlusSeconds(seconds: number, from: string = nowIso()): string {
  return new Date(new Date(from).getTime() + seconds * 1000).toISOString()
}

/** Milliseconds elapsed since a canonical ISO string. Negative if the string is in the future. */
export function msSince(iso: string): number {
  return Date.now() - new Date(iso).getTime()
}

/**
 * Normalize any timestamp string (e.g. a Postgres `timestamptz`) to the canonical
 * ISO format. Returns null for empty/invalid input. Use this on every imported value.
 */
export function normalizeIso(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
