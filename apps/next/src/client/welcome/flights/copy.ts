// Every string of the first-flight step (spec O12–O20, boards 15.2–15.4, 17.x), written in English and Russian
// together. Russian addresses the member as «вы». The server's messages are never shown.
import type { CountForms } from '../../../lib/format'

const p = (en: string, ru: string) => ({ en, ru })

export const COPY = {
  title: p('Where have you flown?', 'Где вы летали?'),
  readyTitle: p('Your flights are read', 'Ваши перелёты прочитаны'),
  titleNamed: p('Where have you flown, {name}?', 'Где вы летали, {name}?'),
  sub: p(
    'Ask ChatGPT, Claude or Gemini to find your flights.',
    'Попросите ChatGPT, Claude или Gemini найти ваши перелёты.',
  ),
  promptLabel: p('Prompt for your assistant', 'Запрос для вашего ассистента'),
  copyPrompt: p('Copy prompt', 'Скопировать запрос'),
  copyFailed: p(
    'Couldn’t copy it automatically. The prompt is selected: copy it by hand.',
    'Не удалось скопировать автоматически. Запрос выделен: скопируйте его вручную.',
  ),
  copied: p('Prompt copied', 'Запрос скопирован'),
  copyAgain: p('Copy again', 'Скопировать ещё раз'),
  typeIn: p('Type a flight in', 'Ввести перелёт вручную'),
  later: p('I’ll do this later', 'Сделаю это позже'),
  keepExploring: p('Keep exploring', 'Пока осмотрюсь'),
  laterFailed: p(
    'We couldn’t wrap up just now. Nothing is lost: try again.',
    'Сейчас не получилось завершить. Ничего не потеряно: повторите.',
  ),
  orPaste: p('Paste or add a boarding pass', 'Вставить или добавить посадочный'),
  addPass: p('Add a boarding pass', 'Добавить посадочный'),

  pasteTitle: p('Now paste the reply', 'Теперь вставьте ответ'),
  pasteSub: p(
    'Copy what your assistant wrote and paste it anywhere here. We read it the moment it lands.',
    'Скопируйте ответ ассистента и вставьте его где угодно здесь. Мы прочитаем его сразу.',
  ),
  pasteSubTouch: p(
    'Copy what your assistant wrote, then paste it here.',
    'Скопируйте ответ ассистента и вставьте его сюда.',
  ),
  pasteButton: p('Paste from clipboard', 'Вставить из буфера'),
  hint: p(
    'or press {key} anywhere · drop a file',
    'или нажмите {key} где угодно · перетащите файл',
  ),
  hintBlocked: p(
    'paste anywhere on this page · drop a file',
    'вставляйте где угодно на странице · перетащите файл',
  ),
  boxLabel: p('Paste the reply here', 'Вставьте ответ сюда'),
  boxHint: p('Press and hold here, then tap Paste', 'Нажмите и удерживайте, затем «Вставить»'),
  readBox: p('Read these flights', 'Прочитать перелёты'),
  drop: p('Drop it to read it', 'Отпустите, чтобы прочитать'),

  denied: p(
    'Your browser didn’t let us read the clipboard. Press {key} on this page instead, or drop a file.',
    'Браузер не дал прочитать буфер обмена. Нажмите {key} на этой странице или перетащите файл.',
  ),
  deniedTouch: p(
    'Your browser didn’t let us read the clipboard. Paste into the box instead.',
    'Браузер не дал прочитать буфер обмена. Вставьте текст в поле.',
  ),
  empty: p(
    'Your clipboard has no text on it yet. Copy your assistant’s reply, then try again.',
    'В буфере обмена пока нет текста. Скопируйте ответ ассистента и повторите.',
  ),
  fileType: p(
    'We can’t read this kind of file. Boarding passes work as PDF, PNG or JPEG.',
    'Такой файл мы прочитать не можем. Посадочные подойдут в формате PDF, PNG или JPEG.',
  ),
  fileSize: p(
    'That file is bigger than we can read ({mb} MB). The limit is 10 MB. A screenshot of the pass is usually smaller.',
    'Файл больше, чем мы можем прочитать ({mb} МБ). Предел: 10 МБ. Скриншот посадочного обычно легче.',
  ),
  fileRead: p(
    'We couldn’t open that file. Try another one.',
    'Не удалось открыть этот файл. Попробуйте другой.',
  ),
  fileServer: p(
    'We couldn’t read that file. Boarding passes work as PDF, PNG or JPEG under 10 MB.',
    'Не удалось прочитать этот файл. Посадочные подойдут в формате PDF, PNG или JPEG до 10 МБ.',
  ),
  notFlights: p(
    'We couldn’t find any flights in that text. Your assistant may have answered a different question.',
    'В этом тексте перелётов не нашлось. Возможно, ассистент ответил на другой вопрос.',
  ),
  notFlightsFile: p(
    'We couldn’t find any flights in that file.',
    'В этом файле перелётов не нашлось.',
  ),
  nothingKnown: p(
    'Your assistant replied, but the list had no flights in it. It may not have been able to open your email or calendar. Copy the prompt again and try another assistant.',
    'Ассистент ответил, но в списке нет перелётов. Возможно, у него не получилось открыть вашу почту или календарь. Скопируйте запрос ещё раз и попробуйте другого ассистента.',
  ),
  tooLong: p(
    'That reply is longer than we can read in one go. Paste it in two parts and we’ll add both. Nothing was added yet.',
    'Этот ответ длиннее, чем мы можем прочитать за раз. Вставьте его двумя частями, и мы добавим обе. Пока ничего не добавлено.',
  ),
  tooLongCount: p('{count} characters · limit {limit}', '{count} символов · предел {limit}'),
  rateLimit: p(
    'We can only read a few replies at a time, and you’ve reached that for now. Try again in a while.',
    'Мы читаем лишь несколько ответов за раз, и сейчас лимит исчерпан. Повторите чуть позже.',
  ),
  rateLimitPill: p('Try again in a while', 'Повторите чуть позже'),
  rateLimitKept: p('your reply is kept on this page', 'ваш ответ сохранён на этой странице'),
  error: p(
    'We couldn’t read that just now. Nothing was saved. Try again, or paste it once more.',
    'Сейчас прочитать не получилось. Ничего не сохранено. Повторите или вставьте ещё раз.',
  ),
  gone: p(
    'That read is no longer here. Paste or drop your flights again.',
    'Это чтение больше недоступно. Вставьте или перетащите перелёты заново.',
  ),
  readAgain: p('Read again', 'Прочитать снова'),

  offlineTitle: p('Waiting for a connection', 'Ждём подключения'),
  offlineCount: p('flights yet.', 'перелётов пока.'),
  offlineNote: p(
    'Keep this tab open for now. We’ll send your reply as soon as you’re back online.',
    'Пока не закрывайте вкладку. Мы отправим ваш ответ, как только сеть вернётся.',
  ),
  tryNow: p('Try now', 'Попробовать сейчас'),

  readingTitle: p('Reading your flights', 'Читаем ваши перелёты'),
  found: p('found so far', 'найдено пока'),
  read: p('read', 'прочитано'),
  safe: p('You can close this tab.', 'Вкладку можно закрыть.'),
  listLabel: p('Latest flights found', 'Последние найденные перелёты'),
  truncated: p(
    'Your reply had more flights than we can read at once, so we took the first {count}. Paste the rest after you review these.',
    'В вашем ответе больше перелётов, чем мы читаем за раз, поэтому взяли первые {count}. Остальное вставьте после проверки этих.',
  ),
  stoppedNoSource: p(
    'Paste the reply again to read the rest.',
    'Вставьте ответ ещё раз, чтобы прочитать остальное.',
  ),
  readRest: p('Read the rest again', 'Прочитать остальное снова'),

  back: p('Back', 'Назад'),
  manualTitle: p('Type a flight in', 'Введите перелёт'),
} as const

