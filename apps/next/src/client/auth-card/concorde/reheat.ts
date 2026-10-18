import { burst, glLayer, settle } from './gl.generated.js'
import type { TurnController } from './turn.generated.js'

/** The reheat geometry the generator writes (`CONCORDE.reheat`): rest-world points in the `model` group, millimetres. */
export type Reheat = {
  view: number[]
  camera: { origin: number[]; k: number; cam: number[] }
  /** Nozzle exit centres; the first pair belongs to `proxies[0]`, the second to `proxies[1]`. */
  exits: number[][]
  axis: number[]
  plume: number[]
  proxies: string[]
  /** The nozzle opening's radius and the drawn flame's length. */
  r: number
  len: number
}

export type ReheatLayer = {
  /** Advances the burn by `dt` seconds; `turning` says the model is under way. True while the flame shows. */
  step(dt: number, turning: boolean): boolean
  /** Draws the flame for the controller's current pose. */
  paint(): void
  /** Puts the flame out at once (off screen, hidden tab, reduced motion). */
  reset(): void
  destroy(): void
}

/** The aft axis's facing toward the viewer at which reheat lights: side-on, as the tail starts to swing round. */
const ON = -0.3
/** Seconds of reheat per lap: about 50° of the 12°/s turn. */
const HOLD = 4.2
const POLYS = 8
const EDGES = 10

