"""Build a standalone discussion sample; all values are embedded, no app edits."""
import base64
import json
from pathlib import Path

folder = Path(__file__).resolve().parent
root = folder.parent.parent
data = json.loads((folder / "palette-proposal.json").read_text())
matrices = json.loads((folder / "palette-cvd-review.json").read_text())["matrices"]
font = base64.b64encode((root / "apps/next/public/fonts/Commissioner-Regular.woff2").read_bytes()).decode()
html = r'''<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kuuki — предложение цветовой системы</title>
<style>
@font-face{font-family:Commissioner;src:url(data:font/woff2;base64,__FONT__) format('woff2');font-weight:400;font-display:swap}
*{box-sizing:border-box}body{margin:0;background:transparent;font:15px/1.45 Commissioner,var(--font-sans, sans-serif);color:var(--foreground,#302d2a)}
button,input,select{font:inherit}button{cursor:pointer}button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--ring,#4e5ea2);outline-offset:3px}select{max-width:100%;min-height:42px;padding:6px;border:1px solid var(--input,#8c847b);border-radius:8px;background:var(--background,#fbfaf8);color:inherit}
button{border:1px solid var(--input,#8c847b);border-radius:8px;padding:8px 12px;color:inherit;background:transparent;min-height:42px}
button[aria-pressed=true]{border-width:2px;padding:7px 11px}button:hover{text-decoration:underline;text-underline-offset:3px}
p{margin:0 0 14px}.intro{max-width:68ch}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}.accent-pick{display:flex;gap:7px;align-items:center}.dot{width:13px;height:13px;border-radius:50%;display:inline-block}
.options{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:12px 0 18px}.options label{display:flex;align-items:center;gap:7px}input{width:18px;height:18px;accent-color:var(--primary,#4e5ea2)}
.panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.sample{padding:20px;border-radius:14px;background:var(--k-bg);color:var(--k-text);min-width:0}.sample.light{color-scheme:only light}.sample.dark{color-scheme:only dark}
[data-vision=mono] .sample{filter:grayscale(1)}[data-vision=protan] .sample{filter:url(#cvd-protan)}[data-vision=deutan] .sample{filter:url(#cvd-deutan)}[data-vision=tritan] .sample{filter:url(#cvd-tritan)}.sample h2{font-size:21px;font-weight:400;margin:0}.sample h3{font-size:16px;font-weight:400;margin:18px 0 6px}.sample p{color:var(--k-muted);font-size:13px;margin:0 0 8px}.mode-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.mode-head svg{width:32px;height:32px}
.sample button{border-color:var(--k-border);color:var(--k-text)}.sample button:focus-visible{outline-color:var(--k-accent)}.action-row{display:flex;gap:8px;margin-top:16px;align-items:center;flex-wrap:wrap}.sample .primary{background:var(--k-accent);color:var(--k-on);border-color:var(--k-accent)}.text-link{color:var(--k-accent-text);text-decoration:underline;text-underline-offset:3px;font-size:13px}.tint{background:var(--k-tint);color:var(--k-accent-text);padding:8px 10px;border-radius:8px;font-size:13px;margin-top:10px}
.data-row{display:grid;grid-template-columns:92px minmax(0,1fr) 28px;gap:8px;align-items:center;min-height:28px;font-size:13px}.bar{height:9px;background:var(--paint);width:var(--size);border-radius:2px}.value{text-align:right;font-variant-numeric:tabular-nums}.family{display:grid;grid-template-columns:50px minmax(0,1fr) 28px;gap:8px;align-items:center;font-size:12px;min-height:27px}.family .bar{height:5px}.family-note{font-size:12px;color:var(--k-muted);margin-top:5px}
.neutral-row{display:flex;align-items:center;gap:9px;font-size:12px;margin-top:7px}.neutral-mark{width:17px;height:17px;display:grid;place-items:center;font-size:12px;border:1px solid var(--k-border);color:var(--k-text);flex:none}.baseline{width:26px;border-top:2px dashed var(--k-border)}
.comparison{margin-top:8px}.comparison .data-row{grid-template-columns:92px minmax(0,1fr) 25px;font-size:12px}.comparison svg{width:100%;height:25px;overflow:visible}.comparison .value{font-size:12px}.slots{display:flex;gap:8px;margin-bottom:5px}.slots svg{width:calc((100% - 32px)/5);height:22px}
.airline{display:grid;grid-template-columns:32px minmax(0,1fr);gap:8px;align-items:center;font-size:12px}.airline svg{width:100%;height:26px}.heat{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:12px 0 8px}.heat-cell{min-height:39px;border:1px solid var(--k-border);border-radius:5px;display:grid;place-items:center;font-variant-numeric:tabular-nums}.heat-label{font-size:11px;text-align:center;margin-top:3px;color:var(--k-muted)}.scales{font-size:12px;color:var(--k-muted)}.scales div{margin:4px 0}
.states{display:flex;gap:7px;flex-wrap:wrap}.state-target{width:100%;display:flex;align-items:center;gap:10px;position:relative;margin:9px 0}.state-target:hover{outline:2px solid var(--maker);outline-offset:2px}.state-target.pinned{outline:2px solid var(--maker);outline-offset:2px}.state-target:focus-visible{outline:2px solid var(--k-accent);outline-offset:5px}.state-target span{width:20px;height:9px;background:var(--maker);display:inline-block}.chip svg{width:12px;height:12px;display:none;margin-right:5px;vertical-align:middle}.chip[aria-pressed=true] svg{display:inline-block}.state-note{min-height:20px;color:var(--k-muted);font-size:12px}
details{margin-top:20px}summary{cursor:pointer;min-height:40px;display:list-item;padding-top:7px}.measure-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}.measure-table th,.measure-table td{text-align:left;padding:5px 7px;overflow-wrap:anywhere}.measure-table code{font:12px var(--font-mono,monospace)}.foot{font-size:13px;max-width:68ch;margin:17px 0 0}
@media(max-width:590px){.panels{grid-template-columns:minmax(0,1fr)}.sample{padding:18px}.toolbar{gap:6px}.accent-pick{font-size:13px;padding:8px 10px}.measure-table{font-size:11px}}
@media(forced-colors:active){button{border-color:ButtonText}.bar{border:1px solid CanvasText}.heat-cell{border-color:CanvasText}.state-target.pinned{outline-color:Highlight}.state-target:focus-visible{outline-color:Highlight}.baseline{border-color:CanvasText}}
</style>
<body>
<p class="intro">Рекомендую эту уточнённую палитру Kuuki: категории различаются оттенком и светлотой, интенсивность — упорядоченной акцентной шкалой. Пять исходных акцентов сохранены. Данные примеров вымышлены.</p>
<div class="toolbar" role="group" aria-label="Акцент"><!-- buttons --></div>
<div class="options"><label for="vision">Проверка зрения <select id="vision"><option value="normal">Обычный вид</option><option value="protan">Protan · симуляция</option><option value="deutan">Deutan · симуляция</option><option value="tritan">Tritan · приближение</option><option value="mono">Без цвета</option></select></label><button id="sort" type="button" aria-pressed="false">Изменить порядок маршрутов</button></div>
<svg id="filters" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute"><defs></defs></svg>
<main class="panels" aria-label="Сравнение светлой и тёмной палитры"></main>
<details><summary>Значения и измеренный контраст</summary><p class="foot">Ниже — контраст непрозрачных sRGB-значений на фоне образца. Числа внутри heat-ячеек проверены отдельно; слабая заливка различается контуром, числом и легендой. Проверки ещё не охватывают реальные карточки, WebGL и PNG.</p><table class="measure-table"><thead><tr><th scope="col">Роль</th><th scope="col">Светлый / тёмный</th><th scope="col">Контраст к фону</th></tr></thead><tbody id="values"></tbody></table></details>
<p class="foot">CVD — приближённая модель <a href="https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html">Machado</a>, severity 1.0 в linear RGB. Подписи, штрихи и маркеры обязательны даже после коррекции. 366 заданных пар прошли пороги контраста; 40 heat-последовательностей сохранили порядок светлоты. В приложение палитра ещё не внесена.</p>
<script>
const D=__DATA__;
const matrices=__MATRICES__;
document.querySelector('#filters defs').innerHTML=Object.entries(matrices).map(([key,m])=>`<filter id="cvd-${key}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${m.map(row=>[...row,0,0].join(' ')).join(' ')} 0 0 0 1 0"/></filter>`).join('');
let accent='shu', reverse=false;
const svgCheck='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l2.5 2.5L10 3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const routes=[['LHR','LHR → CDG',68,0],['KIX','KIX → NRT',51,1],['JFK','JFK → LHR',43,2],['NRT','NRT → HND',34,3],['CDG','CDG → LHR',22,4]];
const dashes=['','6 3','2 3','10 3 2 3','1 3'];
function slot(key){let hash=2166136261;for(const c of 'routes:'+key)hash=Math.imul(hash^c.charCodeAt(0),16777619);return (hash>>>0)%5}
function marker(slot,x,y,color){const common=`fill="${color}"`;return [ `<circle cx="${x}" cy="${y}" r="3.5" ${common}/>`, `<rect x="${x-3.5}" y="${y-3.5}" width="7" height="7" ${common}/>`, `<path d="M${x} ${y-4}l4 4-4 4-4-4Z" ${common}/>`, `<path d="M${x} ${y-4}l4 7h-8Z" ${common}/>`, `<path d="M${x-4} ${y}h8M${x} ${y-4}v8" stroke="${color}" stroke-width="2"/>` ][slot]}
function line(color,index,width=150){return `<svg viewBox="0 0 ${width} 25" aria-hidden="true"><path d="M4 18L${width/2} 7L${width-4} 13" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dashes[index]}"/>${marker(index,width/2,7,color)}</svg>`}
function ratio(a,b){const lum=h=>{const v=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722};const x=lum(a),y=lum(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)}
function cell(value,t,base){const p=value===0?{color:base.inset,foreground:base.text}:t.heat[Math.min(4,value)-1];return `<div class="heat-cell" style="background:${p.color};color:${p.foreground}" title="${value} перелётов">${value}</div>`}
function render(){
 document.querySelector('.toolbar').innerHTML=Object.entries(D.accents).map(([key,a])=>`<button type="button" class="accent-pick" data-accent="${key}" aria-pressed="${key===accent}"><span class="dot" aria-hidden="true" style="background:${a.light}"></span>${a.name}</button>`).join('');
 document.querySelectorAll('[data-accent]').forEach(b=>b.onclick=()=>{accent=b.dataset.accent;render()});
 document.querySelector('.panels').innerHTML=['light','dark'].map(mode=>{
  const b=D.modes[mode],t=D.themes[mode+':'+accent],makers=D.makers[mode],regions=D.regions[mode];
  const vars=`--k-bg:${b.background};--k-surface:${b.surface};--k-text:${b.text};--k-muted:${b.muted};--k-accent:${t.accent};--k-on:${t.foreground};--k-accent-text:${t.text};--k-tint:${t.tint};--k-border:${t.border};--maker:${makers[0].color}`;
  const bar=(name,value,color)=>`<div class="data-row" data-identity="${name}" data-color="${color}"><span>${name}</span><div class="bar" style="--paint:${color};--size:${value}%"></div><span class="value">${value}</span></div>`;
  return `<section class="sample ${mode}" data-mode="${mode}" style="${vars}">
  <div class="mode-head"><h2>${mode==='light'?'Светлый':'Тёмный'} · ${D.accents[accent].name}</h2><svg viewBox="0 0 32 32" role="img" aria-label="Пример favicon по акценту"><rect x="1" y="1" width="30" height="30" rx="7" fill="${b.surface}"/><text x="4" y="22" font-family="Commissioner" font-size="19" fill="${t.accent}">Ku</text></svg></div>
  <div class="action-row"><button type="button" class="primary">Добавить перелёт</button><span class="text-link">Акцентный текст</span></div><div class="tint">Текст на акцентном tint · отдельная роль</div>
  <h3>Производители</h3><p>Постоянный цвет категории, независимо от акцента.</p>${makers.slice(0,4).map((r,i)=>bar(r.name,[82,64,39,23][i],r.color)).join('')}
  <div class="neutral-row"><span class="neutral-mark" style="background:${makers[4].color}"></span>Other · известные вне основных слотов</div><div class="neutral-row"><span class="neutral-mark">?</span>Unknown · неизвестный производитель</div>
  <h3>Семейства Airbus</h3>${[['A320',74],['A350',42]].map(([name,v])=>`<div class="family"><span>${name}</span><div class="bar" style="--paint:${makers[0].color};--size:${v}%"></div><span class="value">${v}</span></div>`).join('')}<div class="family-note">Семейство — подпись и строка; цвет — Airbus.</div>
  <h3>Регионы</h3><p>Страны наследуют регион в категорийном анализе.</p>${regions.map((r,i)=>bar(r.name,[75,58,18,86,92,35][i],r.color)).join('')}
  <h3>Сравнение маршрутов</h3><p>Пять слотов. Цвет закреплён за ключом; повторения допустимы.</p><div class="slots" aria-label="Все слоты сравнительной палитры">${t.comparison.map((color,i)=>line(color,i,40)).join('')}</div><div class="comparison">${(reverse?[...routes].reverse():routes).map(([key,name,v,pattern])=>{const s=slot(name),color=t.comparison[s];return `<div class="data-row" data-key="${name}" data-color="${color}"><span>${name}</span>${line(color,pattern)}<span class="value">${v}</span></div>`}).join('')}</div>
  <h3>Похожие бренды</h3><p>Цвета TK и EK из справочника, адаптированные к фону.</p>${D.brands[mode].map((r,i)=>`<div class="airline"><abbr title="${r.key==='TK'?'Turkish Airlines':'Emirates'}">${r.key}</abbr>${line(r.color,i)}</div>`).join('')}
  <h3>Дневные перелёты</h3><p>Пять постоянных уровней между годами.</p><div class="heat">${[0,1,2,3,4].map(v=>`<div>${cell(v,t,b)}<div class="heat-label">${v===4?'4+':v}</div></div>`).join('')}</div>
  <div class="scales"><div>Месяцы: 0 · (0;25%] · (25;50%] · (50;75%] · (75;100%]</div><div>База — максимальный месяц всего журнала.</div><div>Посещения: 0 · 1 · 2–3 · 4–9 · 10+</div></div>
  <h3>Ноль, отсутствие, baseline</h3><div class="neutral-row"><span class="neutral-mark">0</span>Известное отсутствие перелётов</div><div class="neutral-row"><span class="neutral-mark">—</span>Нет данных</div><div class="neutral-row"><span class="baseline"></span>Весь журнал · baseline</div>
  <h3>Состояния — пример</h3><p>Наведите или перейдите Tab: цвет Airbus сохраняется.</p><button type="button" class="state-target"><span aria-hidden="true"></span>Airbus · 82</button><div class="states"><button type="button" class="pin" aria-pressed="false">Закрепить подсказку</button><button type="button" class="chip" aria-pressed="false">${svgCheck}Фильтр Airbus</button></div><div class="state-note" aria-live="polite"></div>
  </section>`;
 }).join('');
 document.querySelectorAll('.sample').forEach(panel=>{
  const pin=panel.querySelector('.pin'),chip=panel.querySelector('.chip'),target=panel.querySelector('.state-target'),note=panel.querySelector('.state-note');
  pin.onclick=()=>{const active=pin.getAttribute('aria-pressed')!=='true';pin.setAttribute('aria-pressed',String(active));target.classList.toggle('pinned',active);note.textContent=active?'Подсказка закреплена · Airbus: 82':'Подсказка откреплена';};
  chip.onclick=()=>{const active=chip.getAttribute('aria-pressed')!=='true';chip.setAttribute('aria-pressed',String(active));note.textContent=active?'Пример выбранного фильтра · цвет данных сохраняется':'Пример фильтра снят';};
 });
 const rows=[...D.makers.light.map((r,i)=>[r.name,r.color,D.makers.dark[i].color]),...D.regions.light.map((r,i)=>[r.name,r.color,D.regions.dark[i].color]),['Акцент · заливка',D.themes['light:'+accent].accent,D.themes['dark:'+accent].accent],['Акцент · текст',D.themes['light:'+accent].text,D.themes['dark:'+accent].text]];
 document.querySelector('#values').innerHTML=rows.map(([name,l,d])=>`<tr><th scope="row">${name}</th><td><code>${l} / ${d}</code></td><td>${ratio(l,D.modes.light.background)} / ${ratio(d,D.modes.dark.background)}</td></tr>`).join('');
}
document.querySelector('#vision').onchange=e=>document.body.dataset.vision=e.target.value;
document.querySelector('#sort').onclick=e=>{reverse=!reverse;e.currentTarget.setAttribute('aria-pressed',String(reverse));render()};
render();
const initialVision=document.body.dataset.vision||'normal',vision=document.querySelector('#vision');
for(const type of ['normal','mono','protan','deutan','tritan']){vision.value=type;vision.dispatchEvent(new Event('change'));const f=getComputedStyle(document.querySelector('.sample')).filter;if(type==='normal'?f!=='none':!f.includes(type==='mono'?'grayscale':`cvd-${type}`))throw Error('Missing vision filter: '+type)}
vision.value=initialVision;vision.dispatchEvent(new Event('change'));
const identitySnapshot=()=>JSON.stringify([...document.querySelectorAll('[data-identity]')].map(r=>[r.closest('.sample').dataset.mode,r.dataset.identity,r.querySelector('.bar').style.getPropertyValue('--paint')]));
const identities=identitySnapshot();
for(const key of Object.keys(D.accents)){accent=key;render();if(document.querySelectorAll('.sample').length!==2)throw Error('Missing mode');if(identitySnapshot()!==identities)throw Error('Identity changes with accent')}
const before=Object.fromEntries([...document.querySelectorAll('[data-key]')].map(r=>[r.closest('.sample').dataset.mode+':'+r.dataset.key,r.dataset.color]));
reverse=true;render();for(const r of document.querySelectorAll('[data-key]'))if(before[r.closest('.sample').dataset.mode+':'+r.dataset.key]!==r.dataset.color)throw Error('Color changes with sorting');
accent='shu';reverse=false;render();
for(const panel of document.querySelectorAll('.sample')){const marker=panel.querySelector('.state-target span'),original=getComputedStyle(marker).backgroundColor;panel.querySelector('.pin').click();panel.querySelector('.chip').click();if(!panel.querySelector('.state-target').classList.contains('pinned')||panel.querySelector('.chip').getAttribute('aria-pressed')!=='true'||getComputedStyle(marker).backgroundColor!==original)throw Error('State changes data color');panel.querySelector('.pin').click();panel.querySelector('.chip').click();panel.querySelector('.state-note').textContent=''}
requestAnimationFrame(()=>{const overflow=[...document.querySelectorAll('.sample')].some(p=>p.scrollWidth>p.clientWidth+1);if(overflow||document.documentElement.scrollWidth>innerWidth+1)throw Error('Horizontal overflow');console.log(JSON.stringify({checks:'passed',modes:2,accents:5,identity:'stable',sorting:'stable',width:innerWidth,overflow:false}))});
</script></body></html>'''
html = html.replace("__FONT__", font).replace("__DATA__", json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")).replace("__MATRICES__", json.dumps(matrices))
assert "__FONT__" not in html and "__DATA__" not in html
(folder / "palette-preview.html").write_text(html)
print(json.dumps({"artifact": str(folder / "palette-preview.html"), "bytes": len(html.encode())}))
