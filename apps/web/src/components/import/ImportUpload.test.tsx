import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { enTranslations, ruTranslations } from '@kuuki/shared'
import { ImportUpload } from './ImportUpload'

// The previous helper prompt is still in members' clipboards and notes.
const OLD_PROMPT = `@Gmail @Google Calendar Search for all flight bookings, boarding passes, itineraries, and travel confirmations.

For each flight, try to find (include only what you can find):
- Origin and destination airports (city names or airport codes)

Format: one flight per line, include whatever info you found.`

async function renderIn(lng: 'en' | 'ru') {
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({
    lng, fallbackLng: 'en', interpolation: { escapeValue: false },
    resources: { en: { translation: enTranslations }, ru: { translation: ruTranslations } },
  })
  render(<I18nextProvider i18n={i18n}><ImportUpload onSubmit={vi.fn()} /></I18nextProvider>)
  return i18n
}

describe('ImportUpload assistant tip', () => {
  it.each([
    ['en', enTranslations, 'Show prompt', 'Copy'],
    ['ru', ruTranslations, 'Показать запрос', 'Копировать'],
  ] as const)('shows and copies the %s prompt with the import limit', async (lng, bundle, show, copy) => {
    const user = userEvent.setup() // installs its own clipboard stub, so spy after setup
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await renderIn(lng)
    expect(screen.getByText(bundle.import.tip.limit)).toBeInTheDocument()
    expect(screen.getByText(bundle.import.tip.recommendation)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: show }))
    const shown = document.querySelector('pre')
    expect(shown?.textContent).toBe(bundle.import.tip.prompt)
    await user.click(screen.getByRole('button', { name: copy }))
    expect(writeText).toHaveBeenCalledWith(bundle.import.tip.prompt)
    writeText.mockRestore()
  })

  it.each([
    ['the previous helper prompt', 'en', OLD_PROMPT],
    ['the current English prompt', 'en', enTranslations.import.tip.prompt],
    ['the current Russian prompt', 'ru', ruTranslations.import.tip.prompt],
  ] as const)('warns when %s is pasted instead of the reply', async (_name, lng, pasted) => {
    await renderIn(lng)
    const bundle = lng === 'ru' ? ruTranslations : enTranslations
    fireEvent.change(screen.getByPlaceholderText(bundle.import.upload.textPlaceholder), { target: { value: pasted } })
    expect(screen.getByText(bundle.import.tip.easterEgg)).toBeInTheDocument()
  })

  it('does not warn for a pasted flight list', async () => {
    await renderIn('en')
    fireEvent.change(screen.getByPlaceholderText(enTranslations.import.upload.textPlaceholder), {
      target: { value: '2024-03-15 | JFK → LAX | American Airlines AA 123 | 08:30-11:45' },
    })
    expect(screen.queryByText(enTranslations.import.tip.easterEgg)).not.toBeInTheDocument()
  })
})
