import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { converter } from 'culori'
const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(dir)
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8')
const validation = spawnSync(process.execPath, [path.join(dir, 'validate.mjs')], {
  encoding: 'utf8',
})
if (validation.status !== 0) throw new Error(validation.stdout + validation.stderr)
const palette = JSON.parse(read('palette.json'))
const report = JSON.parse(read('contrast-report.json'))
if (report.failures.length) throw new Error('Palette has failing checks; run npm run check')
const requireRoot = createRequire(path.join(root, 'package.json'))
const requireTsx = createRequire(requireRoot.resolve('tsx'))
const requireApp = createRequire(path.join(root, 'apps/next/package.json'))
const esbuild = requireTsx('esbuild')
const bundle = await esbuild.build({
  entryPoints: [path.join(dir, 'specimens.tsx')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  logLevel: 'error',
  alias: {
    react: path.dirname(requireApp.resolve('react')),
    'react-dom/server': requireApp.resolve('react-dom/server'),
  },
})
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kuuki-design-system-'))
let specimens
try {
  fs.writeFileSync(path.join(tmp, 'specimens.cjs'), bundle.outputFiles[0].text)
  const rendered = spawnSync(process.execPath, [path.join(tmp, 'specimens.cjs')], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
  if (rendered.status !== 0) throw new Error(rendered.stderr)
  specimens = JSON.parse(rendered.stdout)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
// The new light fill needs an independent readable panel role in figures.
for (const [key, value] of Object.entries(specimens))
  specimens[key] = value.replaceAll(
    'color-mix(in oklab, var(--accent) 80%, var(--text))',
    'var(--figure-live-fill)',
  )
const primitives = {}
const hueName = (value) => {
  const { c, h } = converter('oklch')(value)
  if (c < 0.025 || !Number.isFinite(h)) return 'neutral'
  if (h < 55 || h >= 345) return 'red'
  if (h < 110) return 'amber'
  if (h < 170) return 'green'
  if (h < 230) return 'cyan'
  if (h < 295) return 'blue'
  return 'purple'
}
const primitiveFor = (value) => '--palette-' + hueName(value) + '-' + value.slice(1)
for (const t of Object.values(palette.themes))
  for (const value of Object.values(t)) primitives[primitiveFor(value)] = value
let css =
  ':root {\n' +
  Object.entries(primitives)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n') +
  '\n}\n'
for (const [key, tokens] of Object.entries(palette.themes)) {
  const [theme, accent] = key.split('-')
  const selector = `:root[data-theme="${theme}"][data-accent="${accent}"], #catalog[data-theme="${theme}"][data-accent="${accent}"]`
  css +=
    selector +
    ' {\n' +
    Object.entries(tokens)
      .map(([k, v]) => `  --${k}: var(${primitiveFor(v)});`)
      .join('\n') +
    '\n}\n'
}
fs.writeFileSync(path.join(dir, 'tokens.css'), css)
fs.writeFileSync(
  path.join(dir, 'tokens.json'),
  JSON.stringify(
    {
      version: palette.version,
      primitives,
      themes: Object.fromEntries(
        Object.entries(palette.themes).map(([k, t]) => [
          k,
          Object.fromEntries(
            Object.entries(t).map(([role, value]) => [
              role,
              { value, primitive: primitiveFor(value) },
            ]),
          ),
        ]),
      ),
    },
    null,
    2,
  ) + '\n',
)
let fonts = ''
for (const [name, family, weight] of [
  ['Commissioner-Regular', 'Commissioner', 400],
  ['Commissioner-SemiBold', 'Commissioner', 600],
  ['PaperMono', 'Paper Mono', 400],
])
  fonts += `@font-face{font-family:'${family}';font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, 'assets', name + '.woff2')).toString('base64')}) format('woff2')}`
const sourceStyles = [
  'ui/ui.css',
  'signature/signature.css',
  'overview/iso/iso.css',
  'overview/iso/clock.css',
]
  .map((p) => fs.readFileSync(path.join(root, 'apps/next/src/client', p), 'utf8'))
  .join('\n')
const script = read('catalog.js')
  .replace("'PALETTE_JSON'", JSON.stringify(JSON.stringify(palette)))
  .replace(
    "'REPORT_JSON'",
    JSON.stringify(
      JSON.stringify({
        combinations: report.combinations,
        checks: report.checks,
        failures: report.failures,
        minimumByTheme: Object.fromEntries(
          Object.keys(palette.themes).map((key) => [
            key,
            Math.min(
              ...report.pairs
                .filter((p) => p.name === key && p.threshold === 4.5)
                .map((p) => p.ratio),
            ),
          ]),
        ),
      }),
    ),
  )
const stylesheet = (
  await esbuild.transform(fonts + css + sourceStyles + read('catalog.css'), {
    loader: 'css',
    minify: true,
  })
).code
let html = read('catalog.html').replace('/* STYLES */', stylesheet).replace('/* SCRIPT */', script)
for (const [name, svg] of Object.entries(specimens)) html = html.replaceAll('{{' + name + '}}', svg)
html = html.replace(
  '{{spacing}}',
  [4, 8, 12, 16, 24, 32, 48]
    .map(
      (n) =>
        `<div><div class="space-box" style="--size:${n}px"></div><div class="measure">${n}</div></div>`,
    )
    .join(''),
)
if (/\{\{\w+\}\}/.test(html)) throw new Error('Unresolved specimen')
fs.writeFileSync(path.join(dir, 'index.html'), html)
console.log(
  JSON.stringify({
    htmlBytes: Buffer.byteLength(html),
    specimens: Object.keys(specimens).length,
    primitives: Object.keys(primitives).length,
    themes: Object.keys(palette.themes).length,
  }),
)
