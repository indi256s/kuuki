import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const baselinePath = join(root, 'scripts/comment-baseline.json')

const SCOPE = /^(apps\/next|functions|packages|workers|scripts|db\/scripts)\//
const SOURCE = /\.(?:[cm]?[jt]sx?|css)$/
const EXCLUDED = [
  /\.generated\./,
  /(?:^|\/)node_modules\//,
  /^apps\/next\/public\//,
  /^apps\/next\/next-env\.d\.ts$/,
]

const DIRECTIVE =
  /^(?:eslint-|oxlint-|@ts-(?:expect-error|ignore|nocheck|check)\b|<reference\s|@vitest-environment\b|@jsx|[#@]__(?:PURE|NO_SIDE_EFFECTS)__|webpack[A-Z]|@vite-ignore|prettier-ignore|oxfmt-ignore|c8\s|istanbul\s|v8\s+ignore|@refresh\b|biome-ignore|#(?:end)?region\b|@license\b|@preserve\b|Copyright \(c\))/

export function isDirective(text) {
  if (text.startsWith('/*!')) return true
  const body = text.startsWith('//')
    ? text.replace(/^\/\/\/?/, '')
    : text
        .slice(2, -2)
        .split('\n')
        .map((line) => line.replace(/^\s*\*+/, ''))
        .join('\n')
  return DIRECTIVE.test(body.trimStart())
}

function scriptKind(path) {
  if (/\.tsx$/.test(path)) return ts.ScriptKind.TSX
  if (/\.jsx$/.test(path)) return ts.ScriptKind.JSX
  if (/\.[cm]?js$/.test(path)) return ts.ScriptKind.JSX
  return ts.ScriptKind.TS
}

function scriptComments(path, text) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, scriptKind(path))
  const ranges = new Map()
  const emptyJsx = []
  const collect = (list) => {
    for (const range of list ?? []) {
      const head = text.slice(range.pos, range.pos + 2)
      if (head === '//' || head === '/*') ranges.set(range.pos, range.end)
    }
  }
  const visit = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode)
      return
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) {
      emptyJsx.push({ start: node.getStart(file), end: node.end })
    }
    if (node.kind !== ts.SyntaxKind.JsxText) {
      collect(ts.getLeadingCommentRanges(text, node.pos))
      collect(ts.getTrailingCommentRanges(text, node.end))
    }
    for (const child of node.getChildren(file)) visit(child)
  }
  visit(file)
  return [...ranges].map(([start, end]) => ({
    start,
    end,
    braces: emptyJsx.find((span) => span.start < start && end < span.end),
  }))
}

function cssComments(text) {
  const found = []
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2)
      const end = close === -1 ? text.length : close + 2
      found.push({ start: i, end })
      i = end - 1
    }
  }
  return found
}

export function findComments(path, text) {
  const ranges = path.endsWith('.css') ? cssComments(text) : scriptComments(path, text)
  return ranges
    .map((range) => ({ ...range, text: text.slice(range.start, range.end) }))
    .filter((comment) => !isDirective(comment.text))
    .sort((a, b) => a.start - b.start)
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

function separator(css, comment, left, right) {
  if (css) return /[ \t]$/.test(left) || /^[ \t]/.test(right) ? ' ' : ''
  if (comment.includes('\n')) return '\n'
  const a = left.trimEnd().at(-1)
  const b = right.trimStart()[0]
  const word = /[\w$]/
  if (word.test(a) && word.test(b)) return ' '
  if (a === b && '+-/'.includes(a)) return ' '
  if (a === '/' && b === '*') return ' '
  return ''
}

export function stripComments(path, text) {
  const css = path.endsWith('.css')
  let out = text
  let cut = Infinity
  for (const comment of findComments(path, text).reverse()) {
    let { start, end } = comment.braces ?? comment
    if (end > cut) continue
    cut = start
    const lineStart = out.lastIndexOf('\n', start - 1) + 1
    let lineEnd = out.indexOf('\n', end)
    if (lineEnd === -1) lineEnd = out.length
    const before = out.slice(lineStart, start)
    const after = out.slice(end, lineEnd)
    if (before.trim() === '' && after.trim() === '') {
      out = out.slice(0, lineStart) + out.slice(Math.min(lineEnd + 1, out.length))
    } else if (after.trim() === '') {
      out = out.slice(0, lineStart + before.trimEnd().length) + out.slice(lineEnd)
    } else if (before.trim() === '') {
      out = out.slice(0, start) + out.slice(end).replace(/^[ \t]+/, '')
    } else {
      const left = out.slice(0, start)
      const right = out.slice(end)
      const gap = separator(css, out.slice(start, end), left, right)
      out = left.replace(/[ \t]+$/, '') + gap + right.replace(/^[ \t]+/, '')
    }
  }
  return out
}

export function sourceFiles() {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
  return [...new Set(listed.split('\n'))]
    .filter(inScope)
    .filter((path) => existsSync(join(root, path)))
    .sort()
}

function inScope(path) {
  return SCOPE.test(path) && SOURCE.test(path) && !EXCLUDED.some((pattern) => pattern.test(path))
}

export function stagedSources() {
  const listed = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, encoding: 'utf8' })
  const entries = listed
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split('\t')
      return { path, blob: meta.split(' ')[1], stage: meta.split(' ')[2] }
    })
    .filter(({ path, stage }) => stage === '0' && inScope(path))
  const batch = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: entries.map(({ blob }) => blob).join('\n') + '\n',
    maxBuffer: 1 << 30,
  })
  const sources = new Map()
  let offset = 0
  for (const { path } of entries) {
    const header = batch.indexOf(10, offset)
    const size = Number(batch.toString('utf8', offset, header).split(' ')[2])
    sources.set(path, batch.toString('utf8', header + 1, header + 1 + size))
    offset = header + 1 + size + 1
  }
  return sources
}

