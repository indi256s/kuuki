// The prompt members send to their own assistant, and the help around it. Its output is what the server ingest reads best.
import { describe, expect, it } from 'vitest'
import { S } from './copy'

const locales = ['en', 'ru'] as const

describe('assistant prompt', () => {
  it.each(locales)('%s works with any assistant: no @-mentions or provider names', locale => {
    const prompt = S.prompt[locale]
    expect(prompt).not.toMatch(/@/)
    expect(prompt).not.toMatch(/gemini|chatgpt|claude|gmail|outlook|google calendar/i)
  })

  it('asks for the format the ingest handles best', () => {
    const en = S.prompt.en
    expect(en).toMatch(/email and calendar/)
    expect(en).toContain('YYYY-MM-DD | origin → destination | airline and flight number | departure-arrival')
    expect(en).toContain('2024-03-15 | JFK → LAX | American Airlines AA 123 | 08:30-11:45')
    expect(en).toMatch(/one line per flight/i)
    expect(en).toMatch(/four-digit year/)
    expect(en).toMatch(/3-letter IATA airport codes/)
    expect(en).toMatch(/city name/)
    expect(en).toMatch(/local .*24-hour/)
    expect(en).toMatch(/\+1/)
    expect(en).toMatch(/Write \? for anything/)
    expect(en).toMatch(/connection .* separate line/)
    expect(en).toMatch(/once/)
    expect(en).toMatch(/cancelled or refunded/)
    expect(en).toMatch(/oldest to newest/)
    expect(en).toMatch(/only the list in one plain-text code block/)
  })

  it('says to admit missing access instead of inventing flights', () => {
    expect(S.prompt.en).toMatch(/cannot access my email or calendar, say so [^]*Do not guess or make up flights/)
    expect(S.prompt.ru).toMatch(/нет доступа к моей почте или календарю, скажи об этом [^]*Не угадывай и не придумывай перелёты/)
  })

  it('keeps private details out of the reply', () => {
    for (const term of ['passenger names', 'booking references', 'ticket numbers', 'email addresses', 'frequent flyer numbers', 'payment details'])
      expect(S.prompt.en).toContain(term)
    for (const term of ['имена пассажиров', 'номера бронирований', 'номера билетов', 'адреса почты', 'номера бонусных карт', 'платёжные данные'])
      expect(S.prompt.ru).toContain(term)
  })

  it('asks for the same format in Russian', () => {
    const ru = S.prompt.ru
    expect(ru).toMatch(/почте и календаре/)
    expect(ru).toContain('ГГГГ-ММ-ДД | откуда → куда | авиакомпания и номер рейса | вылет-прилёт')
    expect(ru).toMatch(/по одному перелёту на строку/)
    expect(ru).toMatch(/годом из четырёх цифр/)
    expect(ru).toMatch(/трёхбуквенные коды аэропортов IATA/)
    expect(ru).toMatch(/название города/)
    expect(ru).toMatch(/\+1/)
    expect(ru).toMatch(/ставь \?/)
    expect(ru).toMatch(/отдельная строка/)
    expect(ru).toMatch(/один раз/)
    expect(ru).toMatch(/отменённые/)
    expect(ru).toMatch(/от самых ранних к самым поздним/)
    expect(ru).toMatch(/только списком в одном блоке кода/)
  })
})

describe('assistant help', () => {
  it.each(locales)('%s names the three assistants evenly and says to connect email and calendar first', locale => {
    const body = S.emailHelpBody[locale]
    expect(body).toMatch(/ChatGPT, Claude (or|или) Gemini/)
    expect(body).not.toMatch(/best|лучше|acceptable|сойд/i)
    expect(body).toMatch(locale === 'en' ? /connect your email and calendar/ : /подключите к нему почту и календарь/)
    expect(body).toContain(S.modeText[locale])
  })
})
