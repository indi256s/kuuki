// Contact sheet of the loop: one panel every `step` seconds, for picking the still and checking rhythm.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { THEMES } from '../cookie-cards-3/iso.mjs';
import { layouts, at, r1 } from './build.mjs';
const [name = "desktop", theme = "dark", step = "3", from = "0", count] = process.argv.slice(2);
const L = layouts[name], th = THEMES[theme];
const lit = (m) => m.replace(/"@(\w+)"/g, (_, r) => `"${th[r]}"`);
const n = count ? +count : Math.ceil(L.period / +step), cols = 8, pad = 12, cw = L.W + pad, ch = L.H + pad + 24;
let defs = '', cells = '';
for (const g of L.legs) defs += lit(g.plane.defs);
for (let i = 0; i < n; i++) {
  const tau = (+from + i * +step) % L.period, x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
  let body = '';
  for (const g of L.legs) {
    const o = at(L, g, tau); if (!o) continue;
    if (theme === 'light') body += `<g transform="translate(${r1(o[0])} ${r1(o[1] + L.alt)})" fill="rgba(0,0,0,.07)">${g.plane.shadow}</g>`;
    body += `<g transform="translate(${r1(o[0])} ${r1(o[1])})">${lit(g.plane.body)}</g>`;
  }
  cells += `<g transform="translate(${x} ${y})"><text x="0" y="16" font-family="Menlo" font-size="14" fill="#999">t=${r1(tau)}s</text><svg x="0" y="24" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" overflow="hidden"><rect width="${L.W}" height="${L.H}" fill="${theme === 'dark' ? '#2f2d2b' : '#f2f0ed'}"/>${body}</svg></g>`;
}
const W = cols * cw, H = Math.ceil(n / cols) * ch;
writeFileSync('/tmp/kuuki-contact.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1c1b1a"/><defs>${defs}</defs>${cells}</svg>`);
execFileSync('rsvg-convert', ['-z', '0.6', '/tmp/kuuki-contact.svg', '-o', new URL(`./out/contact-${name}-${theme}.png`, import.meta.url).pathname]);
console.log('frames', n, 'period', r1(L.period));
