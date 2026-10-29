export const AIRCRAFT_RESULT = {
  aircraftSavedTag: { en: 'Saved', ru: 'Сохранено' },
  aircraftFailedTag: { en: 'Not saved', ru: 'Не сохранено' },
  aircraftUncertainTag: { en: 'May not be saved', ru: 'Возможно, не сохранено' },
  aircraftUncertainNote: {
    en: 'We did not get an answer. Check the journal, or try again; trying again is safe.',
    ru: 'Ответа не было. Проверьте журнал или повторите; повторить безопасно.',
  },
  aircraftRetry: { en: 'Try again for the rest', ru: 'Повторить для остальных' },
} as const
