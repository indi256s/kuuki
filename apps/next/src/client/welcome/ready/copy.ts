// Every string of the reveal (spec O23, boards 15.6, 15.10, 19.x), written in English and Russian together. Russian
// addresses the member as «вы». The narrator and stats lines live in `overview/narrator/welcome.ts`.
const p = (en: string, ru: string) => ({ en, ru })

export const COPY = {
  eyebrow: p('YOUR JOURNAL IS OPEN', 'ВАШ ЖУРНАЛ ОТКРЫТ'),
  open: p('Open my journal', 'Открыть журнал'),
  opening: p('Opening…', 'Открываем…'),
  openFailed: p(
    'We couldn’t open your journal just now. Nothing is lost: try again.',
    'Сейчас не получилось открыть журнал. Ничего не потеряно: повторите.',
  ),
  /** Mobile only: the sheet fades (the desktop passport's caption names the card). */
  caption: p(
    'Stamped. The sheet fades into your journal.',
    'Штамп поставлен. Лист растворится в вашем журнале.',
  ),
}
