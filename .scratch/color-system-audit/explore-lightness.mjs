import Color from '/tmp/kuuki-colorjs-0.7.1.mjs'
import { readFile } from 'node:fs/promises'
import { simulate, distance } from './cvd-review.mjs'
const data=JSON.parse(await readFile(new URL('./palette-before-final-review.json',import.meta.url),'utf8'))
const offsets=[-.08,-.04,0,.04,.08]
const kinds=['normal','protan','deutan','tritan']
function paint(L,H,cap,fraction=.58){let low=0,high=.4;for(let i=0;i<24;i++){const c=(low+high)/2;if(new Color('oklch',[L,c,H]).to('srgb').coords.every(v=>v>=0&&v<=1))low=c;else high=c}return new Color('oklch',[L,Math.min(low*fraction,cap),H]).to('srgb').toString({format:'hex'})}
function optimize(name,rows){
 const colors=rows.map(row=>offsets.map(o=>['light','dark'].map(mode=>{
  const color=paint((mode==='light'?.54:.74)+o,row.hue,row.cap??.13,row.fraction??.58)
  return Object.values(data.modes[mode]).slice(0,3).every(bg=>new Color(color).contrast(new Color(bg),'WCAG21')>=3.15)?kinds.map(k=>simulate(color,k)):null
 })))
 const pairs=new Map()
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)for(let a=0;a<5;a++)for(let b=0;b<5;b++){
  const valid=colors[i][a].every(Boolean)&&colors[j][b].every(Boolean)
  const score=valid?Math.min(...[0,1].flatMap(m=>kinds.map((k,t)=>distance(colors[i][a][m][t],colors[j][b][m][t])))):-1
  pairs.set([i,j,a,b].join(','),score)
 }
 let best={score:-1,cost:Infinity}, candidate=[]
 function search(index,score,cost){if(index===rows.length){if(score>best.score+1e-9||Math.abs(score-best.score)<1e-9&&cost<best.cost)best={score,cost,offsets:candidate.map(i=>offsets[i])};return}
  for(let v=0;v<5;v++){let next=score;for(let i=0;i<index;i++)next=Math.min(next,pairs.get([i,index,candidate[i],v].join(',')));if(next<best.score)continue;candidate[index]=v;search(index+1,next,cost+Math.abs(offsets[v]))}}
 search(0,Infinity,0);console.log(JSON.stringify({name,...best}))
}
const hue=color=>new Color(color).to('oklch').coords[2]
optimize('makers',data.makers.light.map(r=>({hue:hue(r.color),...(r.key==='other'?{cap:.022,fraction:.16}:{})})))
optimize('regions',data.regions.light.map(r=>({hue:hue(r.color),...(r.key==='antarctica'?{cap:.035}:{})})))
for(const key of Object.keys(data.accents))optimize(key,[0,85,165,245,300].map(o=>({hue:(hue(data.accents[key].light)+o)%360})))
