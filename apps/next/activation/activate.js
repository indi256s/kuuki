// Isolated activation page script (the only script its CSP allows). This parser-blocking script captures and erases
// the one-use fragment before DOM setup or async work, and applies theme, accent and language before first paint.
let token = new URLSearchParams(window.location.hash.slice(1)).get('token')
window.history.replaceState(null, '', '/activate')
if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) token = null

const words = {
  en: {
    title: 'Welcome back to Kuuki',
    heading: 'Welcome back to Kuuki',
    description:
      'Kuuki has moved. Set a password to open your journal. Your flights are all there.',
    password: 'New password',
    rule: 'At least 8 characters',
    show: 'Show password',
    save: 'Save password',
    saving: 'Saving…',
    short: 'Use at least 8 characters.',
    limited: 'Too many attempts. Please wait and try again.',
    network: 'Could not save your password. Please try again.',
    expiredTitle: 'This link has expired',
    expiredHeading: 'This link has expired',
    expiredDescription: 'Links work once, for 30 minutes.',
    resend: 'Send a new link',
    signin: 'Back to sign in',
    darkTheme: 'Dark theme',
    pause: 'Pause animation',
    accent: 'Accent',
  },
  ru: {
    title: 'С возвращением в Kuuki',
    heading: 'С возвращением в Kuuki',
    description:
      'Kuuki переехал. Задайте пароль, чтобы открыть журнал. Все ваши перелёты на месте.',
    password: 'Новый пароль',
    rule: 'Не меньше 8 символов',
    show: 'Показать пароль',
    save: 'Сохранить пароль',
    saving: 'Сохраняем…',
    short: 'Используйте не меньше 8 символов.',
    limited: 'Слишком много попыток. Подождите и повторите.',
    network: 'Не удалось сохранить пароль. Повторите попытку.',
    expiredTitle: 'Срок действия ссылки истёк',
    expiredHeading: 'Срок действия ссылки истёк',
    expiredDescription: 'Ссылка работает один раз в течение 30 минут.',
    resend: 'Отправить новую ссылку',
    signin: 'Назад ко входу',
    darkTheme: 'Тёмная тема',
    pause: 'Приостановить анимацию',
    accent: 'Акцент',
  },
}
const accents = ['shu', 'ai', 'matcha', 'asagi', 'sakura']
// Same names as NAMES in client/ui/swatch-picker.tsx.
const accentNames = {
  shu: { en: 'Shu', ru: 'Шу' },
  ai: { en: 'Ai', ru: 'Ай' },
  matcha: { en: 'Matcha', ru: 'Матча' },
  asagi: { en: 'Asagi', ru: 'Асаги' },
  sakura: { en: 'Sakura', ru: 'Сакура' },
}
// The endonym names the language to someone who cannot read the page; the code is what the button shows.
const languages = { en: { code: 'EN', name: 'English' }, ru: { code: 'RU', name: 'Русский' } }
// Retired names land on their successors, as resolveAccent in lib/theme-colors.ts does; anything else is Shu.
const retiredAccents = {
  terracotta: 'shu',
  kincha: 'shu',
  sumi: 'shu',
  yellow: 'shu',
  red: 'shu',
  orange: 'shu',
  blue: 'ai',
  cyan: 'asagi',
  teal: 'asagi',
  purple: 'sakura',
  coral: 'sakura',
}
const root = document.documentElement
const readCookie = (name) =>
  document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')[1]
const writeCookie = (name, value) => {
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
}
let locale =
  readCookie('kuuki_locale') === 'ru' ||
  (!readCookie('kuuki_locale') && navigator.language.toLowerCase().startsWith('ru'))
    ? 'ru'
    : 'en'
let theme = readCookie('kuuki_theme')
if (!['system', 'light', 'dark'].includes(theme)) theme = 'system'
const media = matchMedia('(prefers-color-scheme: dark)')
// The theme in effect: the stored choice, or the device setting until someone picks one.
const applyTheme = () => {
  root.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
  root.style.colorScheme = root.dataset.theme
  document
    .getElementById('theme-toggle')
    ?.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'))
}
applyTheme()
const accent = readCookie('kuuki_accent')
root.dataset.accent = accents.includes(accent)
  ? accent
  : Object.hasOwn(retiredAccents, accent)
    ? retiredAccents[accent]
    : 'shu'
root.lang = locale

