import { writeFileSync } from 'node:fs'
import { Scene, fitBox, hull, type IsoFigureData, type IsoNode, type P3 } from '../../apps/next/src/client/overview/iso/scene'
const paint: Record<string, string> = { top: '#403d3a', front: '#363432', side: '#2e2c2a', line: '#a8a098', detail: '#5f5954', glass: '#262423', ghost: '#45403c', ink: '#f1efeb', muted: '#c4beb7', accent: '#ea846f', none: 'none' }
function render(fig: IsoFigureData) {
  let defs = '', seq = 0
  const nodes = (list: readonly IsoNode[]): string => list.map(n => {
    if (n.kind === 'polygon') return `<polygon points="${n.points}" fill="${paint[n.fill]}" stroke="${paint[n.stroke]}" stroke-width="${n.width ?? 1}" stroke-linejoin="round"/>`
    if (n.kind === 'path') return `<path d="${n.d}" fill="${paint[n.fill]}" stroke="${paint[n.stroke]}" stroke-width="${n.width}" stroke-linecap="round" stroke-linejoin="round"/>`
    if (n.kind === 'text') return `<text x="${n.x}" y="${n.y}" transform="${n.transform ?? ''}" font-family="JetBrains Mono" font-size="${n.size}" font-weight="${n.weight}" text-anchor="${n.anchor}" fill="${paint[n.fill]}">${n.text}</text>`
    if (n.kind === 'glow') return nodes(n.children)
    if (n.clip) { const id = `clip${seq++}`; defs += `<clipPath id="${id}"><polygon points="${n.clip}"/></clipPath>`; return `<g data-part="${n.part}" clip-path="url(#${id})">${nodes(n.children)}</g>` }
    return `<g data-part="${n.part}">${nodes(n.children)}</g>`
  }).join('')
  const body = nodes(fig.nodes)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fig.width}" height="160" viewBox="${fig.viewBox.split(' ').slice(0,3).join(' ')} 160"><defs>${defs}</defs>${body}</svg>`
}
function trophy(k: number) {
  const s = new Scene(k), U: P3 = [1,0,0], V: P3 = [0,1,0]
  for (const side of [-1,1]) {
    const pts: P3[] = []
    for(let i=0;i<=36;i++){const t=i/36*Math.PI;pts.push([26+side*(30-8*(i/36)+38*Math.sin(t)),18,102-27*(i/36)])}
    s.line(pts,'line',1);s.line(pts.map(([x,y,z])=>[x-side*3,y,z+1] as P3),'detail',.8)
  }
  s.rbox(0,0,0,52,36,15,3,{top:'top',wall:'front',side:'side'})
  const ring=(r:number,z:number)=>s.circle([26,18,z],U,V,0,0,r,64)
  const cylinder=(r:number,z0:number,z1:number)=>{const a=ring(r,z0),b=ring(r,z1);s.poly2(hull(s.pp([...a,...b])),'front','line');s.poly(b,'top','line')}
  cylinder(11,15,18);cylinder(4.5,18,54);cylinder(8,54,59)
  const levels=[[8,59],[15,64],[24,76],[30,93],[32,110]]
  s.poly2(hull(s.pp(levels.flatMap(([r,z])=>ring(r,z)))),'front','line')
  s.poly2(hull(s.pp(levels.flatMap(([r,z])=>ring(r,z).filter((_,i)=>i<16)))),'side','none')
  s.poly(ring(32,110),'top','line');s.poly(ring(28,110.3),'side','detail');s.line(ring(32,111.5).slice(0,33),'line',1)
  const plaque: P3[]=[[11,36.1,13],[41,36.1,13],[41,36.1,2],[11,36.1,2]]
  s.poly(plaque,'glass','accent')
  s.group('selected-airline-plaque',()=>s.text('PC',[26,36.2,4.2],[1,0,0],[0,0,-1],{size:8,mono:true,weight:500,anchor:'middle',fill:'accent'}),{clip:plaque})
  return s.done(6)
}
function watch(k: number) {
  const s=new Scene(k)
  s.rbox(-16,-85,0,32,58,3,7,{top:'front',wall:'side',side:'side'});s.rbox(-16,27,0,32,58,3,7,{top:'front',wall:'side',side:'side'})
  for(const y of [-64,-54,-44,47,57,67])s.poly(s.circle([0,y,3.1],[1,0,0],[0,1,0],0,0,1.5,12),'side','detail')
  s.rbox(-14,-32,3,28,8,5,2,{top:'top',wall:'front',side:'side'});s.rbox(-14,24,3,28,8,5,2,{top:'top',wall:'front',side:'side'})
  const ring=(r:number,z:number)=>s.circle([0,0,z],[1,0,0],[0,1,0],0,0,r,96)
  s.poly2(hull(s.pp([...ring(35,3),...ring(35,10)])),'side','line');s.poly(ring(35,10),'top','line');s.poly(ring(29,10.1),'front','line');s.poly(ring(25,10.2),'glass','detail')
  const reached=new Set([11,12,13,14,15,16,20])
  s.group('UTC-offset-bezel',()=>{for(let i=0;i<24;i++){const a=(i/24*2*Math.PI)-Math.PI/2;s.line([[30*Math.cos(a),30*Math.sin(a),10.4],[33*Math.cos(a),33*Math.sin(a),10.4]],reached.has(i)?'accent':'line',reached.has(i)?2:1)}})
  s.poly([[-2,-38,10.4],[2,-38,10.4],[0,-35,10.4]],'muted','none')
  s.rbox(33,-5,4,7,10,4,2,{top:'top',wall:'front',side:'side'})
  return s.done(6)
}
function sleepKit(k: number) {
  const s=new Scene(k), U:P3=[1,0,0], V:P3=[0,1,0]
  const ring=(r:number,z:number)=>s.circle([48,4,z],U,V,0,0,r,72)
  const cyl=(r:number,z0:number,z1:number,fill:'front'|'side'|'top')=>{s.poly2(hull(s.pp([...ring(r,z0),...ring(r,z1)])),fill,'line');s.poly(ring(r,z1),'top','line')}
  // One small, unbranded travel bottle: curved body, shoulder and screw cap.
  cyl(16,0,45,'front');s.poly2(hull(s.pp([...ring(16,45),...ring(12,53)])),'top','line');cyl(12,53,58,'side');cyl(15,58,68,'front')
  for(let i=0;i<13;i++){const a=i/12*Math.PI;s.line([[48+14.8*Math.cos(a),4+14.8*Math.sin(a),59],[48+14.8*Math.cos(a),4+14.8*Math.sin(a),66]],'detail',.7)}
  // Front label uses a tangent plane; text is projected and clipped to it.
  const label:P3[]=[[37,19.8,39],[59,19.8,39],[59,19.8,16],[37,19.8,16]]
  s.poly(label,'glass','detail');s.group('bottle-label',()=>{s.text('MELA',[48,20,31],[1,0,0],[0,0,-1],{size:7,fill:'muted',anchor:'middle',weight:500});s.text('TONIN',[48,20,23],[1,0,0],[0,0,-1],{size:7,fill:'muted',anchor:'middle',weight:500})},{clip:label})
  // Strap falls in a loose loop behind the padded mask.
  const strap:P3[]=[];for(let i=0;i<=70;i++){const a=i/70*Math.PI*2;strap.push([-15+58*Math.cos(a),-18+24*Math.sin(a),Math.max(5,18+16*Math.cos(a))])}
  s.line(strap,'line',4);s.line(strap,'side',2.5)
  // Soft eye-mask contour has rounded eye lobes and a lifted nose bridge.
  const outline:P3[]=[];for(let i=0;i<=100;i++){const a=i/100*Math.PI*2;const x=-17+57*Math.cos(a);let z=48+22*Math.sin(a);if(Math.sin(a)<0)z+=11*Math.exp(-Math.pow((x+17)/15,2));outline.push([x,25,z])}
  const back=outline.map(([x,y,z])=>[x,y-7,z+1] as P3)
  s.poly2(hull(s.pp([...back,...outline])),'side','line');s.poly(outline,'front','line')
  const seam=outline.map(([x,y,z])=>[-17+(x+17)*.91,y+.3,48+(z-48)*.83] as P3);s.line(seam,'detail',.8)
  for(const cx of [-42,8]){const fold:P3[]=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI;fold.push([cx+16*Math.cos(a),25.4,49+9*Math.sin(a)])}s.line(fold,'detail',.7)}
  s.line(seam.slice(4,28),'accent',1)
  return s.done(6)
}
for(const [name,build]of [['rankings-trophy-dark',trophy],['crossings-watch-dark',watch],['crossings-sleep-kit-dark',sleepKit]] as const){const k=Math.min(1.8,fitBox(300,160,build));const fig=build(k);if(fig.width>300||fig.height>160)throw Error(`${name} exceeds stage`);const svg=render(fig);if(svg.includes('shadow'))throw Error('Ground shadow forbidden');writeFileSync(`.scratch/sheet-anatomy/figures/${name}.svg`,svg);console.log(name,fig.width,160,k)}