// Energy along each pixel's ray from four flames, in closed form: the aft axis is level and the camera looks down 30°,
// so every ray crosses a flame at 30° or more and a Gaussian tube integrates to σ·√π / sin θ. Each flame has a pale
// core that fills the opening, an orange body that widens and fades, and a train of puffs that drift aft and break up
// (the reference's afterburner), plus a wide glow that only the dark panel shows. Flames are masked by the parts drawn
// after their nacelle's proxy (bit 1: the first pair, bit 2: the second).
const fragment = (data: Reheat) => `
uniform vec3 uExit[4];
uniform vec3 uAxis;
uniform float uLit;
uniform float uFlash;
uniform float uLight;
uniform vec3 uCover[${POLYS * EDGES}];
uniform float uCoverInfo[${POLYS}];
const float R=${data.r.toFixed(3)};
const float LEN=${data.len.toFixed(3)};
const float SP=${(2.6 * data.r).toFixed(3)};
const float FLOW=${(1.1 * data.len).toFixed(3)};
vec2 covers(vec2 vb,float soft){
  vec2 c=vec2(0.);
  for(int p=0;p<${POLYS};p++){
    float info=uCoverInfo[p];
    float n=mod(info,16.);
    if(n<.5)continue;
    float inside=-1e4;
    for(int e=0;e<${EDGES};e++){if(float(e)>=n)break;vec3 h=uCover[p*${EDGES}+e];inside=max(inside,h.x*vb.x+h.y*vb.y+h.z);}
    float bits=floor(info/16.+.01);
    c=max(c,(1.-smoothstep(-soft,soft,inside))*vec2(mod(bits,2.),step(1.5,bits)));
  }
  return c;
}
vec3 flame(vec3 p0,vec3 V,vec3 E,float id){
  vec3 A=uAxis;
  float b=dot(V,A);
  float den=1.-b*b;
  vec3 w=p0-E;
  float d=dot(V,w);
  float e=dot(A,w);
  float s=(e-b*d)/den;
  vec3 gap=w+((b*e-d)/den)*V-s*A;
  float D2=dot(gap,gap);
  float reach=LEN*(.3+.7*uLit);
  if(s<-8.*R||s>reach+8.*R||D2>100.*R*R)return vec3(0.);
  float chord=1.772/sqrt(den);
  float u=s/reach;
  float start=smoothstep(0.,.45*R,s);
  float flicker=.86+.14*noise2(vec2(uTime*7.3,id*5.1));
  float sc=R*mix(.8,.3,smoothstep(0.,.3,u));
  float core=exp(-D2/(sc*sc))*(sc/R)*chord*start*(1.-smoothstep(.12,.36,u));
  float sb=R*(1.15+.8*smoothstep(0.,1.,u));
  float body=exp(-D2/(sb*sb))*(sb/R)*chord*start*(1.-smoothstep(.18,.64,u));
  float sg=3.2*R;
  float glow=exp(-D2/(sg*sg))*(sg/R)*chord*start*(1.-smoothstep(.15,.9,u));
  vec3 side=normalize(vec3(A.y,-A.x,0.));
  float flow=uTime*FLOW;
  float k=floor((s-flow)/SP);
  float puffs=0.;
  for(int j=-3;j<=3;j++){
    float cell=k+float(j);
    float h=hash12(vec2(cell,id*7.31));
    float g=hash12(vec2(id*3.7,cell*1.13));
    float q=hash12(vec2(cell*.71,id+4.2));
    float sk=(cell+.5+.55*(h-.5))*SP+flow;
    float uk=sk/reach;
    float rk=R*(.85+.9*smoothstep(.1,1.,uk))*(.75+.5*g);
    vec3 c=E+sk*A+side*(g-.5)*.8*R+vec3(0.,0.,(q-.5)*.6*R)-p0;
    float along=dot(c,V);
    float life=smoothstep(.1,.38,uk)*(1.-smoothstep(.55,.92,uk))*smoothstep(.04,.3,q);
    puffs+=exp(-(dot(c,c)-along*along)/(rk*rk))*(rk/R)*1.772*life*(.35+.9*h*q);
  }
  vec3 pop=E+.9*R*A-p0;
  float popAlong=dot(pop,V);
  float flash=uFlash*exp(-(dot(pop,pop)-popAlong*popAlong)/(2.6*R*R))*2.4;
  return vec3(core*1.5*flicker+flash,(body*flicker+puffs)*.9,glow*.045);
}
vec4 inkFor(vec3 seen,float cover){vec3 absorbed=1.-seen;float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);return vec4(vec3(a)-absorbed,a);}
void main(){
  if(uLit<.001&&uFlash<.001){gl_FragColor=vec4(0.);return;}
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 p0=rayOf(vb);
  vec3 a=flame(p0,V,uExit[0],0.)+flame(p0,V,uExit[1],1.);
  vec3 b=flame(p0,V,uExit[2],2.)+flame(p0,V,uExit[3],3.);
  if(max(a.x+a.y+a.z,b.x+b.y+b.z)<1e-4){gl_FragColor=vec4(0.);return;}
  vec2 c=covers(vb,.7*uView.x/uCanvas.x);
  vec3 en=a*(1.-c.x)+b*(1.-c.y);
  float lit=smoothstep(0.,1.,uLit);
  vec3 dark=1.-exp(-(vec3(1.,.84,.6)*en.x+vec3(1.,.34,.07)*2.1*en.y+vec3(1.,.45,.15)*en.z)*mix(.6,1.,lit)*lit);
  dark+=(1.-exp(-vec3(1.,.9,.75)*uFlash*en.x))*(1.-lit);
  vec4 ink=vec4(dark,max(dark.r,max(dark.g,dark.b)));
  // On paper: a pale amber rim, a saturated orange body, then yellow and a cream core where the gas is hottest.
  float heat=en.x+en.y;
  float e=1.-exp(-.75*heat);
  float hot=en.x/(heat+1e-4);
  vec3 seen=mix(vec3(1.),vec3(1.,.86,.66),smoothstep(0.,.2,e));
  seen=mix(seen,vec3(.96,.45,.08),smoothstep(.14,.62,e));
  float core=smoothstep(.42,.85,e)*smoothstep(.2,.6,hot);
  seen=mix(seen,vec3(1.,.72,.16),smoothstep(0.,.55,core));
  seen=mix(seen,vec3(1.,.95,.76),smoothstep(.55,1.,core));
  vec4 paper=inkFor(seen,.9*smoothstep(.45,1.,core))*max(lit,uFlash);
  vec4 col=mix(ink,paper,uLight);
  // A guard, never reached by the drawn flame: ink is zero within 6 device px of the canvas edge.
  vec2 rim=min(gl_FragCoord.xy,uCanvas-gl_FragCoord.xy);
  col*=smoothstep(6.,18.,min(rim.x,rim.y));
  col.rgb=min(col.rgb,vec3(col.a));
  float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  gl_FragColor=max(col+n*smoothstep(0.,1.5/255.,col.a),0.);
}`

/**
 * The sign-in Concorde's afterburner: once a lap, as the tail swings toward the viewer, reheat lights with a short pop,
 * burns for HOLD seconds and spools down. A WebGL canvas over the live model draws it; parts the painter's order puts in
 * front of a nacelle's clear proxy mask its flames. Null without WebGL, where the nozzles keep their SVG glow.
 */
