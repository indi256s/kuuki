import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

// Exercise the patched dependency as loaded by Next's Oxlint compatibility plugin.
let require = createRequire(new URL('../apps/next/package.json', import.meta.url))
for (const name of ['@next/eslint-plugin-next', 'fast-glob', 'micromatch']) {
  require = createRequire(require.resolve(name))
}
const braces = require('braces')

test('brace patterns and ASTs reject excessive nesting before recursive walkers exhaust the stack', () => {
  assert.deepEqual(braces.expand('src/{a,{b,c}}.js'), ['src/a.js', 'src/b.js', 'src/c.js'])
  assert.equal(braces.compile('{a,b}'), '(a|b)')
  assert.equal(braces.stringify(braces.parse('src/{a,{b,c}}.js')), 'src/{a,{b,c}}.js')
  const pattern = '{a,'.repeat(700) + 'b' + '}'.repeat(700)
  const error = { name: 'SyntaxError', message: 'Brace nesting exceeds 100 levels' }
  for (const mode of ['compile', 'expand']) assert.throws(() => braces[mode](pattern), error)
  // The public AST entry points also need a bound, even when parsing is bypassed.
  let ast = { type: 'text', value: 'x' }
  for (let i = 0; i < 700; i++) ast = { type: 'root', nodes: [ast] }
  for (const mode of ['compile', 'expand', 'stringify'])
    assert.throws(() => braces[mode](ast), error)
})
