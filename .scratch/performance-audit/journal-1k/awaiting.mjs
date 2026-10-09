import { readFileSync } from 'node:fs'
const auditDir = process.env.KUUKI_JOURNAL_AUDIT_DIR ?? '/tmp/jr1k'
const base = process.env.KUUKI_JOURNAL_ORIGIN ?? 'http://127.0.0.1:8800'
const st = JSON.parse(readFileSync(`${auditDir}/state.json`, 'utf8'))
const cookie = st.cookies.map(c => `${c.name}=${c.value}`).join('; ')
const csrf = st.cookies.find(c => c.name === 'kuuki_csrf').value
const owner = JSON.parse(readFileSync(`${auditDir}/me.json`, 'utf8')).user.id
const headers = { Cookie: cookie, Origin: base, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }
const j = await (await fetch(`${base}/api/flights/journal?owner=${owner}`, { headers })).json()
const up = j.flights.filter(f => f.lifecycle_state === 'upcoming').slice(0, 8)
if (j.flights.length !== 1000 || up.length !== 8) throw new Error('Synthetic fixture is incomplete')
const days = ['2026-10-08', '2026-10-07', '2026-10-06']
for (const [i, f] of up.entries()) {
  const r = await fetch(`${base}/api/flights/${f.id}`, { method: 'PATCH', headers, body: JSON.stringify({ date: days[i % 3], timezone: 'UTC' }) })
  if (!r.ok) throw new Error(`Awaiting conversion failed: ${r.status}`)
}
const k = await (await fetch(`${base}/api/flights/journal?owner=${owner}`, { headers })).json()
const c = {}; for (const f of k.flights) c[f.lifecycle_state] = (c[f.lifecycle_state] || 0) + 1
if (k.flights.length !== 1000 || c.upcoming !== 7 || c.awaiting !== 8) throw new Error('Synthetic lifecycle counts differ')
console.log(JSON.stringify({ states: c, total: k.flights.length }))
