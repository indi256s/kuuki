type GroundVisit = {
  countryCode: string
  visitYear: number | null
  entryMethod: string | null
  note: string | null
  createdAt: string
}

/** Keep untrusted notes inert when opened in spreadsheet software. */
function cell(value: string | number | null): string {
  if (value == null) return ''
  const raw = String(value)
  const safe = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw
  return /[,"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function generateGroundVisitsCsv(visits: GroundVisit[]): string {
  const header = 'country_code,visit_year,entry_method,note,created_at'
  const rows = visits.map((visit) =>
    [visit.countryCode, visit.visitYear, visit.entryMethod, visit.note, visit.createdAt]
      .map(cell)
      .join(','),
  )
  return '\uFEFF' + header + '\n' + rows.join('\n')
}

export async function exportGroundVisits(visits: GroundVisit[]): Promise<void> {
  const { downloadCsv, getTimestampedFilename } = await import('@kuuki/client/export')
  downloadCsv(generateGroundVisitsCsv(visits), getTimestampedFilename('ground-visits'))
}

/** The versioned JSON the API serves, saved as-is (pretty-printed) so the file matches what the server exports. */
export type GroundJourneysExport = { journeys: unknown[]; manualPlaces: unknown[] }

export function exportGroundJourneys(body: GroundJourneysExport): void {
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `kuuki-ground-journeys-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
