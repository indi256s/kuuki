export function nowIso(): string {
  return new Date().toISOString()
}

export function isoPlusSeconds(seconds: number, from: string = nowIso()): string {
  return new Date(new Date(from).getTime() + seconds * 1000).toISOString()
}

export function msSince(iso: string): number {
  return Date.now() - new Date(iso).getTime()
}

export function normalizeIso(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
