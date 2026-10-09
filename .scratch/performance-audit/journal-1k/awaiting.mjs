import { readFileSync } from 'node:fs'
const base = 'http://127.0.0.1:8800'
const st = JSON.parse(readFileSync('/tmp/jr1k/state.json', 'utf8'))
const cookie = st.cookies.map(c => `${c.name}=${c.value}`).join('; ')
const csrf = st.cookies.find(c => c.name === 'kuuki_csrf').value
const owner = JSON.parse(readFileSync('/tmp/jr1k/me.json', 'utf8')).user.id
const headers = { Cookie: cookie, Origin: base, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }
const j = await (await fetch(`${base}/api/flights/journal?owner=${owner}`, { headers })).json()
const up = j.flights.filter(f => f.lifecycle_state === 'upcoming').slice(0, 8)
const days = ['2026-10-08', '2026-10-07', '2026-10-06']
for (const [i, f] of up.entries()) {
  const r = await fetch(`${base}/api/flights/${f.id}`, { method: 'PATCH', headers, body: JSON.stringify({ date: days[i % 3], timezone: 'UTC' }) })
  console.log(f.id, r.status, r.ok ? '' : await r.text())
}
const k = await (await fetch(`${base}/api/flights/journal?owner=${owner}`, { headers })).json()
const c = {}; for (const f of k.flights) c[f.lifecycle_state] = (c[f.lifecycle_state] || 0) + 1
console.log(c, k.flights.length)
