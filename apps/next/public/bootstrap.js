/* Static bootstrap keeps the first painted shell aligned with local preferences.
   It reads no identity and can run under a strict script-src 'self' CSP. */
(() => {
  if (location.pathname === '/reset-password') {
    const token = new URLSearchParams(location.hash.slice(1)).get('token')
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) window.__kuukiResetToken = token
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
  }
  // App-owned entries carry a direction index before Next initializes its history payload.
  // Keep Next's fields: Settings can restore Back and Forward even without the Navigation API.
  const indexKey = '__kuukiHistoryIndex'
  const indexed = state => Number.isSafeInteger(state?.[indexKey])
  const replace = history.replaceState.bind(history)
  const push = history.pushState.bind(history)
  if (!indexed(history.state)) replace({ ...history.state, [indexKey]: 0 }, '')
  let lastIndex = history.state[indexKey]
  history.pushState = (state, title, url) => push({ ...state, [indexKey]: (history.state?.[indexKey] ?? 0) + 1 }, title, url)
  history.replaceState = (state, title, url) => replace({ ...state, [indexKey]: history.state?.[indexKey] ?? 0 }, title, url)
  window.addEventListener('popstate', () => { if (indexed(history.state)) lastIndex = history.state[indexKey] })
  window.addEventListener('hashchange', () => {
    if (!indexed(history.state)) replace({ ...history.state, [indexKey]: lastIndex + 1 }, '')
    lastIndex = history.state[indexKey]
  })
  const root = document.documentElement
  const read = name => document.cookie.split('; ').find(part => part.startsWith(`${name}=`))?.split('=')[1]
  let saved = read('kuuki_theme')
  try {
    const legacy = localStorage.getItem('kuuki-theme-mode')
    if (['light', 'dark', 'system'].includes(legacy)) saved = legacy
  } catch { /* storage unavailable */ }
  const theme = saved === 'light' || saved === 'dark' ? saved : 'system'
  if (read('kuuki_theme') !== theme) document.cookie = `kuuki_theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
  const effective = theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : theme === 'system' ? 'light' : theme
  root.dataset.theme = effective
  root.style.colorScheme = effective
  const localeCookie = read('kuuki_locale')
  let legacyLocale = null
  try { legacyLocale = localStorage.getItem('kuuki-language') } catch { /* storage unavailable */ }
  const locale = legacyLocale === 'en' || legacyLocale === 'ru' ? legacyLocale : localeCookie === 'en' || localeCookie === 'ru' ? localeCookie : navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
  root.dataset.locale = locale
  root.lang = locale
  if (localeCookie !== locale) {
    document.cookie = `kuuki_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
    // Align the server's first private payload with the stored Vite language.
    if (location.pathname !== '/reset-password' && (legacyLocale === 'en' || legacyLocale === 'ru')) {
      try {
        const marker = `kuuki-locale-sync:${location.pathname}`
        if (sessionStorage.getItem(marker) !== locale) { sessionStorage.setItem(marker, locale); location.replace(location.href); return }
      } catch { /* storage unavailable; next navigation uses the new cookie */ }
    }
  }
  let accent = read('kuuki_accent')
  let legacyAccent = null
  try { legacyAccent = localStorage.getItem('kuuki-accent-color') } catch { /* storage unavailable */ }
  const mapped = ({ blue: 'ai', cyan: 'ai', teal: 'matcha', yellow: 'kincha', purple: 'sakura', coral: 'sakura', red: 'terracotta', orange: 'terracotta' })[legacyAccent]
  if (mapped) accent = mapped
  if (!['terracotta', 'ai', 'matcha', 'kincha', 'sakura', 'sumi'].includes(accent)) accent = 'terracotta'
  if (read('kuuki_accent') !== accent) {
    document.cookie = `kuuki_accent=${accent}; Path=/; Max-Age=31536000; SameSite=Lax`
  }
  root.dataset.accent = accent
})()
