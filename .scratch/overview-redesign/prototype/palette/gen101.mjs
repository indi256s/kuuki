import {readFileSync,writeFileSync} from 'fs'
const T={light:{ink:'#302D2A',mut:'#66605B',card:'#FFFFFF',bd:'border:1px solid #DEDAD5;',panel:'#FBFAF8',C:{Airbus:'#0F6390',Boeing:'#16A384',Embraer:'#8C6D08',ATR:'#9A52CF',Unknown:'#978C7F'},lab:'Light · page #FBFAF8'},
dark:{ink:'#F1EFEB',mut:'#C4BEB7',card:'#353331',bd:'box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);',panel:'#292827',C:{Airbus:'#0685B6',Boeing:'#04AC7B',Embraer:'#A4770F',ATR:'#A36FFA',Unknown:'#897E70'},lab:'Dark · page #292827'}}
const chip=(m,c)=>{const s=12;switch(m){
case 'Airbus':return `<div style="width:12px;height:12px;border-radius:2px;background:${c};flex-shrink:0"></div>`
case 'Boeing':return `<div style="width:12px;height:12px;border-radius:6px;background:${c};flex-shrink:0"></div>`
case 'Embraer':return `<svg width="12" height="12" viewBox="0 0 12 12" style="flex-shrink:0"><path d="M6 1L11 6L6 11L1 6Z" fill="${c}" stroke="${c}" stroke-width="1.9" stroke-linejoin="round"/></svg>`
case 'ATR':return `<div style="width:12px;height:12px;border-radius:6px;border:2.5px solid ${c};box-sizing:border-box;flex-shrink:0"></div>`
case 'Unknown':return `<div style="width:12px;height:12px;border-radius:2px;border:1.5px dashed ${c};box-sizing:border-box;flex-shrink:0"></div>`}}
const data=[['Airbus',38],['Boeing',21],['Embraer',3],['ATR',2],['Unknown',5]]
for(const th of ['light','dark']){
const t=T[th]
const w=readFileSync(`w101-${th}.html`,'utf8').trim()
const leg=data.map(([m,n])=>`<div style="display:flex;align-items:center;gap:8px">${chip(m,t.C[m])}<div style="font-family:'Commissioner';font-size:14px;line-height:20px;color:${t.ink}">${m}</div><div style="font-family:'JetBrains Mono';font-size:12px;line-height:16px;color:${t.ink}">${n}</div></div>`).join('')
const html=`<div layer-name="${th==='light'?'Light panel':'Dark panel'}" style="display:flex;flex-direction:column;gap:20px;width:640px;flex-shrink:0;padding:32px;border-radius:20px;background:${t.panel};box-sizing:border-box"><div style="font-family:'JetBrains Mono';font-size:12px;line-height:16px;letter-spacing:0.08em;color:${t.mut}">${t.lab.toUpperCase()}</div><div layer-name="Card" style="display:flex;flex-direction:column;gap:20px;padding:24px;border-radius:16px;background:${t.card};${t.bd}box-sizing:border-box"><div style="display:flex;flex-direction:column;gap:4px"><div style="font-family:'Commissioner';font-weight:600;font-size:18px;line-height:24px;letter-spacing:-0.01em;color:${t.ink}">Fleet</div><div style="font-family:'Commissioner';font-size:13px;line-height:20px;color:${t.mut}">One square, one flight</div></div>${w}<div layer-name="Legend" style="display:flex;flex-wrap:wrap;align-items:center;column-gap:20px;row-gap:8px">${leg}</div></div></div>`
writeFileSync(`s4-${th}.html`,html)
}
