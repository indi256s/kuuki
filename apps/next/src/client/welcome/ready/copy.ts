const p = (en: string, ru: string) => ({ en, ru })

export const COPY = {
  eyebrow: p('YOUR JOURNAL IS OPEN', 'ВАШ ЖУРНАЛ ОТКРЫТ'),
  open: p('Open my journal', 'Открыть журнал'),
  opening: p('Opening…', 'Открываем…'),
  openFailed: p(
    'We couldn’t open your journal just now. Nothing is lost: try again.',
    'Сейчас не получилось открыть журнал. Ничего не потеряно: повторите.',
  ),
  caption: p(
    'Stamped. The sheet fades into your journal.',
    'Штамп поставлен. Лист растворится в вашем журнале.',
  ),
}