function countAll(sources) {
  const counts = {}
  for (const [path, text] of sources) {
    const count = findComments(path, text).length
    if (count) counts[path] = count
  }
  return counts
}

function readBaseline() {
  return existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
}

function writeBaseline(counts) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`)
}

function check() {
  const baseline = readBaseline()
  const sources = stagedSources()
  const counts = countAll(sources)
  const grown = []
  const stale = []
  for (const [path, count] of Object.entries(counts)) {
    const allowed = baseline[path] ?? 0
    if (count > allowed) grown.push({ path, count, allowed })
  }
  for (const [path, allowed] of Object.entries(baseline)) {
    if ((counts[path] ?? 0) < allowed) stale.push(path)
  }
  for (const { path, count, allowed } of grown) {
    const text = sources.get(path)
    console.error(`${path}: ${count} comments, ${allowed} allowed`)
    for (const comment of findComments(path, text)) {
      console.error(
        `  ${path}:${lineOf(text, comment.start)}  ${comment.text.split('\n')[0].slice(0, 100)}`,
      )
    }
  }
  if (grown.length) {
    console.error(
      '\nCode comments are banned. Name the intent in code; record a decision in docs/adr/, a hack in .scratch/comment-debt/issues/. Tool directives (oxlint-disable, @ts-expect-error, …) stay allowed.',
    )
  }
  if (stale.length) {
    console.error(
      `\n${stale.length} file(s) now have fewer comments than the baseline. Lock it in: pnpm comments:ratchet`,
    )
    for (const path of stale.slice(0, 20)) console.error(`  ${path}`)
  }
  if (grown.length || stale.length) process.exit(1)
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  console.log(`comments: ${total} left in ${Object.keys(counts).length} files, none above baseline`)
}

function ratchet() {
  const baseline = readBaseline()
  const counts = countAll(stagedSources())
  const next = {}
  for (const [path, allowed] of Object.entries(baseline)) {
    const count = Math.min(counts[path] ?? 0, allowed)
    if (count) next[path] = count
  }
  writeBaseline(next)
  console.log(`baseline: ${Object.keys(next).length} files`)
}

function strip(paths) {
  let changed = 0
  for (const path of paths) {
    const full = join(root, path)
    const text = readFileSync(full, 'utf8')
    const next = stripComments(path, text)
    if (next !== text) {
      writeFileSync(full, next)
      changed++
    }
  }
  console.log(`stripped ${changed} files`)
}

function list(paths) {
  for (const path of paths.length ? paths : sourceFiles()) {
    const text = readFileSync(join(root, path), 'utf8')
    const lines = text.split('\n')
    for (const comment of findComments(path, text)) {
      const line = lineOf(text, comment.start)
      const lastLine = line + comment.text.split('\n').length - 1
      const context = lines
        .slice(Math.max(0, line - 3), Math.min(lines.length, lastLine + 4))
        .join('\n')
      console.log(JSON.stringify({ file: path, line, comment: comment.text, context }))
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2)
  if (command === 'check') check()
  else if (command === 'ratchet') ratchet()
  else if (command === 'strip') strip(rest)
  else if (command === 'list') list(rest)
  else if (command === 'files') console.log(sourceFiles().join('\n'))
  else {
    console.error(
      'usage: node scripts/comments.mjs check | ratchet | list [files] | strip <files> | files',
    )
    process.exit(2)
  }
}
