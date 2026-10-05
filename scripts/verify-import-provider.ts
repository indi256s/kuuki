// Explicit release gate. Synthetic inputs stay in memory; only capability metadata is printed.
import { GoogleGenAI } from '@google/genai'
import { extractionContents, FLIGHT_RESPONSE_SCHEMA, normalizeFlights } from '../functions/api/import/_extract'
import type { ExtractedFlight, ParseRequest } from '../functions/api/import/_shared'
import { DEFAULT_MODEL, PROVIDER_TIMEOUT_MS, providerFailure } from '../functions/api/import/_provider'
import { FlightScanner } from '../workers/import/scanner'

function syntheticPdf(): string {
  const content = 'BT /F1 12 Tf 50 750 Td (Flight BA178, 10 March 2026, JFK to LHR.) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'; const offsets = [0]
  for (let index = 0; index < objects.length; index++) {
    offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf).toString('base64')
}

async function main() {
  if (!process.argv.includes('--real-provider') || !process.env.GEMINI_API_KEY) {
    throw new Error('Explicit --real-provider and GEMINI_API_KEY are required')
  }
  const model = process.env.GEMINI_IMPORT_MODEL?.trim() || DEFAULT_MODEL
  const provider = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const sources: ParseRequest[] = [
    { type: 'text', content: 'Flight BA178, 10 March 2026, JFK to LHR.' },
    { type: 'pdf', content: syntheticPdf() },
    // Blank synthetic PNG checks image transport and structured streaming; it should yield no flights.
    { type: 'image', content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aW9sAAAAASUVORK5CYII=' },
  ]
  for (const source of sources) {
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
    try {
      const stream = await provider.models.generateContentStream({ model, contents: extractionContents(source), config: {
        responseMimeType: 'application/json', responseSchema: FLIGHT_RESPONSE_SCHEMA,
        httpOptions: { timeout: PROVIDER_TIMEOUT_MS }, abortSignal: controller.signal,
      } })
      const scanner = new FlightScanner(); let completeRows = 0
      for await (const chunk of stream) for (const _row of scanner.push(chunk.text ?? '')) completeRows++
      const flights = normalizeFlights({ flights: scanner.finish() as ExtractedFlight[] }).flights
      if (source.type !== 'image' && (!flights.length || !completeRows)) throw new Error('Synthetic flight was not extracted')
      console.log(JSON.stringify({ event: 'import_streaming_capability', model, source_type: source.type, valid_rows: flights.length }))
    } finally { clearTimeout(deadline); controller.abort() }
  }
}
main().catch(error => {
  console.error(JSON.stringify({ event: 'import_streaming_capability_failed', code: providerFailure(error).code }))
  process.exitCode = 1
})
