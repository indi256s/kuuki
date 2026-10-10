// Sign-in procession (Paper boards 14.2–14.6): real-size iso airliners climbing out across the auth brand panel.
// Reads the cookie-cards-3 plane model without changing it. Writes:
//   out/fleet.json                         per-plane geometry and the solved choreography
//   out/still-{desktop,mobile}-{dark,light}.svg   the reduced-motion frame, literal colours, for Paper
//   out/still-mobile-{dark,light}-160.svg  the same frame on the shortest (160px) band
// proto.mjs turns the solved choreography into the moving prototype (index.html).
// Run from the repo root: node .scratch/signin-procession/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Scene, THEMES } from '../cookie-cards-3/iso.mjs';
import { airliner, TOP6 } from '../cookie-cards-3/aircraft.mjs';

const here = (p) => new URL(p, import.meta.url);
mkdirSync(here('./out/'), { recursive: true });

// Fixed fleet, smallest to largest, so the panel builds to the A350. No counts: the page is public.
const ORDER = ['SU95', 'E195', 'A320', 'B738', 'A333', 'A35K'];
const LABEL = { SU95: 'Superjet 100', E195: 'Embraer 195', A320: 'Airbus A320', B738: 'Boeing 737-800', A333: 'Airbus A330-300', A35K: 'Airbus A350-1000' };
// Boeing strobes flash once; the others double-flash.
const FLASH = { B738: 'single' };

// Sentinel theme: every colour role becomes "@role", turned into a class afterwards so tokens can drive it.
const ROLES = ['card', 'top', 'front', 'side', 'line', 'detail', 'ink', 'muted', 'accent', 'onAccent', 'glass', 'ghost'];
THEMES.tok = Object.fromEntries([...ROLES.map((r) => [r, `@${r}`]), ['glow', '@glow']]);

const r1 = (n) => Math.round(n * 10) / 10;

// Render one plane at scale k, turned to fly toward the top right. The model's nose points +x (screen down-right); a
// quarter turn sends it to world -y (screen up-right), away from the viewer, so the near side stays the near side but
// the engines show their nozzles, not their intakes. Engine faces are the model's only constant-x polygons, so each
// moves from the intake back to the nozzle: one nacelle length (1.85d) aft, at the nozzle's 0.36d radius for the
// intake's 0.5d. flat = true projects every point onto the ground (z = 0) for the shadow.
function render(rep, theme, k, flat = false) {
  const f = TOP6.find((p) => p.rep === rep);
  const { P, poly, polyMarkup } = Scene.prototype;
  let faces = 0;
  const nozzle = (pts) => {
    if (pts.length < 10 || pts.some((p) => p[0] !== pts[0][0])) return pts;
    faces++;
    const cy = pts.reduce((n, p) => n + p[1], 0) / pts.length, cz = pts.reduce((n, p) => n + p[2], 0) / pts.length;
    return pts.map(([x, y, z]) => [x - 1.85 * f.nacelle, cy + (y - cy) * 0.72, cz + (z - cz) * 0.72]);
  };
  Scene.prototype.P = function (x, y, z) { return P.call(this, y, -x, flat ? 0 : z); };
  Scene.prototype.poly = function (pts, ...rest) { return poly.call(this, nozzle(pts), ...rest); };
  Scene.prototype.polyMarkup = function (pts, ...rest) { return polyMarkup.call(this, nozzle(pts), ...rest); };
  try {
    const s = airliner(theme, f.a, { k, nacelle: f.nacelle });
    // Per engine: the lip, the core's glow, the core and the cone.
    if (faces !== 4 * f.a.engines) throw new Error(`${rep}: moved ${faces} engine faces, expected ${4 * f.a.engines}`);
    return s;
  } finally {
    Object.assign(Scene.prototype, { P, poly, polyMarkup });
  }
}

