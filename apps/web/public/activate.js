// This parser-blocking script captures and erases the one-use fragment before DOM setup or async work.
let token = new URLSearchParams(window.location.hash.slice(1)).get('token')
window.history.replaceState(null, '', '/activate')
if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) token = null

const words = {
  en: { home: 'Kuuki home', language: 'Language', theme: 'Theme', system: 'System', light: 'Light', dark: 'Dark', brand: 'Your personal flight journal.', heading: 'Activate your account', description: 'Choose a personal password to access your existing Kuuki profile.', password: 'Password', confirm: 'Confirm password', rule: 'Use 8 to 1024 characters.', show: 'Show', hide: 'Hide', activate: 'Activate account', activating: 'Activating…', signin: 'Back to sign in', resend: 'Request a new activation link', email: 'Email for sign-in', optional: '(optional)', missing: 'This link is invalid or expired, or has already been used. Request a new activation link.', mismatch: 'Passwords do not match.', success: 'Your account is active. Sign in with your new password.', limited: 'Too many attempts. Please wait and try again.', network: 'Could not confirm activation. Try again, or sign in with the password you just submitted if activation completed.' },
  ru: { home: 'На главную Kuuki', language: 'Язык', theme: 'Тема', system: 'Система', light: 'Светлая', dark: 'Тёмная', brand: 'Личный журнал перелётов.', heading: 'Активировать аккаунт', description: 'Задайте личный пароль для доступа к старому профилю Kuuki.', password: 'Пароль', confirm: 'Повторите пароль', rule: 'От 8 до 1024 символов.', show: 'Показать', hide: 'Скрыть', activate: 'Активировать аккаунт', activating: 'Активируем…', signin: 'Назад ко входу', resend: 'Запросить новую ссылку активации', email: 'Почта для входа', optional: '(необязательно)', missing: 'Ссылка недействительна, уже использована или срок её действия истёк. Запросите новую ссылку активации.', mismatch: 'Пароли не совпадают.', success: 'Аккаунт активирован. Войдите с новым паролем.', limited: 'Слишком много попыток. Подождите и повторите.', network: 'Не удалось подтвердить активацию. Повторите попытку или войдите с отправленным паролем, если активация завершилась.' },
}
const root = document.documentElement
const readCookie = name => document.cookie.split('; ').find(part => part.startsWith(`${name}=`))?.split('=')[1]
let locale = readCookie('kuuki_locale') === 'ru' || (!readCookie('kuuki_locale') && navigator.language.toLowerCase().startsWith('ru')) ? 'ru' : 'en'
let theme = readCookie('kuuki_theme')
if (!['system', 'light', 'dark'].includes(theme)) theme = 'system'
const media = matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => { root.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; root.style.colorScheme = root.dataset.theme }
applyTheme()
const accent = readCookie('kuuki_accent')
root.dataset.accent = ['terracotta', 'ai', 'matcha', 'kincha', 'sakura', 'sumi'].includes(accent) ? accent : 'terracotta'
root.lang = locale

function setup() {
  const form = document.getElementById('activation-form')
  const status = document.getElementById('status')
  const submit = document.getElementById('submit')
  const password = document.getElementById('password')
  const confirmation = document.getElementById('confirmation')
  let statusKey = token ? '' : 'missing'
  let busy = false
  const errors = { password: '', confirmation: '' }
  const announce = (key, error = false) => { statusKey = key; status.textContent = words[locale][key] || ''; status.dataset.error = String(error); status.setAttribute('role', error ? 'alert' : 'status') }
  const update = () => {
    root.lang = locale
    document.title = words[locale].heading
    document.querySelector('.wordmark').setAttribute('aria-label', words[locale].home)
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = words[locale][element.dataset.i18n] })
    document.querySelectorAll('[data-reveal]').forEach(button => {
      const field = document.getElementById(button.dataset.reveal)
      const action = field.type === 'password' ? 'show' : 'hide'
      button.textContent = words[locale][action]
      button.setAttribute('aria-label', `${words[locale][action]}: ${words[locale][field.id === 'password' ? 'password' : 'confirm']}`)
    })
    for (const id of ['password', 'confirmation']) document.getElementById(`${id}-error`).textContent = words[locale][errors[id]] || ''
    announce(statusKey, status.dataset.error === 'true')
    submit.textContent = words[locale][busy ? 'activating' : 'activate']
  }
  document.getElementById('locale').value = locale
  document.getElementById('theme').value = theme
  document.getElementById('locale').addEventListener('change', event => { locale = event.target.value; document.cookie = `kuuki_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`; update() })
  document.getElementById('theme').addEventListener('change', event => { theme = event.target.value; document.cookie = `kuuki_theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`; applyTheme() })
  media.addEventListener('change', applyTheme)
  document.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
    const field = document.getElementById(button.dataset.reveal)
    field.type = field.type === 'password' ? 'text' : 'password'
    button.setAttribute('aria-pressed', String(field.type === 'text'))
    update()
  }))
  const setError = (id, key) => { errors[id] = key; document.getElementById(`${id}-error`).textContent = words[locale][key] || ''; document.getElementById(`${id}-error`).setAttribute('role', key ? 'alert' : 'presentation'); document.getElementById(id).setAttribute('aria-invalid', String(Boolean(key))) }
  password.addEventListener('input', () => setError('password', ''))
  confirmation.addEventListener('input', () => setError('confirmation', ''))
  document.getElementById('email').addEventListener('input', event => {
    const email = event.target.value.trim()
    for (const id of ['signin', 'resend']) {
      const link = document.getElementById(id)
      const url = new URL(link.href)
      if (email) url.searchParams.set('email', email); else url.searchParams.delete('email')
      link.href = url.href
    }
  })
  form.hidden = !token
  update()
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (busy || !token) return
    const invalidPassword = password.value.length < 8 || password.value.length > 1024
    const mismatch = password.value !== confirmation.value
    setError('password', invalidPassword ? 'rule' : '')
    setError('confirmation', mismatch ? 'mismatch' : '')
    if (invalidPassword || mismatch) { (invalidPassword ? password : confirmation).focus(); return }
    busy = true
    submit.disabled = true
    form.setAttribute('aria-busy', 'true')
    announce('activating')
    update()
    try {
      const response = await fetch('/api/auth/activation/complete', {
        method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: password.value }),
      })
      if (response.ok) {
        token = null
        password.value = ''; confirmation.value = ''
        form.hidden = true
        document.getElementById('signin-email').hidden = false
        document.getElementById('resend').hidden = true
        announce('success')
      } else {
        const body = await response.json().catch(() => ({}))
        if (body.code === 'INVALID_ACTIVATION') { token = null; form.hidden = true; announce('missing', true) }
        else announce(response.status === 429 ? 'limited' : 'network', true)
      }
    } catch { announce('network', true) }
    finally { busy = false; submit.disabled = false; form.setAttribute('aria-busy', 'false'); update() }
  })
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true }); else setup()