function setup() {
  const $ = (id) => document.getElementById(id)
  const form = $('activation-form')
  const password = $('password')
  const submit = $('submit')
  const reveal = $('reveal')
  let state = token ? 'set' : 'expired'
  let errorKey = ''
  let invalid = false
  let busy = false
  const t = (key) => words[locale][key]
  const render = () => {
    root.lang = locale
    document.title = t(state === 'set' ? 'title' : 'expiredTitle')
    const other = locale === 'ru' ? 'en' : 'ru'
    $('locale').lang = other
    $('locale').setAttribute('aria-label', `${languages[other].name} (${languages[other].code})`)
    $('locale').title = languages[other].name
    $('locale')
      .querySelectorAll('span')
      .forEach((code) => {
        code.toggleAttribute('data-shown', code.dataset.code === other)
      })
    const current = root.dataset.accent
    $('accent').setAttribute('aria-label', `${t('accent')}: ${accentNames[current][locale]}`)
    $('accent').title = t('accent')
    $('accent-menu').querySelector('[role="radiogroup"]').setAttribute('aria-label', t('accent'))
    $('accent-menu')
      .querySelectorAll('[data-accent-option]')
      .forEach((cell, index) => {
        const name = cell.dataset.accentOption
        const on = name === current
        cell.setAttribute('aria-label', accentNames[name][locale])
        cell.setAttribute('aria-checked', String(on))
        cell.tabIndex = on ? 0 : -1
        if (on) $('accent-menu').style.setProperty('--i', String(index))
      })
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n)
    })
    document.querySelectorAll('[data-i18n-label]').forEach((element) => {
      element.setAttribute('aria-label', t(element.dataset.i18nLabel))
      if (element.hasAttribute('title')) element.setAttribute('title', t(element.dataset.i18nLabel))
    })
    $('set-password').hidden = state !== 'set'
    $('expired').hidden = state !== 'expired'
    $('password-error').hidden = !errorKey
    $('password-error-text').textContent = errorKey ? t(errorKey) : ''
    password.setAttribute('aria-invalid', String(invalid))
    password.setAttribute(
      'aria-describedby',
      errorKey ? 'password-hint password-error' : 'password-hint',
    )
    password.readOnly = busy
    form.setAttribute('aria-busy', String(busy))
    submit.setAttribute('aria-disabled', String(busy))
    $('spinner').toggleAttribute('hidden', !busy)
    $('submit-label').textContent = t(busy ? 'saving' : 'save')
  }
  const expire = () => {
    token = null
    state = 'expired'
    busy = false
    render()
    $('expired-heading').focus()
  }

  // Reuse the card's lap calculation; SVG placement stays unchanged under reduced motion.
  document.querySelectorAll('.planes').forEach((svg) => {
    const width = Number(svg.getAttribute('width'))
    const height = Number(svg.getAttribute('height'))
    svg.querySelectorAll('use').forEach((plane) => {
      const [, x, y] = plane
        .getAttribute('transform')
        .match(/^translate\((\d+) (\d+)\)/)
        .map(Number)
      const enter = Math.max((-16 - x) / 400, (y - height - 16) / 800)
      const leave = Math.min((width + 16 - x) / 400, (y + 16) / 800)
      const lap = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      lap.classList.add('plane')
      lap.style.setProperty('--plane-start', String(Math.round((enter - 0.01) * 1e4) / 1e4))
      lap.style.setProperty('--plane-span', String(Math.round((leave - enter + 0.02) * 1e4) / 1e4))
      plane.replaceWith(lap)
      lap.append(plane)
    })
  })
  const field = document.querySelector('.brand-field')
  const pause = $('motion-pause')
  let motionPaused = false
  try {
    motionPaused = localStorage.getItem('kuuki-auth-motion-paused') === 'true'
  } catch {
    // Storage may be blocked; the pause still lasts for this page.
  }
  let onScreen = false
  const syncPlanes = () => {
    field.dataset.running = String(onScreen && !document.hidden && !motionPaused)
    pause.setAttribute('aria-pressed', String(motionPaused))
    // Keyline Play/Pause geometry, matching the auth card's static state icons.
    pause
      .querySelector('path')
      .setAttribute(
        'd',
        motionPaused
          ? 'M6 6C6 5.2291 6.4431 4.5268 7.1389 4.1949C7.8347 3.8629 8.6593 3.9605 9.2585 4.4456L17.6292 11.2228C17.8638 11.4127 18 11.6983 18 12C18 12.3017 17.8638 12.5873 17.6292 12.7772L9.2585 19.5544C8.6593 20.0395 7.8347 20.1371 7.1389 19.8051C6.4431 19.4732 6 18.7709 6 18Z'
          : 'M5 5C5 4.447715 5.447715 4 6 4L8 4C8.552285 4 9 4.447715 9 5L9 19C9 19.552285 8.552285 20 8 20L6 20C5.447715 20 5 19.552285 5 19ZM15 5C15 4.447715 15.447715 4 16 4L18 4C18.552285 4 19 4.447715 19 5L19 19C19 19.552285 18.552285 20 18 20L16 20C15.447715 20 15 19.552285 15 19Z',
      )
  }
  pause.addEventListener('click', () => {
    motionPaused = !motionPaused
    try {
      localStorage.setItem('kuuki-auth-motion-paused', String(motionPaused))
    } catch {
      // Keep the explicit pause even when its saved choice cannot be written.
    }
    syncPlanes()
  })
  syncPlanes()
  const observer = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting
    syncPlanes()
  })
  observer.observe(field)
  document.addEventListener('visibilitychange', syncPlanes)

  $('locale').addEventListener('click', () => {
    locale = locale === 'ru' ? 'en' : 'ru'
    writeCookie('kuuki_locale', locale)
    render()
  })
  // The swatch tray under the drop: arrows and clicks apply the accent at once, as in the sign-in card's menu.
  const accentMenu = $('accent-menu')
  const cells = [...accentMenu.querySelectorAll('[data-accent-option]')]
  const pickAccent = (name) => {
    root.dataset.accent = name
    writeCookie('kuuki_accent', name)
    try {
      // Same key as rememberSignedOutPick in client/appearance.tsx: the next signed-in shell saves this pick.
      sessionStorage.setItem('kuuki-accent-pick', name)
    } catch {
      // The device keeps the accent; the profile's wins after sign-in.
    }
    render()
  }
  accentMenu.addEventListener('beforetoggle', (event) => {
    if (event.newState !== 'open') return
    // Under the drop, right edges aligned, as the card's menu opens (align end, 6px off).
    const box = $('accent').getBoundingClientRect()
    accentMenu.style.top = `${box.bottom + 6}px`
    accentMenu.style.right = `${Math.max(8, document.documentElement.clientWidth - box.right)}px`
  })
  accentMenu.addEventListener('toggle', (event) => {
    if (event.newState === 'open') cells.find((cell) => cell.tabIndex === 0)?.focus()
  })
  cells.forEach((cell, index) => {
    cell.addEventListener('click', () => pickAccent(cell.dataset.accentOption))
    cell.addEventListener('keydown', (event) => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!delta) return
      event.preventDefault()
      const next = cells[(index + delta + cells.length) % cells.length]
      pickAccent(next.dataset.accentOption)
      next.focus()
    })
  })
  $('theme-toggle').addEventListener('click', () => {
    theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    writeCookie('kuuki_theme', theme)
    applyTheme()
  })
  media.addEventListener('change', applyTheme)
  reveal.addEventListener('click', () => {
    password.type = password.type === 'password' ? 'text' : 'password'
    const shown = password.type === 'text'
    reveal.setAttribute('aria-pressed', String(shown))
    $('eye').toggleAttribute('hidden', shown)
    $('eye-off').toggleAttribute('hidden', !shown)
  })
  password.addEventListener('input', () => {
    if (!errorKey) return
    errorKey = ''
    invalid = false
    render()
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (busy || !token) return
    if (password.value.length < 8) {
      errorKey = 'short'
      invalid = true
      render()
      password.focus()
      return
    }
    errorKey = ''
    invalid = false
    busy = true
    render()
    try {
      const response = await fetch('/api/auth/activation/complete', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: password.value }),
      })
      if (response.ok) {
        // No automatic sign-in: the card on the main origin shows the password-saved notice. Nothing secret travels.
        token = null
        password.value = ''
        window.location.replace($('saved').href)
        return
      }
      const body = await response.json().catch(() => ({}))
      if (body.code === 'INVALID_ACTIVATION') {
        expire()
        return
      }
      errorKey = response.status === 429 ? 'limited' : 'network'
    } catch {
      errorKey = 'network'
    }
    busy = false
    render()
  })
  render()
}
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', setup, { once: true })
else setup()
