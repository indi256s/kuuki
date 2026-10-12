import Color from '/tmp/kuuki-colorjs-0.7.1.mjs'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// Machado et al. author supplement, severity 1.0; apply to linear RGB.
export const matrices = {
  protan: [[.152286,1.052583,-.204868],[.114503,.786281,.099216],[-.003882,-.048116,1.051998]],
  deutan: [[.367322,.860646,-.227968],[.280085,.672501,.047413],[-.011820,.042940,.968881]],
  tritan: [[1.255528,-.076749,-.178779],[-.078411,.930809,.147602],[.004733,.691367,.303900]],
}
export function simulate(value, type) {
  if (type === 'normal') return value
  const rgb = new Color(value).to('srgb-linear').coords
  const transformed = matrices[type].map(row => Math.max(0, Math.min(1, row.reduce((sum, v, i) => sum + v * rgb[i], 0))))
  return new Color('srgb-linear', transformed).to('srgb').toString({format:'hex'})
}
export function distance(a,b) {
  const x = new Color(a).to('oklab').coords, y = new Color(b).to('oklab').coords
  return 100 * Math.hypot(...x.map((v,i) => v-y[i]))
}
export function review(data) {
  const rows=[]
  for (const mode of ['light','dark']) {
    const sets = { makers: data.makers[mode], regions:data.regions[mode], ...Object.fromEntries(Object.keys(data.accents).map(a=>['comparison:'+a,data.themes[mode+':'+a].comparison.map((color,i)=>({key:String(i),color}))])) }
    for (const [set,colors] of Object.entries(sets)) for (const type of ['normal',...Object.keys(matrices)]) {
      const pairs=[]
      for (let i=0;i<colors.length;i++) for(let j=i+1;j<colors.length;j++) pairs.push({a:colors[i].key,b:colors[j].key,distance:+distance(simulate(colors[i].color,type),simulate(colors[j].color,type)).toFixed(3)})
      pairs.sort((a,b)=>a.distance-b.distance)
      rows.push({mode,set,type,closest:pairs[0],pairs})
    }
  }
  return rows
}
for(const type of Object.keys(matrices)) {
  assert(new Color(simulate('#000000',type)).to('srgb').coords.every(v=>v===0))
  assert(new Color(simulate('#ffffff',type)).to('srgb').coords.every(v=>v===1))
  const gray=new Color(simulate('#808080',type)).to('srgb').coords
  assert(Math.max(...gray)-Math.min(...gray)<.005)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data=JSON.parse(await readFile(new URL('./palette-proposal.json',import.meta.url),'utf8'))
  const before=JSON.parse(await readFile(new URL('./palette-before-final-review.json',import.meta.url),'utf8'))
  const rows=review(data), previous=review(before)
  const summary=[...new Set(rows.map(r=>r.set))].map(set=>({set,before:Math.min(...previous.filter(r=>r.set===set&&r.type!=='normal').map(r=>r.closest.distance)),after:Math.min(...rows.filter(r=>r.set===set&&r.type!=='normal').map(r=>r.closest.distance))}))
  assert(summary.every(r=>r.after>r.before))
  let heatChecks=0
  for (const [key,t] of Object.entries(data.themes)) for (const type of ['normal',...Object.keys(matrices)]) {
    const mode=key.split(':')[0]
    const levels=[data.modes[mode].inset,...t.heat.map(r=>r.color)].map(c=>new Color(simulate(c,type)).to('oklab').coords[0])
    assert(levels.every((L,i)=>i===0||(mode==='light'?L<levels[i-1]:L>levels[i-1])),`${key}/${type}: unordered heat`)
    heatChecks++
  }
  const report={model:'Machado 2009, author matrices at severity 1.0; linear RGB, channel clipping, rounded sRGB output',matrices,sources:['https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html','https://search.r-project.org/CRAN/refmans/colorspace/html/simulate_cvd.html'],metric:'Euclidean OKLab distance ×100, relative design comparison only; no accessibility pass threshold',limitations:'Tritan is the published approximation; simulations do not predict each person’s perception. Labels/patterns remain necessary.',summary,heatChecks,rows}
  await writeFile(new URL('./palette-cvd-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({summary,heatChecks}))
}
