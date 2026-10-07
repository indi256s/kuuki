const T = {
  light: { ink:'#302D2A', mut:'#66605B', card:'#FFFFFF', inset:'#F2F0ED', shu:'#C23417', ghost:'#E7E3DE', ghostShape:'#CFC9C2',
    airbus:'#0F6390', boeing:'#16A384', embraer:'#8C6D08', atr:'#9A52CF',
    cardStyle:'background-color:#FFFFFF;border:1px solid #DEDAD5;border-radius:14px;' },
  dark: { ink:'#F1EFEB', mut:'#C4BEB7', card:'#353331', inset:'#403D3A', shu:'#EA846F', ghost:'#403D3A', ghostShape:'#5A5652',
    airbus:'#0685B6', boeing:'#04AC7B', embraer:'#A4770F', atr:'#A36FFA',
    cardStyle:'background-color:#353331;border-radius:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);' },
};
const F = `font-family:'Commissioner',system-ui,sans-serif;`;
const M = `font-family:'JetBrains Mono',system-ui,sans-serif;`;
const txt = (s, st) => `<div style="${st}">${s}</div>`;
export function shape(kind, color, size=12, ghost=false){
  const s=size;
  if(kind==='airbus') return `<svg width="${s}" height="${s}" viewBox="0 0 12 12" style="flex-shrink:0"><rect x="0" y="0" width="12" height="12" rx="3" fill="${color}"/></svg>`;
  if(kind==='boeing') return `<svg width="${s}" height="${s}" viewBox="0 0 12 12" style="flex-shrink:0"><circle cx="6" cy="6" r="6" fill="${color}"/></svg>`;
  if(kind==='embraer') return `<svg width="${s}" height="${s}" viewBox="0 0 12 12" style="flex-shrink:0"><path d="M6 0.6 L11.4 6 L6 11.4 L0.6 6 Z" fill="${color}" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  if(kind==='atr') return `<svg width="${s}" height="${s}" viewBox="0 0 12 12" style="flex-shrink:0"><circle cx="6" cy="6" r="4.9" fill="none" stroke="${color}" stroke-width="2.2"/></svg>`;
}
export function shell(theme, extra=''){ const t=T[theme];
  return `<div layer-name="Fleet card" style="${t.cardStyle}box-sizing:border-box;display:flex;flex-direction:column;flex-shrink:0;gap:12px;padding:16px 20px 20px 20px;width:592px;${extra}"></div>`; }
export function header(theme){ const t=T[theme];
  return `<div layer-name="Header" style="display:flex;align-items:center;align-self:stretch;height:36px;flex-shrink:0">${txt('Fleet',`${F}font-size:18px;font-weight:600;letter-spacing:-0.01em;line-height:24px;color:${t.ink}`)}</div>`; }
export function headline(theme, o){ const t=T[theme];
  return `<div layer-name="Headline" style="display:flex;flex-direction:column;align-self:stretch;gap:6px;flex-shrink:0">
<div style="display:flex;align-items:center;gap:16px">
<div layer-name="Type label" style="display:flex;align-items:center;gap:8px">${shape(o.kind,t[o.kind])}${txt(o.type,`${M}font-size:20px;font-weight:600;line-height:28px;color:${t.ink}`)}</div>
<div layer-name="Figure" style="display:flex;align-items:baseline;gap:6px">${txt(o.n,`${F}font-size:44px;font-weight:600;letter-spacing:-0.02em;line-height:48px;font-feature-settings:'tnum';color:${t.ink}`)}${txt('flights',`${F}font-size:15px;line-height:20px;color:${t.mut}`)}</div>
</div>
${txt(o.sub,`${F}font-size:13px;line-height:20px;color:${t.mut}`)}
<div style="padding-top:6px">${txt(o.narr,`${F}font-size:14px;line-height:20px;color:${t.mut}`)}</div>
</div>`; }
const lbl=(t,name,n,w,extra='')=>`<div style="display:flex;align-items:baseline;gap:6px;width:${w}px;flex-shrink:0">${txt(name,`${F}font-size:13px;font-weight:600;line-height:20px;color:${t.ink}`)}${txt(n,`${F}font-size:13px;line-height:20px;font-feature-settings:'tnum';color:${t.ink}`)}</div>`;
// bar
export function bar(theme, o={}){ const t=T[theme]; const only=o.only;
  const surf=t.card;
  const NW=410, WW=136;
  const col=(k)=> (only && k!==only) ? t.ghost : t[k];
  const band=(k,w,radius,isRing)=>{
    if(isRing){ const c=col(k); const ghost=only&&k!==only;
      return `<div style="width:${w}px;height:14px;flex-shrink:0;box-sizing:border-box;border:2px solid ${c};${ghost?`background-color:${t.ghost};border-color:${t.ghost};`:''}border-radius:${radius}"></div>`; }
    return `<div style="width:${w}px;height:14px;flex-shrink:0;background-color:${col(k)};border-radius:${radius}"></div>`; };
  const g=`<div style="width:2px;height:14px;flex-shrink:0;background-color:${surf}"></div>`;
  const narrow=`<div layer-name="Narrowbody segment" style="display:flex;width:${NW}px;height:14px;flex-shrink:0;border-radius:7px 2px 2px 7px;overflow:hidden">${band('airbus',227,'0')}${g}${band('boeing',135,'0')}${g}${band('embraer',25,'0')}${g}${band('atr',17,'0 7px 7px 0',true)}</div>`;
  const wide=`<div layer-name="Widebody segment" style="display:flex;width:${WW}px;height:14px;flex-shrink:0;border-radius:2px 7px 7px 2px;overflow:hidden">${band('airbus',92,'0')}${g}${band('boeing',42,'0')}</div>`;
  const nLbl = only ? lbl(t,'Narrowbody','16 of 48',NW) : lbl(t,'Narrowbody','48',NW);
  const wLbl = only ? lbl(t,'Widebody','5 of 16',WW) : lbl(t,'Widebody','16',WW);
  return `<div layer-name="Body split" style="display:flex;flex-direction:column;align-self:stretch;gap:8px;padding-top:12px;flex-shrink:0">
<div style="display:flex;gap:6px;width:552px">${nLbl}${wLbl}</div>
<div layer-name="Bar" style="display:flex;gap:6px;width:552px;height:14px">${narrow}${wide}</div>
<div style="display:flex;align-items:center;gap:6px;padding-top:2px">${txt('5 flights without aircraft ·',`${F}font-size:12px;line-height:16px;color:${t.mut}`)}${txt('Add aircraft →',`${F}font-size:12px;font-weight:500;line-height:16px;color:${t.shu}`)}</div>
</div>`; }
export function ridge(theme, o={}){ const t=T[theme];
  const head=`<div layer-name="Ridge heading" style="display:flex;flex-direction:column;gap:2px;align-self:stretch;padding-top:12px;flex-shrink:0">${txt('Flight length by type',`${F}font-size:14px;font-weight:600;line-height:20px;color:${t.ink}`)}${txt('Smooth ridge for types with 8+ flights, actual flights as dots below that.',`${F}font-size:12px;line-height:16px;color:${t.mut}`)}</div>`;
  const body = o.placeholder
   ? `<div layer-name="Ridgeline placeholder" style="display:flex;align-items:center;justify-content:center;width:552px;height:120px;flex-shrink:0;background-color:${t.inset};border-radius:12px;padding:0 48px;box-sizing:border-box">${txt('Ridgeline re-renders with Boeing types only (737, 777)',`${F}font-size:13px;line-height:20px;text-align:center;color:${t.mut}`)}</div>`
   : `<div layer-name="Ridgeline image" style="width:552px;height:284px;flex-shrink:0;background-image:url(paper-asset:///tmp/kuuki-live/paper/fleet-ridge-${theme}.png);background-size:100% 100%;background-repeat:no-repeat"></div>`;
  return head+body; }
export function legend(theme, o={}){ const t=T[theme]; const only=o.only;
  const item=(k,name)=>{ const ghost=only&&k!==only; const c=ghost?t.ghostShape:t[k];
    return `<div style="display:flex;align-items:center;gap:8px">${shape(k,c)}${txt(name,`${F}font-size:13px;line-height:20px;color:${ghost?t.mut:t.ink}`)}</div>`; };
  return `<div layer-name="Legend" style="display:flex;align-items:center;gap:16px;align-self:stretch;padding-top:8px;flex-shrink:0">${item('airbus','Airbus')}${item('boeing','Boeing')}${item('embraer','Embraer')}${item('atr','ATR')}</div>`; }
