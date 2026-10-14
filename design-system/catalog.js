const palette = JSON.parse('PALETTE_JSON')
const report = JSON.parse('REPORT_JSON')
const root = document.getElementById('catalog')
const theme = document.getElementById('theme')
const accent = document.getElementById('accent')
const names = { shu: 'Shu', ai: 'Ai', matcha: 'Matcha', asagi: 'Asagi', sakura: 'Sakura' }
const roles = {
  background: 'Страница',
  surface: 'Карточка',
  'surface-inset': 'Вложенная поверхность',
  'surface-floating': 'Плавающий слой',
  text: 'Основной текст',
  'text-muted': 'Вторичный текст',
  accent: 'Главное действие',
  'accent-foreground': 'Текст на главном действии',
  'accent-text': 'Ссылка и активная навигация',
  'accent-tint': 'Выбранный фильтр / стекло фигуры',
  'accent-on-tint': 'Текст на акцентном тоне',
  focus: 'Клавиатурный фокус',
  'control-border': 'Граница контрола',
  hairline: 'Граница карточки',
  'mark-rest': 'Обычное значение',
  'mark-peak': 'Выбранное значение',
  'selection-contour': 'Контур выбранного значения',
  'heat-0': 'Известный ноль',
  missing: 'Нет данных / пунктир',
  'danger-text': 'Ошибка / удаление',
  'danger-foreground': 'Текст на опасной заливке',
  'cat-maker-airbus': 'Категория производителя',
  'figure-live-fill': 'Заливка читаемой панели фигуры',
}
function swatches(id, list, tokens) {
  document.getElementById(id).innerHTML = list
    .map(
      (k) =>
        `<div><div class="color-chip" style="background:var(--${k})"></div><div class="swatch-name">${roles[k]}</div><code>${tokens[k]}</code></div>`,
    )
    .join('')
}
function apply() {
  const key = `${theme.value}-${accent.value}`
  const tokens = palette.themes[key]
  root.dataset.theme = theme.value
  root.dataset.accent = accent.value
  document.documentElement.dataset.theme = theme.value
  for (const [role, value] of Object.entries(tokens)) root.style.setProperty('--' + role, value)
  swatches(
    'surface-swatches',
    ['background', 'surface', 'surface-inset', 'surface-floating', 'text', 'text-muted'],
    tokens,
  )
  swatches(
    'accent-swatches',
    ['accent', 'accent-text', 'accent-tint', 'accent-foreground', 'focus', 'mark-peak'],
    tokens,
  )
  document.getElementById('token-table').innerHTML = Object.entries(roles)
    .map(
      ([role, job]) =>
        `<tr><td><code>--${role}</code></td><td><i class="token-dot" style="--token-value:var(--${role})"></i><code>${tokens[role]}</code></td><td>${job}</td></tr>`,
    )
    .join('')
  for (const button of document.querySelectorAll('[data-accent-pick]')) {
    button.setAttribute('aria-pressed', String(button.dataset.accentPick === accent.value))
    button.style.setProperty(
      '--swatch-fill',
      palette.themes[`${theme.value}-${button.dataset.accentPick}`].accent,
    )
  }
  document.getElementById('check-summary').textContent =
    `${report.combinations} сочетаний темы и акцента · ${report.checks} проверок · ${report.failures.length} ошибок. Минимальный контраст текста в выбранной палитре: ${report.minimumByTheme[key].toFixed(2)}:1.`
}
for (const [key, name] of Object.entries(names)) {
  const b = document.createElement('button')
  b.type = 'button'
  b.dataset.accentPick = key
  b.innerHTML = `<span class="dot" aria-hidden="true"></span>${name}`
  b.addEventListener('click', () => {
    accent.value = key
    apply()
  })
  document.getElementById('accent-picks').append(b)
}
theme.addEventListener('change', apply)
accent.addEventListener('change', apply)
const counts = [10, 15, 28, 22, 15, 10]
const hours = ['00', '04', '08', '12', '16', '20']
for (const [i, count] of counts.entries()) {
  const item = document.createElement('div')
  item.className = 'bar-item'
  item.innerHTML = `<span class="small">${count}</span><button aria-label="${hours[i]}:00, ${count} перелётов" aria-pressed="${i === 2}" style="--height:${(count / 28) * 96}px"><span class="bar"></span></button><span class="bar-label">${hours[i]}</span>`
  item.querySelector('button').addEventListener('click', (e) => {
    for (const b of document.querySelectorAll('#bars button'))
      b.setAttribute('aria-pressed', String(b === e.currentTarget))
    document.getElementById('selected-hour').textContent = hours[i] + ':00'
    document.getElementById('bar-reading').textContent =
      `✓ Выбрано ${hours[i]}:00 · ${count} перелётов`
  })
  document.getElementById('bars').append(item)
}
for (let i = 0; i < 100; i++) {
  const cell = document.createElement('span')
  cell.className = 'cell'
  cell.setAttribute('aria-hidden', 'true')
  const maker = i < 60 ? 'airbus' : i < 90 ? 'boeing' : i < 96 ? 'embraer' : 'unknown'
  if (maker === 'unknown') {
    cell.classList.add('unknown')
    cell.textContent = '?'
  } else cell.style.setProperty('--cell-fill', `var(--cat-maker-${maker})`)
  document.getElementById('waffle').append(cell)
}
for (let i = 1; i <= 5; i++) {
  const row = document.createElement('div')
  const dash = ['', '6 4', '2 3', '10 3 2 3', '1 4'][i - 1]
  const marker = [
    '<circle cx="35" cy="6" r="4"/>',
    '<rect x="31" y="2" width="8" height="8"/>',
    '<path d="M35 1L40 6L35 11L30 6Z"/>',
    '<path d="M35 1L40 10H30Z"/>',
    '<circle cx="35" cy="6" r="4" fill="var(--surface)"/>',
  ][i - 1]
  row.className = 'series-row'
  row.innerHTML = `<svg class="line-key" aria-hidden="true" viewBox="0 0 70 12" style="color:var(--cmp-${i})"><path d="M0 6H70" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="${dash}"/><g fill="currentColor" stroke="currentColor">${marker}</g></svg><span>Серия ${i}</span>`
  document.getElementById('series').append(row)
}
for (const group of document.querySelectorAll('.segment')) {
  for (const button of group.querySelectorAll('button'))
    button.addEventListener('click', () => {
      for (const peer of group.querySelectorAll('button'))
        peer.setAttribute('aria-pressed', String(peer === button))
    })
}
const dialog = document.getElementById('dialog')
document.getElementById('open-dialog').addEventListener('click', () => dialog.showModal())
let timer
for (const b of document.querySelectorAll('.ui-button:not(#open-dialog):not(dialog button)')) {
  if (b.disabled || b.getAttribute('aria-disabled') === 'true') continue
  b.addEventListener('click', () => {
    const notice = document.getElementById('notice')
    notice.textContent = 'Образец действия. Данные не изменены.'
    notice.hidden = false
    clearTimeout(timer)
    timer = setTimeout(() => {
      notice.hidden = true
    }, 2500)
  })
}
apply()
console.log('Catalog ready', {
  combinations: Object.keys(palette.themes).length,
  failures: report.failures.length,
})
