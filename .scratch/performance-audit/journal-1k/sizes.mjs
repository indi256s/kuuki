import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, brotliCompressSync, constants } from 'node:zlib'
const auditDir = process.env.KUUKI_JOURNAL_AUDIT_DIR ?? '/tmp/jr1k'
const base = process.env.KUUKI_JOURNAL_ORIGIN ?? 'http://127.0.0.1:8800'
const st = JSON.parse(readFileSync(`${auditDir}/state.json`, 'utf8'))
const cookie = st.cookies.map(c => `${c.name}=${c.value}`).join('; ')
const owner = JSON.parse(readFileSync(`${auditDir}/me.json`, 'utf8')).user.id
const gz = b => gzipSync(b, { level: 9 }).length
const br = b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length
const out = {}
const apiRes = await fetch(`${base}/api/flights/journal?owner=${owner}`, { headers: { Cookie: cookie, 'Accept-Encoding': 'identity' } })
if (apiRes.status !== 200) throw new Error(`Journal payload read failed: ${apiRes.status}`)
const api = Buffer.from(await apiRes.arrayBuffer())
if (JSON.parse(api).flights.length !== 1000) throw new Error('Journal payload does not contain 1000 flights')
out.api = { status: apiRes.status, contentEncoding: apiRes.headers.get('content-encoding'), raw: api.length, gzip: gz(api), brotli: br(api) }
const res = await fetch(`${base}/journal`, { headers: { Cookie: cookie, 'Accept-Encoding': 'identity' } })
if (res.status !== 200) throw new Error(`Journal document read failed: ${res.status}`)
const html = Buffer.from(await res.arrayBuffer())
out.html = { status: res.status, contentEncoding: res.headers.get('content-encoding'), raw: html.length, gzip: gz(html), brotli: br(html) }
const text = html.toString('utf8')
// RSC flight chunks: self.__next_f.push([1,"..."])
const re = /<script>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g
let m, chunks = [], rscRaw = 0
while ((m = re.exec(text))) { try { const a = JSON.parse(m[1]); if (typeof a[1] === 'string') chunks.push(a[1]); rscRaw += m[0].length } catch {} }
const flight = chunks.join('')
out.rsc = { scriptBytes: rscRaw, decodedBytes: Buffer.byteLength(flight), chunks: chunks.length }
// the chunk(s) that carry the journal payload: those containing flight rows
const heavy = chunks.filter(c => c.includes('lifecycle_state') || c.includes('"firsts"'))
const hb = Buffer.from(heavy.join(''))
out.journalInRsc = { chunks: heavy.length, decodedBytes: hb.length, gzip: gz(hb), brotli: br(hb) }
// html without flight data
const stripped = Buffer.from(text.replace(re, ''))
out.htmlWithoutFlightScripts = { raw: stripped.length, gzip: gz(stripped) }
// raw script-tag bytes carrying the journal payload (as transmitted in the HTML)
let journalScriptBytes = 0
re.lastIndex = 0
while ((m = re.exec(text))) { if (m[0].includes('lifecycle_state')) journalScriptBytes += Buffer.byteLength(m[0]) }
out.journalScriptTagBytesInHtml = journalScriptBytes
console.log(JSON.stringify(out, null, 1))
writeFileSync(`${auditDir}/sizes.json`, JSON.stringify(out, null, 1))
