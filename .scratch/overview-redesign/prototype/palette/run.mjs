import {mk,mul,P,D,dE,rgb2lab,contrast,lum,lin} from './search.mjs'
const mode=process.argv[2]||'light'
const bgHex=mode==='light'?'#FFFFFF':'#353331'; const bg=lum([1,3,5].map(i=>lin(parseInt(bgHex.slice(i,i+2),16)/255)))
const band=mode==='light'?[0.45,0.75]:[0.50,0.67]
const hues=JSON.parse(process.argv[3]) // [[h,hrange],...]
const opts=hues.map(([h0,dh,l0,l1])=>{const o=[];for(let h=h0-dh;h<=h0+dh;h+=3)for(let L=Math.max(band[0],l0??0);L<=Math.min(band[1],l1??1);L+=0.02)for(let C=0.10;C<=0.20;C+=0.02){const c=mk(L,C,h);if(c&&contrast(c.lin,bg)>=3)o.push(c)}return o})
console.error(opts.map(o=>o.length))
const score=(set)=>{let mn=1e9,nv=1e9;const pairs=[];for(let i=0;i<set.length;i++)for(let j=i+1;j<set.length;j++)pairs.push([i,j])
for(const [i,j] of pairs){const a=set[i],b=set[j];nv=Math.min(nv,dE(rgb2lab(a.lin),rgb2lab(b.lin)));mn=Math.min(mn,dE(rgb2lab(mul(P,a.lin)),rgb2lab(mul(P,b.lin))),dE(rgb2lab(mul(D,a.lin)),rgb2lab(mul(D,b.lin))))}return [mn,nv]}
let best=null
const N=40000
for(let t=0;t<N;t++){const set=opts.map(o=>o[Math.floor(Math.random()*o.length)]);const [mn,nv]=score(set);const chroma=set.reduce((a,c)=>a+c.C,0);const s=Math.min(mn,12)*10+Math.min(nv,30)+chroma*20;if(nv>=15&&(!best||s>best.s))best={s,mn,nv,set}}
console.log(JSON.stringify({mn:best.mn.toFixed(1),nv:best.nv.toFixed(1),set:best.set.map(c=>[c.hex,c.L.toFixed(2),c.C.toFixed(2),c.h])}))