export function mountReheat(
  stage: HTMLElement,
  controller: TurnController,
  data: Reheat,
): ReheatLayer | null {
  const canvas = stage.querySelector<HTMLCanvasElement>('.cn-reheat')
  if (typeof WebGLRenderingContext === 'undefined' || !canvas || data.plume.join() !== '0,0,1,1')
    return null
  const make = () => {
    const made = glLayer({
      canvas,
      fragment: fragment(data),
      view: data.view,
      camera: data.camera,
      uniforms: ['uExit', 'uAxis', 'uLit', 'uFlash', 'uLight', 'uCover', 'uCoverInfo'],
    })
    return made && made.gl.getParameter(made.gl.MAX_FRAGMENT_UNIFORM_VECTORS) >= 128 ? made : null
  }
  let layer = make()
  if (!layer) return null
  stage.setAttribute('data-gl', '')
  const exits = new Float32Array(12)
  const edges = new Float32Array(POLYS * EDGES * 3)
  const info = new Float32Array(POLYS)
  const lit = { x: 0, v: 0 }
  let flash = 0
  let age = Infinity
  let burning = false
  let previous: number | null = null
  let drawn = false
  let warmth = ''
  const facing = () => {
    const direction = controller.anchor('model', data.exits[0]!, data.axis).direction!
    const V = controller.cams().world.V
    return direction[0] * V[0] + direction[1] * V[1] + direction[2] * V[2]
  }
  // Each nacelle's covers, merged into one list with an owner bit per pair. The other pair's proxy draws nothing, so it
  // hides nothing.
  const pack = () => {
    edges.fill(0)
    info.fill(0)
    const names: string[] = []
    data.proxies.forEach((proxy, bit) => {
      const cover = controller.cover(proxy, { polygons: 6, edges: EDGES })
      cover.parts.forEach((name, slot) => {
        if (data.proxies.includes(name)) return
        let at = names.indexOf(name)
        if (at < 0) {
          if (names.length >= POLYS) return
          at = names.push(name) - 1
          edges.set(
            cover.uCoverEdge.subarray(slot * EDGES * 3, (slot + 1) * EDGES * 3),
            at * EDGES * 3,
          )
          info[at] = cover.uCoverCount[slot]!
        }
        info[at] = (info[at] ?? 0) + 16 * (1 << bit)
      })
    })
  }
  const warm = (value: number) => {
    const next = value < 0.001 ? '' : value.toFixed(2)
    if (next === warmth) return
    warmth = next
    if (next) stage.style.setProperty('--cn-reheat', next)
    else stage.style.removeProperty('--cn-reheat')
  }
  const out = () => {
    if (drawn) layer?.clear()
    drawn = false
    warm(0)
  }
  const reset = () => {
    lit.x = lit.v = flash = 0
    age = Infinity
    burning = false
    previous = null
    out()
  }
  // A lost context (a GPU reset) puts the flame out, nozzle warmth included; once the browser restores it, the layer is
  // rebuilt on the same canvas.
  const lost = (event: Event) => {
    event.preventDefault()
    reset()
    layer = null
    stage.removeAttribute('data-gl')
  }
  const restored = () => {
    layer = make()
    if (layer) stage.setAttribute('data-gl', '')
  }
  canvas.addEventListener('webglcontextlost', lost)
  canvas.addEventListener('webglcontextrestored', restored)
  return {
    step(dt, turning) {
      if (!layer) return false
      age += dt
      const now = facing()
      if (turning && previous !== null && previous < ON && now >= ON) {
        age = 0
        burning = true
      }
      previous = now
      if (burning && (age > HOLD || !turning)) burning = false
      settle(lit, burning ? 1 : 0, dt, burning ? 0.12 : 0.35)
      flash = burst(age, 0.06, 0.16)
      return lit.x > 1e-3 || flash > 1e-3
    },
    paint() {
      if (!layer || (lit.x < 1e-3 && flash < 1e-3)) return out()
      data.exits.forEach((point, i) => exits.set(controller.anchor('model', point).world, i * 3))
      pack()
      const light = stage.closest('[data-theme]')?.getAttribute('data-theme') === 'dark' ? 0 : 1
      layer.draw(
        {
          uExit: exits,
          uAxis: controller.anchor('model', data.exits[0]!, data.axis).direction!,
          uLit: Math.max(0, Math.min(1, lit.x)),
          uFlash: flash,
          uLight: light,
          uCover: edges,
          uCoverInfo: info,
        },
        // The burn's own clock: the puffs start at the nozzle each time reheat lights.
        Math.min(age, 60),
      )
      drawn = true
      warm(Math.max(0, Math.min(1, lit.x)))
    },
    reset,
    destroy() {
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      reset()
      stage.removeAttribute('data-gl')
    },
  }
}