function bbox(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// The three accent lights (far wingtip, beacon, near wingtip, each a glow group then a dot) come out of the body into
// their own small svgs, so a blink is an opacity change on its own layer rather than a repaint of the plane (WebKit
// cannot composite an SVG <g>). Drawing them last changes no pixel: nothing in the body covers them.
function splitLights(parts) {
  const idx = parts.map((p, i) => (p.includes('<circle') ? i : -1)).filter((i) => i >= 0);
  if (idx.length !== 6) throw new Error(`expected 6 light parts, got ${idx.length}`);
  const lights = ['strobe', 'beacon', 'strobe'].map((kind, n) => {
    const markup = parts[idx[2 * n]] + parts[idx[2 * n + 1]];
    const [, cx, cy] = markup.match(/cx="([-\d.]+)" cy="([-\d.]+)"/);
    return { kind, cx: +cx, cy: +cy, markup };
  });
  return { body: parts.filter((_, i) => !idx.includes(i)), lights };
}
// Half the side of a light's svg: the glow disc plus three blur deviations, so the blur is never clipped.
function lightHalf(defs) {
  const sd = Math.max(...[...defs.matchAll(/stdDeviation="([\d.]+)"/g)].map((m) => +m[1]));
  return Math.ceil(2.2 + 3 * sd + 1);
}

// "@role" attributes -> classes (presentation attributes cannot take var()).
function classify(markup) {
  return markup.replace(/<(\w+)([^<>]*?)(\/?)>/g, (m, tag, attrs, close) => {
    const cls = [];
    attrs = attrs
      .replace(/\sfill="@(\w+)"/, (_, r) => (cls.push(`f-${r}`), ''))
      .replace(/\sstroke="@(\w+)"/, (_, r) => (cls.push(`s-${r}`), ''))
      .replace(/\sopacity="@glow"/, () => (cls.push('glow'), ''));
    return `<${tag}${attrs}${cls.length ? ` class="${cls.join(' ')}"` : ''}${close}>`;
  });
}
// "@role" -> a theme's literal colours (Paper stills).
const literal = (markup, theme) => markup.replace(/"@(\w+)"/g, (_, r) => `"${THEMES[theme][r]}"`);

function plane(rep, k) {
  const s = render(rep, 'tok', k);
  const { body, lights } = splitLights(s.parts);
  const b = bbox(s.pts);
  const sh = render(rep, 'tok', k, true);
  const shadowPolys = sh.parts.filter((p) => p.startsWith('<polygon')).map((p) => p.replace(/\s(fill|stroke|stroke-width|stroke-linejoin)="[^"]*"/g, ''));
  const sb = bbox(sh.pts);
  // Glow filter ids are per scene ("g0"…); prefix them so several planes can share a document.
  const pre = `${rep.toLowerCase()}k${k}`;
  const fix = (m) => m.replaceAll('id="g', `id="${pre}g`).replaceAll('url(#g', `url(#${pre}g`);
  return {
    rep, k, bbox: b, shadowBox: sb, pts: s.pts,
    defs: fix(s.defs || ''),
    body: fix(body.join('')),
    lights: lights.map((l) => ({ ...l, markup: fix(l.markup) })),
    lightHalf: lightHalf(s.defs || ''),
    shadow: shadowPolys.join(''),
  };
}
// Body with the lights back on top, for the stills.
const full = (p) => p.body + p.lights.map((l) => l.markup).join('');

// ---------- choreography ----------
const C = Math.cos(Math.PI / 6), S = 0.5;

const S160 = 0.6; // scale on the 160px band: small enough that the A350 still is whole there
// Every lane climbs toward the top right at the iso angle: a step s along it moves a plane (C, -S) on screen.
const LAYOUTS = {
  desktop: {
    W: 420, H: 620, k: 4, alt: 56, speed: 52, breath: 0.6,
    // Where each plane's lane crosses the panel's vertical centre line, in fleet order. Narrowbodies alternate between
    // a high lane that leaves through the top-right corner and a low one that enters at the bottom-left corner; the
    // widebodies take the diagonal between them, over the kana.
    lanes: [190, 420, 190, 420, 300, 330],
    // The wordmark (top left) and the foot row (scale bar + pause, bottom right), padded: the two corners the climbing
    // lanes leave empty. The panel is min(420px, 40%) wide, so 261px at the narrowest desktop card (701px viewport),
    // and the card grows taller than 620px with its form: the foot row's box covers every width and height.
    keepClear: [[32, 30, 136, 86], [106, 544, 404, 1e4]],
    // Leaves through the top or right edge. Every plane waits wholly left of the panel and flies in from there, even a
    // lane that first shows at the bottom edge: below the panel is in view on a taller card.
    edges: 'all',
    pool: 0.42, // light pool radius as a share of the plane's drawn width
    still: 0, // seconds after the A350 crosses the centre line: it sits over う, whole
  },
  mobile: {
    // Field units. The band shows this field scaled by --s from its top-right corner (x = W is the band's right edge
    // at every width), the scale set by band height, so the procession keeps its shape from the 160px band to the
    // full 302px one. At s = 1, 1 unit = 1px.
    W: 390, H: 302, k: 2.4, alt: 34, speed: 42, breath: 0.6,
    // [band height floor (px), s]: .6 at 160px rising to 1 at 300px, one step per 20px (container queries in proto.mjs).
    scales: [160, 180, 200, 220, 240, 260, 280, 300].map((h) => [h, Math.round((S160 + (1 - S160) * (h - 160) / 140) * 100) / 100]),
    // UI in band px, which does not scale, padded 6px. Planes clear each box at every scale. The 28px wordmark at 19px
    // in and the pause button under it (bars on the wordmark's left edge) are measured from the band's left edge, so
    // they move across the field as the band widens up to 700px; the corner controls (four 44px buttons, top right)
    // are measured from its right edge. The lanes leave the top-left corner empty, which is where the pause went.
    ui: [{ from: 'left', box: [13, 6, 102, 46] }, { from: 'left', box: [-5, 38, 51, 94] }, { from: 'right', box: [-208, -1e4, 0, 54] }],
    views: [360, 390], // band widths checked for visibility
    // Each plane takes the highest clear lane: lanes are searched downward from here.
    lanes: [100, 100, 100, 100, 100, 100], search: 'down',
    // Planes enter from below the tallest band and leave through the right edge, under the corner controls. The left
    // edge moves with the band width, so no lane enters or hops there.
    edges: 'bottom-right', yBelow: 320,
    pool: 0.42,
    still: 'best', // the A350's best-visible moment on the shortest band
  },
};
// Seconds per hop segment on the way back to the entry (proto.mjs). Every point of the hop is off-panel.
const HOP = 0.05;
const WIDEST = 700; // widest mobile band, px

// Does a plane on lane yc touch a keep-clear box anywhere along its crossing? Tests the drawn vertices.
function clashes(L, boxes, p, yc) {
  const { pts, bbox: b } = p, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const reach = (L.W + L.H) / C;
  for (let s = -reach; s <= reach; s += 4) {
    const ox = L.W / 2 + s * C - cx, oy = yc - s * S - cy;
    for (const [x0, y0, x1, y1] of boxes) {
      if (b.x1 + ox <= x0 || b.x0 + ox >= x1 || b.y1 + oy <= y0 || b.y0 + oy >= y1) continue;
      if (pts.some(([x, y]) => x + ox > x0 && x + ox < x1 && y + oy > y0 && y + oy < y1)) return true;
    }
  }
  return false;
}

function solve(name) {
  const L = LAYOUTS[name];
  // Mobile UI boxes are in band px; in field units they grow as the field shrinks. A box held to the left edge sits at
  // field x = W + (x - band width) / s, so it covers every width from the narrowest view to the widest band.
  const keepClear = L.scales ? L.scales.flatMap(([, s]) => L.ui.map(({ from, box: [x0, y0, x1, y1] }) => (from === 'right'
    ? [L.W + x0 / s, y0 / s, L.W + x1 / s, y1 / s]
    : [L.W + (x0 - WIDEST) / s, y0 / s, L.W + (x1 - Math.min(...L.views)) / s, y1 / s]))) : L.keepClear;
  const fleet = ORDER.map((rep) => plane(rep, L.k));
  let t = 0; // when the next plane comes into view
  const legs = fleet.map((p, i) => {
    let yc = L.lanes[i];
    if (L.search === 'down') {
      while (clashes(L, keepClear, p, yc)) if ((yc += 2) > L.lanes[i] + 400) throw new Error(`${name}: no clear lane for ${p.rep}`);
    } else {
      // Each lane starts where the layout asks and moves to the nearest lane that clears the keep-clear boxes.
      for (let d = 0; ; d = d > 0 ? -d : 2 - d) {
        if (Math.abs(d) > 160) throw new Error(`${name}: no clear lane for ${p.rep} near ${L.lanes[i]}`);
        if (!clashes(L, keepClear, p, L.lanes[i] + d)) { yc = L.lanes[i] + d; break; }
      }
      if (yc !== L.lanes[i] && process.argv[1] === new URL(import.meta.url).pathname) console.warn(`${name}: ${p.rep} lane ${L.lanes[i]} -> ${yc} to clear the wordmark and foot row`);
    }
    // Ground point: the shadow's centre, where the night light pool falls.
    const ground = [(p.shadowBox.x0 + p.shadowBox.x1) / 2, (p.shadowBox.y0 + p.shadowBox.y1) / 2 + L.alt];
    const poolR = L.pool * (p.bbox.x1 - p.bbox.x0);
    // Union of everything the plane carries, in plane-local coords: the plane, its shadow alt px lower and the light
    // pool around the shadow. Padded by M so strokes and light glows are fully outside the panel while a plane is parked.
    const M = 14;
    const u = {
      x0: Math.min(p.bbox.x0, p.shadowBox.x0, ground[0] - poolR) - M, y0: Math.min(p.bbox.y0, p.shadowBox.y0 + L.alt, ground[1] - poolR) - M,
      x1: Math.max(p.bbox.x1, p.shadowBox.x1, ground[0] + poolR) + M, y1: Math.max(p.bbox.y1, p.shadowBox.y1 + L.alt, ground[1] + poolR) + M,
    };
    const cx = (p.bbox.x0 + p.bbox.x1) / 2, cy = (p.bbox.y0 + p.bbox.y1) / 2;
    // Plane-local origin at path distance s: centre of the drawn plane on the lane.
    const origin = (s) => [L.W / 2 + s * C - cx, yc - s * S - cy];
    // Path distance up to which the union is wholly left of the panel (sR) or below it (sB), and from which it is
    // wholly right of it (sL) or above it (sT). Mobile: below means below the tallest band, and only the right edge
    // counts as a way out.
    const bottom = L.yBelow ?? L.H;
    const sR = (-u.x1 - (L.W / 2 - cx)) / C, sB = (yc - cy + u.y0 - bottom) / S;
    const sL = (L.W - u.x0 - (L.W / 2 - cx)) / C, sT = (yc - cy + u.y1) / S;
    const mobile = L.edges === 'bottom-right';
    // sIn: where the plane comes into view. sFrom: where it waits and its crossing starts.
    const sIn = mobile ? sB : Math.max(sR, sB), sFrom = mobile ? sB : sR;
    const sOut = mobile ? sL : Math.min(sL, sT);
    const dur = (sOut - sFrom) / L.speed;
    const start = t - (sIn - sFrom) / L.speed;
    // The next plane comes into view once this one reaches the centre line.
    t += (0 - sIn) / L.speed + L.breath;
    const from = origin(sFrom), to = origin(sOut);
    // The way back to the entry, each leg keeping the union off-panel. Desktop: straight up from the exit, left above
    // the panel, then down to the entry, left of it. Mobile: straight down from the exit, right of the band, then left
    // below the tallest band and up to the entry.
    const below = bottom + 40 - u.y0, left = -u.x1 - 40, above = -u.y1 - 40;
    const hop = mobile ? [[to[0], below], [from[0], below]] : [[to[0], above], [left, above]];
    return { rep: p.rep, lane: i, yc, start, dur, sFrom, sOut, from, to, hop, union: u, ground, poolR, plane: p };
  });
  for (const g of legs) {
    if (g.dur + (g.hop.length + 1) * HOP >= t) throw new Error(`${name}: ${g.rep} leg ${g.dur.toFixed(1)}s leaves no time to hop in a ${t.toFixed(1)}s loop`);
    g.start = ((g.start % t) + t) % t;
  }
  return { name, ...L, keepClear, period: t, legs };
}

// Where each leg is at loop time tau (null when out of frame).
function at(layout, leg, tau) {
  const { period, speed } = layout;
  let dt = tau - leg.start;
  if (dt < 0) dt += period;
  if (dt > leg.dur) return null;
  const f = dt / leg.dur;
  return [leg.from[0] + (leg.to[0] - leg.from[0]) * f, leg.from[1] + (leg.to[1] - leg.from[1]) * f];
}

// Share of a plane's drawn vertices inside the rect [x0, y0, x1, y1] at loop time tau (0 when out of frame).
function share(L, g, tau, [x0, y0, x1, y1]) {
  const o = at(L, g, tau);
  if (!o) return 0;
  const P = g.plane.pts;
  return P.filter(([x, y]) => x + o[0] >= x0 && x + o[0] <= x1 && y + o[1] >= y0 && y + o[1] <= y1).length / P.length;
}
// The field rect a mobile band of width w and height h shows at scale s (held to the band's right edge), and every rect
// to check: per scale step, its shortest band at each checked width.
const bandRect = (L, w, h, s) => [L.W - w / s, 0, L.W, h / s];
const views = (L) => (L.scales ? L.scales.flatMap(([h, s]) => L.views.map((w) => bandRect(L, w, h, s))) : [[0, 0, L.W, L.H]]);
// The middle of the stretch of a leg where the plane is best seen in every view.
function bestTau(L, g) {
  const V = views(L), seen = [];
  for (let dt = 0; dt <= g.dur; dt += 0.1) {
    const tau = (g.start + dt) % L.period;
    seen.push([tau, Math.min(...V.map((v) => share(L, g, tau, v)))]);
  }
  const top = Math.max(...seen.map(([, v]) => v)), best = seen.filter(([, v]) => v >= top - 0.005);
  return best[Math.floor(best.length / 2)][0];
}

// ---------- outputs ----------
// When a leg's plane crosses the centre line.
const centre = (L, g) => (g.start - g.sFrom / L.speed) % L.period;
const layouts = { desktop: solve('desktop'), mobile: solve('mobile') };
// The still (reduced motion, and the first painted frame), timed from the A350's centre crossing on desktop and at
// the A350's best-seen moment on mobile.
const STILL = Object.fromEntries(Object.values(layouts).map((L) => {
  const big = L.legs[5];
  return [L.name, L.still === 'best' ? bestTau(L, big) : (centre(L, big) + L.still) % L.period];
}));

// One frame with literal colours. On mobile, s and h give a band of that height showing the field scaled by s.
function stillSvg(L, theme, tau = STILL[L.name], { s = 1, w = L.W, h = L.H } = {}) {
  const items = L.legs.map((g) => ({ g, o: at(L, g, tau) })).filter((x) => x.o);
  const shadowFill = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'none';
  let defs = '', body = '';
  for (const { g, o } of items) {
    defs += g.plane.defs;
    if (theme === 'light') body += `<g transform="translate(${r1(o[0])} ${r1(o[1] + L.alt)})" fill="${shadowFill}">${g.plane.shadow}</g>`;
  }
  for (const { g, o } of items) body += `<g transform="translate(${r1(o[0])} ${r1(o[1])})">${literal(full(g.plane), theme)}</g>`;
  // Mobile: the band's right edge is the field's (band x = field x * s + w - W * s).
  if (s !== 1 || w !== L.W) body = `<g transform="translate(${r1(w - L.W * s)} 0) scale(${s})">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${literal(defs, theme)}</defs>${body}</svg>`;
}

const SHORT = layouts.mobile.scales[0]; // [160, s]
for (const L of Object.values(layouts)) for (const th of ['dark', 'light']) {
  writeFileSync(here(`./out/still-${L.name}-${th}.svg`), stillSvg(L, th));
}
for (const th of ['dark', 'light']) writeFileSync(here(`./out/still-mobile-${th}-${SHORT[0]}.svg`), stillSvg(layouts.mobile, th, STILL.mobile, { s: SHORT[1], h: SHORT[0] }));

const r2 = (n) => Math.round(n * 100) / 100;
const summary = Object.fromEntries(Object.values(layouts).map((L) => [L.name, {
  period: r1(L.period), still: r1(STILL[L.name]),
  legs: L.legs.map((g) => ({ rep: g.rep, yc: g.yc, start: r1(g.start), dur: r1(g.dur), w: r1(g.plane.bbox.x1 - g.plane.bbox.x0), h: r1(g.plane.bbox.y1 - g.plane.bbox.y0) })),
  // Night light pools at the still frame, for the Paper boards: centre in field coords and radius.
  pools: L.legs.map((g) => ({ g, o: at(L, g, STILL[L.name]) })).filter((x) => x.o).map(({ g, o }) => ({ rep: g.rep, x: r1(o[0] + g.ground[0]), y: r1(o[1] + g.ground[1]), r: r1(g.poolR) })),
  // Mobile, per scale step (shortest band, worst of the checked widths): each plane's visible share in the still,
  // and the seconds of its crossing it is at least half in view.
  ...(L.scales && {
    bands: L.scales.map(([h, s]) => {
      const V = L.views.map((w) => bandRect(L, w, h, s));
      const seen = (g, tau) => Math.min(...V.map((v) => share(L, g, tau, v)));
      const half = (g) => { let n = 0; for (let dt = 0; dt <= g.dur; dt += 0.1) if (seen(g, (g.start + dt) % L.period) >= 0.5) n++; return r1(n / 10); };
      return { band: h, s, still: L.legs.map((g) => r2(seen(g, STILL[L.name]))).join(' '), halfSeenSeconds: L.legs.map(half).join(' ') };
    }),
  }),
}]));
writeFileSync(here('./out/fleet.json'), JSON.stringify(summary, null, 1));
if (process.argv[1] === new URL(import.meta.url).pathname) console.log(JSON.stringify(summary, null, 1));

// Extra frames for the light Paper boards: the A330 crossing the centre line on desktop, the 737 at its best-seen
// moment on mobile.
writeFileSync(here('./out/frame-desktop-light-a333.svg'), stillSvg(layouts.desktop, 'light', centre(layouts.desktop, layouts.desktop.legs[4])));
writeFileSync(here('./out/frame-mobile-light-b738.svg'), stillSvg(layouts.mobile, 'light', bestTau(layouts.mobile, layouts.mobile.legs[3])));

export { layouts, STILL, HOP, at, classify, LABEL, FLASH, ORDER, r1 };
