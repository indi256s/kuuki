import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findComments, stripComments } from './comments.mjs'

test('strips script comments without touching strings, regexes, JSX text or directives', () => {
  const source = [
    '// file note',
    "const url = 'https://example.com/*not*/' // trailing",
    'const pattern = /\\/\\/ not/g',
    '/** doc */',
    'export function View() {',
    '  return (',
    '    <a href={url}>',
    '      {/* jsx note */}',
    '      // visible text',
    '    </a>',
    '  )',
    '}',
    '// oxlint-disable-next-line no-unused-vars',
    '// @ts-expect-error -- fixture',
    '// Copyright (c) 2026 Someone; license: LICENSE.',
    'const x = f(/* inline */ 1)',
    '',
  ].join('\n')
  assert.equal(
    stripComments('view.tsx', source),
    [
      "const url = 'https://example.com/*not*/'",
      'const pattern = /\\/\\/ not/g',
      'export function View() {',
      '  return (',
      '    <a href={url}>',
      '      // visible text',
      '    </a>',
      '  )',
      '}',
      '// oxlint-disable-next-line no-unused-vars',
      '// @ts-expect-error -- fixture',
      '// Copyright (c) 2026 Someone; license: LICENSE.',
      'const x = f(1)',
      '',
    ].join('\n'),
  )
})

test('strips CSS comments but not comment markers inside strings', () => {
  const source = 'a { content: "/* keep */"; } /* drop */\n/* line */\nb { color: red; }\n'
  assert.deepEqual(
    findComments('x.css', source).map((comment) => comment.text),
    ['/* drop */', '/* line */'],
  )
  assert.equal(stripComments('x.css', source), 'a { content: "/* keep */"; }\nb { color: red; }\n')
})

test('keeps token boundaries, line breaks and code braces when stripping', () => {
  const strip = (path, source) => stripComments(path, source)
  assert.equal(
    strip('a.ts', 'function f() {\n  return /* why\n  */ 7\n}\n'),
    'function f() {\n  return\n7\n}\n',
  )
  assert.equal(strip('a.ts', 'const k = a/*note*/in obj\n'), 'const k = a in obj\n')
  assert.equal(strip('a.ts', 'const n = a +/*x*/+b\n'), 'const n = a + +b\n')
  assert.equal(strip('a.ts', 'function noop(){/* no work */}\n'), 'function noop(){}\n')
  assert.equal(strip('a.tsx', 'const v = <a>{/* one */ /* two */}</a>\n'), 'const v = <a></a>\n')
  assert.equal(
    strip('x.css', '.parent/* note */ .child {}\n.a/*x*/.b {}\n'),
    '.parent .child {}\n.a.b {}\n',
  )
})

test('keeps directives inside star-prefixed docblocks', () => {
  assert.deepEqual(
    findComments('a.test.ts', '/**\n * @vitest-environment jsdom\n */\nexport {}\n'),
    [],
  )
})
