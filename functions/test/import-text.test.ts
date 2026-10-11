// parseStructuredText: the deterministic reader that lets a KUUKI FLIGHTS list skip the model.
import { describe, expect, it } from 'vitest'
import { parseStructuredText } from '../api/import/_text'

const ROWS = [
  '2024-03-15 | JFK → LAX | American Airlines AA 123 | 08:30 → 11:45',
  '2024-03-22 | LAX → JFK | Delta DL 409 | 22:10 → 06:35+1',
]

describe('parseStructuredText', () => {
  it('parses the v2 header with valid rows', () => {
    const parsed = parseStructuredText(['KUUKI FLIGHTS v2', ...ROWS].join('\n'))
    expect(parsed?.flights).toHaveLength(2)
    expect(parsed?.flights[0]).toMatchObject({
      date: '2024-03-15',
      origin: 'JFK',
      destination: 'LAX',
      airline_iata: 'AA',
      flight_number: '123',
      departure_time: '08:30',
      arrival_time: '11:45',
      review_required: false,
    })
  })

  it.each([
    ['fence then header', '```text\nKUUKI FLIGHTS v2\n' + ROWS.join('\n') + '\n```'],
    ['header then fence', 'KUUKI FLIGHTS v2\n```\n' + ROWS.join('\n') + '\n```'],
    ['a padded lowercase header', '  kuuki   flights V2  \n' + ROWS.join('\n')],
    ['a bare fence', '```\n' + ROWS.join('\n') + '\n```\n'],
  ])('ignores %s', (_label, content) => {
    expect(parseStructuredText(content)?.flights).toHaveLength(2)
  })

  it('still parses the legacy header-less rows', () => {
    expect(parseStructuredText(ROWS.join('\n'))?.flights).toHaveLength(2)
  })

  it('parses an unknown version', () => {
    expect(parseStructuredText(['KUUKI FLIGHTS v3', ...ROWS].join('\n'))?.flights).toHaveLength(2)
  })

  it('falls back to the model when any line is unrecognised', () => {
    expect(
      parseStructuredText(['KUUKI FLIGHTS v2', ROWS[0], 'Here are your flights!'].join('\n')),
    ).toBeNull()
  })

  it('keeps a [maybe cancelled] row for review instead of skipping it', () => {
    const parsed = parseStructuredText(
      [
        'KUUKI FLIGHTS v2',
        ROWS[0],
        '2025-01-10 | JFK → LHR | British Airways BA 178 [maybe cancelled]',
      ].join('\n'),
    )
    expect(parsed?.flights.map((flight) => flight.review_required)).toEqual([false, true])
  })

  it('still skips a plainly cancelled row', () => {
    const parsed = parseStructuredText(
      [ROWS[0], '2025-01-10 | JFK → LHR | BA 178 [cancelled]'].join('\n'),
    )
    expect(parsed?.flights).toHaveLength(1)
  })

  it('reads the Undated and other-passenger sections', () => {
    const parsed = parseStructuredText(
      [
        'KUUKI FLIGHTS v2',
        ROWS[0],
        'Other-passenger bookings or conflicting ownership (1)',
        '2024-05-01 | JFK → LHR | BA 178',
        'Partial dates / incomplete records (1)',
        'Undated | SVO → LED | Aeroflot SU 6',
      ].join('\n'),
    )
    expect(parsed?.flights.map((flight) => flight.date)).toEqual(['2024-03-15', ''])
  })
})
