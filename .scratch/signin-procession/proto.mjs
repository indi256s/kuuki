// Moving prototype of the sign-in procession: the built auth card (auth-card.css values) with the new brand panel.
// Run from the repo root after build.mjs is in place: node .scratch/signin-procession/proto.mjs -> index.html
import { readFileSync, writeFileSync } from 'node:fs';
import { layouts, STILL, HOP, classify, LABEL, FLASH, r1 } from './build.mjs';

const file = (p) => new URL(p, import.meta.url);
const b64 = (p) => readFileSync(file(p)).toString('base64');
const fontFace = (weight, name) =>
  `@font-face{font-family:Commissioner;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64(`../../apps/next/public/fonts/Commissioner-${name}.woff2`)}) format('woff2')}`;

const PAD = 10; // room for the glow blur around each plane

// One keyframe track per plane, in loop time: parked at its entry, across the panel at constant speed, then a fast
// hop back to the entry along the off-panel route from build.mjs. Every keyframe is linear: WebKit will not run
// stepped keyframes on the compositor. `map` turns a plane position into the translate of whichever layer uses it.
function track(L, g, map) {
  const P = L.period;
  // Waypoints for one cycle, timed from the leg's start.
  const back = g.dur + (g.hop.length + 1) * HOP;
  const way = [[0, g.from], [g.dur, g.to], ...g.hop.map((pt, i) => [g.dur + (i + 1) * HOP, pt]), [back, g.from], [P, g.from]];
  const pos = (dt) => {
    const i = way.findIndex(([t]) => t >= dt);
    if (i <= 0) return way[0][1];
    const [t0, a] = way[i - 1], [t1, b] = way[i], f = (dt - t0) / (t1 - t0);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const times = [0, P, ...way.map(([t]) => (g.start + t) % P)];
  const keys = new Map();
  for (const t of times.sort((a, b) => a - b)) keys.set(Math.round((t / P) * 1e5) / 1e3, pos((((t - g.start) % P) + P) % P));
  return [...keys].map(([pct, [x, y]]) => {
    const [tx, ty] = map(x, y);
    return `${pct}%{transform:translate(${r1(tx)}px,${r1(ty)}px)}`;
  }).join('');
}

function stage(L) {
  const id = L.name[0]; // d | m
  let css = '', shadows = '', pools = '', planes = '';
  L.legs.forEach((g, i) => {
    const p = g.plane;
    const v = { x: p.bbox.x0 - PAD, y: p.bbox.y0 - PAD, w: Math.ceil(p.bbox.x1 - p.bbox.x0 + 2 * PAD), h: Math.ceil(p.bbox.y1 - p.bbox.y0 + 2 * PAD) };
    const sv = { x: p.shadowBox.x0 - 2, y: p.shadowBox.y0 - 2, w: Math.ceil(p.shadowBox.x1 - p.shadowBox.x0 + 4), h: Math.ceil(p.shadowBox.y1 - p.shadowBox.y0 + 4) };
    const name = `fl-${id}${i}`;
    css += `@keyframes ${name}{${track(L, g, (x, y) => [x + v.x, y + v.y])}}`;
    css += `@keyframes ${name}-inv{${track(L, g, (x, y) => [-(x + v.x), -(y + v.y)])}}`;
    const anim = `animation-name:${name}`;
    // Every track rides an HTML box: Chrome runs transforms on SVG elements on the main thread once the device scale
    // folds into zoom (any Retina screen or phone), and on HTML boxes it composites them.
    // Shadow: same track, offset to where the flattened plane lies on the ground.
    shadows += `<div class="sh anim" style="${anim};left:${r1(sv.x - v.x)}px;top:${r1(sv.y + L.alt - v.y)}px;width:${sv.w}px;height:${sv.h}px"><svg width="${sv.w}" height="${sv.h}" viewBox="${r1(sv.x)} ${r1(sv.y)} ${sv.w} ${sv.h}"><g>${p.shadow}</g></svg></div>`;
    // Night light pool: a soft disc under the plane that shows only the kana inside it. The disc rides the plane's track
    // and the kana copy inside it rides the inverse, so the letters stay put while the light moves over them.
    const r = g.poolR, ox = g.ground[0] - r - v.x, oy = g.ground[1] - r - v.y;
    pools += `<div class="pool anim" style="${anim};left:${r1(ox)}px;top:${r1(oy)}px;width:${r1(2 * r)}px;height:${r1(2 * r)}px"><div class="auth-watermark anim" style="animation-name:${name}-inv;translate:${r1(-ox)}px ${r1(-oy)}px">${KANA}</div></div>`;
    // Plane: the body, then each light in its own small svg on top (the glow filters live in the body's defs).
    const hh = p.lightHalf;
    const lights = p.lights.map((l) => `<svg class="lt lt-${l.kind}" style="left:${r1(l.cx - hh - v.x)}px;top:${r1(l.cy - hh - v.y)}px" width="${2 * hh}" height="${2 * hh}" viewBox="${r1(l.cx - hh)} ${r1(l.cy - hh)} ${2 * hh} ${2 * hh}">${classify(l.markup)}</svg>`).join('');
    planes += `<div class="pl anim" data-rep="${g.rep}"${FLASH[g.rep] ? ` data-flash="${FLASH[g.rep]}"` : ''} style="${anim};--i:${i};width:${v.w}px;height:${v.h}px"><svg width="${v.w}" height="${v.h}" viewBox="${r1(v.x)} ${r1(v.y)} ${v.w} ${v.h}"><defs>${p.defs}</defs>${classify(p.body)}</svg>${lights}</div>`;
  });
  css += `.stage-${id} .anim{animation-duration:${r1(L.period * 1000) / 1000}s;animation-delay:-${r1(STILL[L.name] * 1000) / 1000}s}`;
  // Mobile: the field scale per band height. Each rule covers the 20px below the previous one's floor.
  if (L.scales) for (let j = L.scales.length - 2; j >= 0; j--) css += `@container fleet (height < ${L.scales[j + 1][0]}px){.stage-m{--s:${L.scales[j][1]}}}`;
  const html = `<div class="stage stage-${id}" data-period="${L.period}" data-still="${STILL[L.name]}"><div class="auth-watermark">${KANA}</div>${shadows}${pools}${planes}</div>`;
  return { css, html };
}
const KANA = '<span>く</span><span>う</span><span>き</span>';

const D = stage(layouts.desktop), M = stage(layouts.mobile);
const k = { d: layouts.desktop.k, m: layouts.mobile.k };
// Scale bar along the flight direction, climbing to the right (the iso axes keep 1 m = k px on screen), end ticks on
// the vertical axis.
const scaleBar = (kk) => {
  const dx = r1(10 * kk * Math.cos(Math.PI / 6)), dy = r1(10 * kk * 0.5);
  return `<svg width="${Math.ceil(dx + 2)}" height="${Math.ceil(dy + 8)}" viewBox="-1 -4 ${Math.ceil(dx + 2)} ${Math.ceil(dy + 8)}" aria-hidden="true"><path d="M0 ${dy}L${dx} 0M0 ${r1(dy - 3.5)}V${r1(dy + 3.5)}M${dx} -3.5V3.5" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`;
};
const icon = (body, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
};
// Horizon theme toggle paths (toggles.dev "Horizon", MIT, as in horizon-toggle.tsx).
const HORIZON_LINE = 'M30.7 29.9H1.3c-.7 0-1.3.5-1.3 1.1 0 .6.6 1 1.3 1h29.3c.7 0 1.3-.5 1.3-1.1.1-.5-.5-1-1.2-1z';
const SUN = 'M16 8.8c-3.4 0-6.1 2.8-6.1 6.1s2.7 6.3 6.1 6.3 6.1-2.8 6.1-6.1-2.7-6.3-6.1-6.3zm13.3 11L26 15l3.3-4.8c.3-.5.1-1.1-.5-1.2l-5.7-1-1-5.7c-.1-.6-.8-.8-1.2-.5L16 5.1l-4.8-3.3c-.5-.4-1.2-.1-1.3.4L8.9 8 3.2 9c-.6.1-.8.8-.5 1.2L6 15l-3.3 4.8c-.3.5-.1 1.1.5 1.2l5.7 1 1 5.7c.1.6.8.8 1.2.5L16 25l4.8 3.3c.5.3 1.1.1 1.2-.5l1-5.7 5.7-1c.7-.1.9-.8.6-1.3zM16 22.5A7.6 7.6 0 0 1 8.3 15c0-4.2 3.5-7.5 7.7-7.5s7.7 3.4 7.7 7.5c0 4.2-3.4 7.5-7.7 7.5z';

const order = layouts.desktop.legs.map((g) => LABEL[g.rep]).join(' → ');

const page = `<!doctype html>
<html lang="en" data-accent="shu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kuuki — sign-in procession (prototype)</title>
<script>document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'</script>
<style>
${fontFace(400, 'Regular')}${fontFace(500, 'Medium')}${fontFace(600, 'SemiBold')}${fontFace(700, 'Bold')}
@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(data:font/woff;base64,${b64('./fonts/jbm-scale.woff')}) format('woff')}

/* ---------- Tokens (values from apps/next/src/app/styles.css) ---------- */
:root{
  --font-sans:Commissioner,system-ui,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;
  --font-kana:'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',var(--font-sans),sans-serif;
  --page-gutter:24px;--background:#fbfaf8;--surface:#fff;--surface-inset:#f2f0ed;--text:#302d2a;--text-muted:#66605b;
  --hairline:#dedad5;--control-border:#837b74;--accent:#c23417;--accent-text:#c23417;--accent-foreground:#fff;--focus:#c23417;
  --radius-xs:6px;--radius-sm:10px;--radius-md:14px;--radius-lg:20px;--space-3:12px;--space-6:24px;--space-8:32px;
  --ease-out:cubic-bezier(.23,1,.32,1);--ease-horizon:cubic-bezier(0,0,.15,1);--dur-fast:150ms;--dur-press:120ms;--dur-horizon:500ms;
  --surface-highlight:transparent;--surface-floating:var(--surface);--shadow-floating:0 1px 2px rgb(0 0 0/8%),0 4px 12px rgb(0 0 0/8%);--ring-floating:none;
  --accent-tint:color-mix(in srgb,var(--accent) 10%,var(--surface));
  --auth-brand-surface:var(--surface-inset);--auth-input-surface:var(--background);--auth-band-surface:var(--surface-inset);
  --auth-sheet-edge:0 -1px 0 var(--hairline);--auth-watermark-opacity:.1;
  /* Proposed plane tokens: the iso-glow palette mapped onto the existing roles. */
  --plane-top:var(--surface);--plane-front:var(--surface-inset);
  --plane-side:color-mix(in srgb,var(--surface-inset),var(--hairline));
  --plane-line:color-mix(in srgb,var(--text-muted) 87%,var(--text));
  --plane-detail:color-mix(in srgb,var(--hairline) 84%,var(--control-border));
  --plane-glass:var(--accent-tint);--plane-glow:.4;
  --plane-shadow-opacity:.09;--plane-pool-opacity:0;
  color-scheme:light;
}
:root[data-theme=dark]{
  --background:#292827;--surface:#353331;--surface-inset:#403d3a;--text:#f1efeb;--text-muted:#c4beb7;--hairline:#554f4a;
  --control-border:#958b82;--accent:#ea846f;--accent-text:#ea846f;--accent-foreground:#292827;--focus:#ea846f;
  --surface-highlight:rgb(255 255 255/5%);--surface-floating:#3c3a37;--shadow-floating:none;--ring-floating:0 0 0 1px rgb(255 255 255/8%);
  --auth-brand-surface:#2f2d2b;--auth-input-surface:#2f2d2b;--auth-band-surface:var(--background);
  --auth-sheet-edge:inset 0 1px 0 rgb(255 255 255/6%);--auth-watermark-opacity:.13;
  --plane-top:var(--surface-inset);--plane-front:var(--surface);
  --plane-side:color-mix(in srgb,var(--background),var(--surface));
  --plane-line:color-mix(in srgb,var(--control-border) 60%,var(--text-muted));
  --plane-glass:color-mix(in srgb,var(--background) 92%,black);--plane-glow:.75;
  --plane-shadow-opacity:0;--plane-pool-opacity:.42;
  color-scheme:dark;
}
:root[data-accent=ai]{--accent:#4e5ea2;--accent-text:#4e5ea2;--accent-foreground:#fff;--focus:#4e5ea2}
:root[data-theme=dark][data-accent=ai]{--accent:#acbbef;--accent-text:#acbbef;--accent-foreground:#292827;--focus:#acbbef}
:root[data-accent=matcha]{--accent:#59702a;--accent-text:#59702a;--accent-foreground:#fff;--focus:#59702a}
:root[data-theme=dark][data-accent=matcha]{--accent:#b7ce92;--accent-text:#b7ce92;--accent-foreground:#292827;--focus:#b7ce92}
:root[data-accent=asagi]{--accent:#0c747d;--accent-text:#0c747d;--accent-foreground:#fff;--focus:#0c747d}
:root[data-theme=dark][data-accent=asagi]{--accent:#85cfd8;--accent-text:#85cfd8;--accent-foreground:#292827;--focus:#85cfd8}
:root[data-accent=sakura]{--accent:#964969;--accent-text:#964969;--accent-foreground:#fff;--focus:#964969}
:root[data-theme=dark][data-accent=sakura]{--accent:#e8a9c0;--accent-text:#e8a9c0;--accent-foreground:#292827;--focus:#e8a9c0}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--background);color:var(--text);font:400 15px/24px var(--font-sans);-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
::selection{background:color-mix(in srgb,var(--accent) 24%,transparent)}
input{caret-color:var(--accent)}
button,input{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}

/* ---------- Auth card (auth-card.css) ---------- */
.kuuki-wordmark{display:inline-flex;align-items:baseline;font:700 var(--wordmark-size,36px)/1 var(--font-sans);letter-spacing:-.04em;white-space:nowrap}
.kuuki-wordmark-ku{color:var(--accent-text)}.kuuki-wordmark-uki{color:var(--text)}
.auth-page{min-height:100dvh;display:grid;place-items:center;padding:var(--space-8) var(--page-gutter) 96px;background:var(--background)}
.auth-card{position:relative;display:flex;width:min(1040px,100%);min-height:620px;border:1px solid var(--hairline);border-radius:var(--radius-lg);background:var(--surface);overflow:clip}
:root[data-theme=dark] .auth-card{border-color:transparent;box-shadow:inset 0 1px 0 var(--surface-highlight)}
.auth-brand{position:relative;flex:0 0 min(420px,40%);display:flex;flex-direction:column;padding:40px;overflow:clip;background:var(--auth-brand-surface)}
.auth-brand-field{position:absolute;inset:0;pointer-events:none}
.auth-brand-wordmark{position:relative;--wordmark-size:36px}
.auth-form-panel{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:96px clamp(var(--space-6),6vw,64px) 48px}
.auth-column{display:flex;flex-direction:column;gap:28px;width:min(360px,100%)}
.auth-corner{position:absolute;top:36px;right:28px;z-index:1;display:flex;align-items:center}
.auth-corner-control{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;height:44px;padding:0;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--text-muted);font:500 13px/20px var(--font-sans);cursor:pointer;transition:background-color var(--dur-fast) var(--ease-out)}
.auth-corner-control[data-kind=language]{padding-inline:12px}
.auth-accent-dot{width:14px;height:14px;border-radius:50%;background:var(--accent)}
.auth-horizon svg{translate:0 -.5px;transition:translate var(--dur-horizon) var(--ease-horizon)}
.auth-horizon-sun{transition:translate var(--dur-horizon) var(--ease-horizon)}
:root[data-theme=dark] .auth-horizon svg{translate:0 -4.5px}
:root[data-theme=dark] .auth-horizon-sun{translate:0 50%}
.auth-heading{display:flex;flex-direction:column;gap:6px}
.auth-heading h1{margin:0;font:600 30px/36px var(--font-sans);letter-spacing:-.02em;text-wrap:balance}
.auth-heading p{margin:0;color:var(--text-muted);text-wrap:pretty}
.auth-form{display:flex;flex-direction:column;gap:28px}
.auth-fields{display:flex;flex-direction:column;gap:16px}
.auth-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.auth-field:has(.auth-text-link-up){margin-top:8px}
.auth-field-label-row{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)}
.auth-field-label{font-size:13px;line-height:20px;font-weight:500}
.auth-field-control{position:relative}
.auth-input{width:100%;height:44px;padding-inline:14px;border:1px solid var(--control-border);border-radius:var(--radius-sm);background:var(--auth-input-surface);color:var(--text);font-size:15px;line-height:24px}
.auth-field-control[data-reveal=true] .auth-input{padding-inline-end:41px}
.auth-card-reveal{position:absolute;top:50%;right:1px;display:grid;place-items:center;width:40px;height:40px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--text-muted);translate:0 -50%;cursor:pointer;transition:background-color var(--dur-fast) var(--ease-out)}
.auth-text-link{display:inline-block;padding:12px 8px;margin:-12px -8px;font-size:13px;line-height:20px;font-weight:500;color:var(--accent-text);text-decoration:none;text-underline-offset:3px;border-radius:var(--radius-xs)}
.auth-text-link-up{padding:24px 8px 0;margin:-24px -8px 0}
.ui-button{position:relative;display:inline-grid;place-items:center;min-height:44px;padding:9px 18px;border:1px solid var(--accent);border-radius:var(--radius-sm);background:var(--accent);color:var(--accent-foreground);font-weight:600;font-size:15px;line-height:24px;cursor:pointer;width:100%;transition:transform var(--dur-press) var(--ease-out),background-color var(--dur-fast) var(--ease-out)}
.ui-button:active{transform:scale(.96)}
.auth-tagline{margin:0;padding-top:12px;font-size:13px;line-height:20px;letter-spacing:.01em;text-align:center;color:var(--text-muted)}
@media (hover:hover) and (pointer:fine){
  .auth-corner-control:hover,.auth-card-reveal:hover,.fleet-pause:hover{background:var(--surface-inset)}
  :root[data-theme=dark] .fleet-pause:hover{background:var(--surface)}
  .auth-input:hover{border-color:var(--text)}
  .auth-text-link:hover{text-decoration:underline}
  .ui-button:hover{background:color-mix(in oklch,var(--accent) 82%,var(--text));border-color:color-mix(in oklch,var(--accent) 82%,var(--text))}
}

/* ---------- Procession (new) ---------- */
.fleet-field{position:absolute;inset:0}
.stage{position:absolute;top:0}
.stage-d{left:0;width:420px;height:620px}
.stage-m{display:none;--s:1;right:0;width:${layouts.mobile.W}px;height:302px}
.stage>*{position:absolute}
.auth-watermark{display:flex;flex-direction:column;align-items:center;color:var(--accent);opacity:var(--auth-watermark-opacity);font:700 164px/164px var(--font-kana)}
.stage-d .auth-watermark{left:128px;top:86px}
.stage-m .auth-watermark{left:0;top:125px;flex-direction:row;justify-content:center;font-size:104px;line-height:104px;letter-spacing:.04em}
.anim{animation-timing-function:linear;animation-iteration-count:infinite}
.sh,.pl{left:0;top:0}
.sh svg,.pl svg{position:absolute;left:0;top:0}
/* Theme changes only opacity: hiding a layer with display would restart its animation, out of step with the plane. */
.sh{opacity:var(--plane-shadow-opacity)}
.sh g{fill:var(--text)}
.pool{opacity:var(--plane-pool-opacity);overflow:hidden;border-radius:50%;
  -webkit-mask-image:radial-gradient(closest-side,#000,rgb(0 0 0/.5) 50%,transparent);mask-image:radial-gradient(closest-side,#000,rgb(0 0 0/.5) 50%,transparent)}
.pool .auth-watermark{position:absolute;opacity:1}
.f-top{fill:var(--plane-top)}.f-front{fill:var(--plane-front)}.f-side{fill:var(--plane-side)}.f-glass{fill:var(--plane-glass)}
.f-accent{fill:var(--accent)}.s-accent{stroke:var(--accent)}.s-line{stroke:var(--plane-line)}.s-detail{stroke:var(--plane-detail)}
.glow{opacity:var(--plane-glow)}
/* Lights: the beacon blinks about once a second, wingtip strobes double-flash every 1.5 s (the 737 single-flashes).
   Off, each light dims to a steady fixture rather than vanishing. Offsets keep planes out of step. Each switch is a
   0.1% linear ramp (1–1.5 ms, under a frame) rather than steps(), which WebKit will not run on the compositor. */
.lt-beacon,.lt-strobe{animation:1s linear infinite}
.lt-beacon{animation-name:beacon;animation-delay:calc(var(--i)*-.37s)}
.lt-strobe{animation-name:strobe2;animation-duration:1.5s;animation-delay:calc(var(--i)*-.53s)}
[data-flash=single] .lt-strobe{animation-name:strobe1}
@keyframes beacon{0%,13.9%{opacity:1}14%,99.9%{opacity:.25}100%{opacity:1}}
@keyframes strobe2{0%,3.9%{opacity:1}4%,9.9%{opacity:.3}10%,13.9%{opacity:1}14%,99.9%{opacity:.3}100%{opacity:1}}
@keyframes strobe1{0%,4.9%{opacity:1}5%,99.9%{opacity:.3}100%{opacity:1}}
/* Runs only on screen with the page visible; the pause control freezes the frame with the lights steady. */
.fleet-field:not([data-running]) :is(.anim,.lt-beacon,.lt-strobe),.fleet-field[data-paused] .anim{animation-play-state:paused}
.fleet-field[data-paused] :is(.lt-beacon,.lt-strobe){animation:none}
${D.css}${M.css}
/* Foot row, bottom-right where the climbing lanes leave an empty corner: the scale bar, then the pause control (its
   bars end 40px from the panel's right edge, mirroring the wordmark's inset). */
.fleet-foot{position:absolute;right:22px;bottom:26px;display:flex;align-items:center;gap:4px;pointer-events:none}
.fleet-scale{display:inline-flex;align-items:center;gap:8px;color:var(--text-muted);font:400 12px/16px var(--font-mono);letter-spacing:.02em}
.fleet-pause{pointer-events:auto;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--text-muted);cursor:pointer;transition:background-color var(--dur-fast) var(--ease-out)}
.fleet-pause .play,.fleet-pause[aria-pressed=true] .pause{display:none}
.fleet-pause[aria-pressed=true] .play{display:block}
/* Reduced motion: the still frame, lights steady, nothing to pause. (.rm simulates it in this prototype.) */
@media (prefers-reduced-motion:reduce){
  .anim{animation-play-state:paused!important}.lt-beacon,.lt-strobe{animation:none!important}.fleet-pause{display:none}
  .auth-corner-control,.auth-card-reveal,.fleet-pause,.auth-horizon svg,.auth-horizon-sun,.ui-button{transition:none}
}
.rm .anim{animation-play-state:paused!important}.rm .lt-beacon,.rm .lt-strobe{animation:none!important}.rm .fleet-pause{display:none}

/* ---------- Mobile (auth-card.css, max-width 700px) ---------- */
@media (max-width:700px){
  .auth-page{display:block;padding:0;background:var(--auth-band-surface)}
  .auth-card,:root[data-theme=dark] .auth-card{flex-direction:column;width:100%;min-height:100dvh;border:0;border-radius:0;box-shadow:none;background:transparent;overflow:visible}
  .auth-brand{flex:0 0 auto;height:clamp(160px,100dvh - 480px,302px);padding:12px 6px 0 19px;background:var(--auth-band-surface)}
  .auth-brand-wordmark{--wordmark-size:28px}
  .auth-corner{top:4px;right:6px}
  .auth-form-panel{flex:1 0 auto;padding:28px 20px 46px;border-radius:var(--radius-lg) var(--radius-lg) 0 0;background:var(--surface);box-shadow:var(--auth-sheet-edge)}
  .auth-column,.auth-form{gap:24px}.auth-column{width:100%}
  .auth-heading h1{font-size:28px;line-height:34px}
  .auth-input{height:48px;font-size:16px}
  .auth-field-control[data-reveal=true] .auth-input{padding-inline-end:47px}
  .auth-card-reveal{right:3px;width:44px;height:44px}
  .ui-button{min-height:48px;padding-block:11px;font-size:16px}
  .auth-tagline{padding-top:0}
  /* The band shows the field scaled to its height (--s, container queries above), hung from its top-right corner:
     every lane leaves through the right edge, under the corner controls, and a wider band only shows more of the
     lanes' lower-left ends. The kana scales with the field and stays centred across the band. */
  .stage-d{display:none}
  .fleet-field{container:fleet/size}
  .stage-m{display:block;scale:var(--s);transform-origin:100% 0}
  .stage-m .auth-watermark{left:calc(${layouts.mobile.W}px - 100cqw / var(--s));width:calc(100cqw / var(--s))}
  /* The lanes leave the top-left corner empty: the pause control sits under the wordmark, its bars on the wordmark's
     left edge. There is no room for the scale bar. */
  .fleet-foot{right:auto;left:1px;top:44px;bottom:auto}
  .fleet-scale{display:none}
}

/* ---------- Prototype controls (not part of the design) ---------- */
.proto{position:fixed;left:50%;bottom:20px;translate:-50% 0;display:flex;align-items:center;gap:16px;padding:8px 8px 8px 16px;border-radius:var(--radius-md);background:var(--surface-floating);box-shadow:var(--shadow-floating),var(--ring-floating);font-size:13px;line-height:20px;color:var(--text-muted);white-space:nowrap}
.proto strong{font-weight:600;color:var(--text)}
.proto label{display:inline-flex;align-items:center;gap:8px;min-height:44px;cursor:pointer}
.proto input[type=checkbox]{width:16px;height:16px;accent-color:var(--accent);margin:0}
.proto input[type=range]{width:200px;accent-color:var(--accent)}
.proto output{min-width:15ch;font-variant-numeric:tabular-nums;color:var(--text)}
@media (max-width:700px){.proto{display:none}}
</style>
</head>
<body>
<main id="main" class="auth-page">
  <div class="auth-card">
    <div class="auth-brand">
      <div class="auth-brand-field" aria-hidden="true">
        <div class="fleet-field" data-running>
          ${D.html}
          ${M.html}
        </div>
      </div>
      <span class="kuuki-wordmark auth-brand-wordmark" role="img" aria-label="Kuuki"><span class="kuuki-wordmark-ku">Ku</span><span class="kuuki-wordmark-uki">uki</span></span>
      <div class="fleet-foot">
        <span class="fleet-scale" aria-hidden="true">${scaleBar(k.d)}10 m</span>
        <button type="button" class="fleet-pause" aria-pressed="false" aria-label="Pause planes" title="Pause planes">${icon(ICON.pause).replace('<svg', '<svg class="pause"')}${icon(ICON.play).replace('<svg', '<svg class="play"')}</button>
      </div>
    </div>
    <div class="auth-corner">
        <button type="button" class="auth-corner-control" data-kind="language" aria-label="Language: English">${icon(ICON.globe)}EN</button>
        <button type="button" class="auth-corner-control auth-horizon" aria-label="Dark theme" title="Dark theme" aria-pressed="false">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><defs><clipPath id="hz"><path d="M0 0h32v29h-32z"/></clipPath></defs><path d="${HORIZON_LINE}"/><g clip-path="url(#hz)"><path class="auth-horizon-sun" d="${SUN}"/></g></svg>
        </button>
        <button type="button" class="auth-corner-control auth-accent" aria-label="Accent: Shu" title="Accent: Shu"><span class="auth-accent-dot"></span></button>
        <button type="button" class="auth-corner-control" aria-label="About Kuuki">${icon(ICON.help)}</button>
      </div>
    <section class="auth-form-panel">
      <div class="auth-column">
        <div class="auth-heading">
          <h1>Welcome to Kuuki</h1>
          <p>Sign in, or use a new email to start your journal.</p>
        </div>
        <form class="auth-form" novalidate>
          <div class="auth-fields">
            <div class="auth-field">
              <div class="auth-field-label-row"><label class="auth-field-label" for="email">Email</label></div>
              <div class="auth-field-control"><input class="auth-input" id="email" type="email" autocomplete="email" spellcheck="false"></div>
            </div>
            <div class="auth-field">
              <div class="auth-field-label-row"><label class="auth-field-label" for="password">Password</label><a class="auth-text-link auth-text-link-up" href="#">Can’t sign in?</a></div>
              <div class="auth-field-control" data-reveal="true"><input class="auth-input" id="password" type="password" autocomplete="current-password"><button type="button" class="auth-card-reveal" aria-label="Show password">${icon(ICON.eye)}</button></div>
            </div>
          </div>
          <button type="submit" class="ui-button"><span>Continue</span></button>
        </form>
        <p class="auth-tagline">Snap a boarding pass. We’ll figure it out.</p>
      </div>
    </section>
  </div>
</main>
<div class="proto" role="group" aria-label="Prototype controls">
  <strong>Prototype</strong>
  <label><input type="checkbox" id="rm">Reduced motion</label>
  <label>Loop <input type="range" id="scrub" min="0" max="${r1(layouts.desktop.period)}" step="0.1" value="${r1(STILL.desktop)}"></label>
  <output id="t"></output>
</div>
<script>
// Fleet order: ${order}
const root = document.documentElement, field = document.querySelector('.fleet-field');
const pause = document.querySelector('.fleet-pause');
let onScreen = true;
const sync = () => { field.toggleAttribute('data-running', onScreen && !document.hidden); syncReadout(); };
new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; sync(); }).observe(field);
document.addEventListener('visibilitychange', sync);
const setPaused = (p) => { pause.setAttribute('aria-pressed', String(p)); field.toggleAttribute('data-paused', p); syncReadout(); };
pause.addEventListener('click', () => setPaused(pause.getAttribute('aria-pressed') !== 'true'));

const horizon = document.querySelector('.auth-horizon');
const syncHorizon = () => horizon.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
horizon.addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; syncHorizon(); });
syncHorizon();
const ACCENTS = ['shu', 'ai', 'matcha', 'asagi', 'sakura'], NAMES = { shu: 'Shu', ai: 'Ai', matcha: 'Matcha', asagi: 'Asagi', sakura: 'Sakura' };
const accent = document.querySelector('.auth-accent');
accent.addEventListener('click', () => {
  const next = ACCENTS[(ACCENTS.indexOf(root.dataset.accent) + 1) % ACCENTS.length];
  root.dataset.accent = next; accent.setAttribute('aria-label', 'Accent: ' + NAMES[next]); accent.title = 'Accent: ' + NAMES[next];
});
document.querySelector('.auth-form').addEventListener('submit', (e) => e.preventDefault());
document.querySelector('.auth-card-reveal').addEventListener('click', (e) => {
  const input = document.getElementById('password'), show = input.type === 'password';
  input.type = show ? 'text' : 'password'; e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

// Prototype: simulated reduced motion, and a scrubber over the desktop loop. The readout samples the loop ten times a
// second, and only while the planes move.
const rm = document.getElementById('rm'), scrub = document.getElementById('scrub'), out = document.getElementById('t');
rm.checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
rm.addEventListener('change', () => { root.classList.toggle('rm', rm.checked); if (rm.checked) seek(+scrub.dataset.still); syncReadout(); });
const stageD = document.querySelector('.stage-d'), P = +stageD.dataset.period, STILL = +stageD.dataset.still;
scrub.dataset.still = STILL;
const wide = matchMedia('(min-width: 701px)');
let cache = [], timer = 0;
const tracks = () => (cache.length ? cache : (cache = stageD.getAnimations({ subtree: true }).filter((a) => a.animationName && a.animationName.startsWith('fl-'))));
wide.addEventListener('change', () => { cache = []; syncReadout(); });
function show(tau) {
  out.value = 't = ' + tau.toFixed(1) + ' s of ' + P.toFixed(1);
  if (document.activeElement !== scrub) scrub.value = tau.toFixed(1);
}
function read() {
  const a = tracks()[0];
  if (a && a.currentTime != null) show(((a.currentTime / 1000 + STILL) % P + P) % P);
}
function syncReadout() {
  const live = wide.matches && field.hasAttribute('data-running') && !field.hasAttribute('data-paused') && !rm.checked;
  if (live && !timer) timer = setInterval(read, 100);
  else if (!live && timer) { clearInterval(timer); timer = 0; }
  if (wide.matches) read();
}
function seek(tau) { for (const a of tracks()) a.currentTime = ((tau - STILL) % P + P) % P * 1000; show(tau); }
scrub.addEventListener('input', () => { setPaused(true); seek(+scrub.value); });
syncReadout();
</script>
</body>
</html>
`;
writeFileSync(file('./index.html'), page);
console.log('index.html', (page.length / 1024).toFixed(0), 'KB');
