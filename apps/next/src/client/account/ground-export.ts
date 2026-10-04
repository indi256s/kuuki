type GroundVisit = { countryCode: string; visitYear: number | null; entryMethod: string | null; note: string | null; createdAt: string }

/** Keep untrusted notes inert when opened in spreadsheet software. */
function cell(value: string | number | null): string {
  if (value == null) return ''
  const raw = String(value)
  const safe = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw
  return /[,"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function generateGroundVisitsCsv(visits: GroundVisit[]): string {
  const header = 'country_code,visit_year,entry_method,note,created_at'
  const rows = visits.map(visit => [visit.countryCode, visit.visitYear, visit.entryMethod, visit.note, visit.createdAt].map(cell).join(','))
  return '\uFEFF' + header + '\n' + rows.join('\n')
}

export async function exportGroundVisits(visits: GroundVisit[]): Promise<void> {
  const { downloadCsv, getTimestampedFilename } = await import('../../../../web/src/lib/export')
  downloadCsv(generateGroundVisitsCsv(visits), getTimestampedFilename('ground-visits'))
}
