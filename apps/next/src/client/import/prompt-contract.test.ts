import { describe, expect, it } from 'vitest'
import { parseStructuredText } from '../../../../../functions/api/import/_text'
import { PROMPT_EXAMPLE, S } from './copy'

describe('import prompt v2 and the structured-text parser', () => {
  it.each(['en', 'ru'] as const)('the %s example block parses with no model call', (locale) => {
    const example = PROMPT_EXAMPLE[locale]
    expect(S.prompt[locale]).toContain(example)
    expect(S.prompt[locale]).toContain('KUUKI FLIGHTS v2')
    const rows = example.split('\n').filter((line) => line.includes('|'))
    const parsed = parseStructuredText('```text\n' + example + '\n```')
    expect(parsed).not.toBeNull()
    expect(parsed!.flights).toHaveLength(rows.length)
    expect(parsed!.flights.filter((flight) => flight.review_required)).toHaveLength(1)
  })
})