export const countryForms: CountForms = {
  en: { one: '{count} country', other: '{count} countries' },
  ru: {
    one: '{count} страна',
    few: '{count} страны',
    many: '{count} стран',
    other: '{count} страны',
  },
}

export const reviewForms: CountForms = {
  en: { one: 'Review {count} flight', other: 'Review {count} flights' },
  ru: {
    one: 'Проверить {count} перелёт',
    few: 'Проверить {count} перелёта',
    many: 'Проверить {count} перелётов',
    other: 'Проверить {count} перелёта',
  },
}

export const stoppedForms: CountForms = {
  en: {
    one: 'Reading stopped after {count} flight because something went wrong on our side. That one is saved.',
    other:
      'Reading stopped after {count} flights because something went wrong on our side. Those {count} are saved.',
  },
  ru: {
    one: 'Чтение остановилось после {count} перелёта: на нашей стороне что-то пошло не так. Он сохранён.',
    few: 'Чтение остановилось после {count} перелётов: на нашей стороне что-то пошло не так. Они сохранены.',
    many: 'Чтение остановилось после {count} перелётов: на нашей стороне что-то пошло не так. Они сохранены.',
    other:
      'Чтение остановилось после {count} перелётов: на нашей стороне что-то пошло не так. Они сохранены.',
  },
}
