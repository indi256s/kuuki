import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
const mf = new Miniflare({ modules: true, scriptPath: process.argv[2], compatibilityDate: '2025-09-23' })
const csv = '﻿Date,Airline,Flight,From,To,Canceled,Notes\r\n2026-03-10,BAW,178,JFK,LHR,false,"a\nb"\r\n2026-03-11,BAW,1,JFK,LHR,true,\r\n'
const res = await mf.dispatchFetch('http://x/', { method: 'POST', body: csv })
console.log(res.status, await res.text())
await mf.dispose()
