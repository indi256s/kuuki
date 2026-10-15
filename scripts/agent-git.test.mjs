import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const cli = fileURLToPath(new URL('./agent-git.mjs', import.meta.url))
function invoke(cwd, executable, args, ok = true) {
  const r = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
  if (ok) assert.equal(r.status, 0, r.stderr)
  else assert.notEqual(r.status, 0, r.stdout)
  return r
}
const git = (root, ...args) => invoke(root, 'git', args).stdout.trim()
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-git-test-'))
  const snapshots = []
  t.after(() => {
    for (const snapshot of snapshots) {
      const s = JSON.parse(fs.readFileSync(snapshot, 'utf8'))
      fs.rmSync(s.directory, { recursive: true, force: true })
    }
    fs.rmSync(root, { recursive: true, force: true })
  })
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'user.name', 'Test')
  git(root, 'config', 'user.email', 'test@example.invalid')
  fs.writeFileSync(path.join(root, 'file'), 'own\n' + 'middle\n'.repeat(15) + 'foreign\n')
  fs.writeFileSync(path.join(root, 'other'), 'original\n')
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'base')
  function call(args, ok = true) {
    return invoke(root, process.execPath, [cli, ...args], ok)
  }
  function prepare() {
    const original = fs.readFileSync(path.join(root, 'file'), 'utf8')
    fs.writeFileSync(path.join(root, 'file'), original.replace('own\n', 'OWN\n'))
    const patch = path.join(root, '.git', 'own.patch')
    fs.writeFileSync(patch, git(root, 'diff', '--', 'file') + '\n')
    const result = JSON.parse(call(['prepare', '--patch', patch]).stdout)
    snapshots.push(result.snapshot)
    return result
  }
  return { root, call, prepare, snapshots }
}
function state(root) {
  return {
    head: git(root, 'rev-parse', 'HEAD'),
    index: fs.readFileSync(path.join(root, '.git', 'index')),
    files: ['file', 'other'].map((file) => fs.readFileSync(path.join(root, file))),
    status: git(root, 'status', '--porcelain'),
  }
}
test('commit preserves foreign staged and unstaged hunks, flags, new files and root bytes', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const file = path.join(f.root, 'file')
  const original = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(file, original.replace('OWN\n', 'own\n').replace('foreign\n', 'STAGED\n'))
  git(f.root, 'add', 'file')
  fs.writeFileSync(file, original.replace('foreign\n', 'STAGED\nUNSTAGED\n'))
  fs.writeFileSync(path.join(f.root, 'new'), 'new staged\n')
  git(f.root, 'add', 'new')
  fs.writeFileSync(path.join(f.root, 'new'), 'new staged\nnew unstaged\n')
  git(f.root, 'update-index', '--assume-unchanged', 'other')
  const before = state(f.root)
  f.call(['commit', '--snapshot', s.snapshot, '--message', 'own', '--check', 'git diff --quiet'])
  assert.match(git(f.root, 'show', 'HEAD:file'), /^OWN\n/)
  assert.match(git(f.root, 'diff', '--cached'), /STAGED/)
  assert.match(git(f.root, 'diff'), /UNSTAGED/)
  assert.match(git(f.root, 'ls-files', '-v', 'other'), /^h /)
  assert.deepEqual(state(f.root).files, before.files)
  assert.equal(fs.readFileSync(path.join(f.root, 'new'), 'utf8'), 'new staged\nnew unstaged\n')
  assert.equal(git(f.root, 'show', ':new'), 'new staged')
})
test('checks see the exact prepared candidate, not valid dirty root files', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  fs.writeFileSync(path.join(f.root, 'other'), 'valid\n')
  const before = state(f.root)
  const result = f.call(
    [
      'commit',
      '--snapshot',
      s.snapshot,
      '--message',
      'own',
      '--check',
      'test "$(cat other)" = valid',
    ],
    false,
  )
  assert.match(result.stderr, /Check failed/)
  assert.deepEqual(state(f.root), before)
})
test('hook failure leaves root index, ref and files unchanged', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const hook = path.join(f.root, '.git', 'hooks', 'pre-commit')
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 })
  const before = state(f.root)
  f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false)
  assert.deepEqual(state(f.root), before)
})
test('root HEAD movement during a check is rejected before publication', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const check = `git -C '${f.root}' commit --allow-empty -m concurrent`
  const result = f.call(
    ['commit', '--snapshot', s.snapshot, '--message', 'own', '--check', check],
    false,
  )
  assert.match(result.stderr, /Stale root HEAD/)
  assert.equal(git(f.root, 'log', '-1', '--format=%s'), 'concurrent')
  assert.match(git(f.root, 'diff'), /OWN/)
})
test('candidate drift and missing live changes reject publication', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const before = state(f.root)
  fs.appendFileSync(path.join(s.checkout, 'file'), 'drift\n')
  assert.match(
    f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false).stderr,
    /drifted/,
  )
  assert.deepEqual(state(f.root), before)
  git(s.checkout, 'restore', 'file')
  git(f.root, 'restore', 'file')
  const restored = state(f.root)
  assert.match(
    f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false).stderr,
    /absent or conflicting/,
  )
  assert.deepEqual(state(f.root), restored)
})
test('busy cooperative and native index locks reject without touching root', (t) => {
  for (const lock of ['agent-git.lock', 'index.lock']) {
    const f = fixture(t)
    const s = f.prepare()
    fs.writeFileSync(path.join(f.root, '.git', lock), 'foreign lock')
    const before = state(f.root)
    assert.match(
      f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false).stderr,
      /Busy/,
    )
    assert.deepEqual(state(f.root), before)
    assert.equal(fs.readFileSync(path.join(f.root, '.git', lock), 'utf8'), 'foreign lock')
  }
})
function target(f) {
  const base = git(f.root, 'rev-parse', 'HEAD')
  fs.writeFileSync(path.join(f.root, 'incoming'), 'target\n')
  git(f.root, 'add', 'incoming')
  git(f.root, 'commit', '-m', 'target')
  const head = git(f.root, 'rev-parse', 'HEAD')
  git(f.root, 'reset', '--hard', base)
  const s = JSON.parse(f.call(['prepare', '--target', head]).stdout)
  f.snapshots.push(s.snapshot)
  return { ...s, head }
}
test('normal fast-forward preserves foreign staged, unstaged and untracked work', (t) => {
  const f = fixture(t)
  const s = target(f)
  fs.writeFileSync(path.join(f.root, 'other'), 'staged\n')
  git(f.root, 'add', 'other')
  fs.appendFileSync(path.join(f.root, 'other'), 'unstaged\n')
  fs.writeFileSync(path.join(f.root, 'untracked'), 'untracked\n')
  const before = state(f.root)
  f.call(['land', '--snapshot', s.snapshot, '--check', 'test -f incoming'])
  assert.equal(git(f.root, 'rev-parse', 'HEAD'), s.head)
  assert.deepEqual(state(f.root).files, before.files)
  assert.match(git(f.root, 'diff', '--cached'), /staged/)
  assert.match(git(f.root, 'diff'), /unstaged/)
  assert.equal(fs.readFileSync(path.join(f.root, 'untracked'), 'utf8'), 'untracked\n')
})
test('land refuses untracked and ignored directory-prefix collisions', (t) => {
  for (const ignored of [false, true]) {
    const f = fixture(t)
    const s = target(f)
    fs.mkdirSync(path.join(f.root, 'incoming'))
    fs.writeFileSync(path.join(f.root, 'incoming', 'foreign'), 'foreign\n')
    if (ignored) fs.writeFileSync(path.join(f.root, '.git', 'info', 'exclude'), 'incoming/\n')
    const before = state(f.root)
    assert.match(
      f.call(['land', '--snapshot', s.snapshot, '--check', 'true'], false).stderr,
      /overlap/,
    )
    assert.deepEqual(state(f.root), before)
    assert.equal(fs.readFileSync(path.join(f.root, 'incoming', 'foreign'), 'utf8'), 'foreign\n')
  }
})
test('partial publication keeps recovery guard and refuses intervening index changes', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const data = JSON.parse(fs.readFileSync(s.snapshot, 'utf8'))
  const hook = path.join(f.root, '.git', 'hooks', 'reference-transaction')
  fs.writeFileSync(
    hook,
    `#!/bin/sh\ninput=$(cat)\ncase "$input" in\n  *refs/heads/main*)\n    if test "$1" = committed; then\n      cp '${data.directory}/new.index' '${data.directory}/saved.index'\n      rm '${data.directory}/new.index'\n      mkdir '${data.directory}/new.index'\n    fi\n    ;;\nesac\n`,
    { mode: 0o755 },
  )
  const base = git(f.root, 'rev-parse', 'HEAD')
  const before = state(f.root)
  const result = f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false)
  assert.match(result.stderr, /recovery retained/)
  assert.notEqual(git(f.root, 'rev-parse', 'HEAD'), base)
  assert.deepEqual(state(f.root).index, before.index)
  assert.ok(fs.existsSync(path.join(f.root, '.git', 'agent-git-recovery.json')))
  fs.unlinkSync(hook)
  fs.rmdirSync(path.join(data.directory, 'new.index'))
  fs.renameSync(path.join(data.directory, 'saved.index'), path.join(data.directory, 'new.index'))
  fs.writeFileSync(path.join(f.root, 'other'), 'intervening staging\n')
  git(f.root, 'add', 'other')
  const intervening = state(f.root)
  assert.match(
    f.call(['recover', '--snapshot', s.snapshot], false).stderr,
    /intervening ref or index/,
  )
  assert.deepEqual(state(f.root), intervening)
  fs.copyFileSync(path.join(data.directory, 'old.index'), path.join(f.root, '.git', 'index'))
  fs.writeFileSync(path.join(f.root, '.git', 'index.lock'), 'unknown writer')
  assert.match(f.call(['recover', '--snapshot', s.snapshot], false).stderr, /Busy root index lock/)
  assert.equal(fs.readFileSync(path.join(f.root, '.git', 'index.lock'), 'utf8'), 'unknown writer')
  fs.unlinkSync(path.join(f.root, '.git', 'index.lock'))
  f.call(['recover', '--snapshot', s.snapshot])
  assert.match(git(f.root, 'show', 'HEAD:file'), /^OWN\n/)
  assert.equal(git(f.root, 'diff', '--', 'file'), '')
  assert.equal(fs.existsSync(path.join(f.root, '.git', 'agent-git-recovery.json')), false)
})
test('commit publishes additions, deletion, symlink and executable mode without rewriting live files', (t) => {
  const f = fixture(t)
  fs.unlinkSync(path.join(f.root, 'other'))
  fs.writeFileSync(path.join(f.root, 'added'), 'new content\n')
  fs.symlinkSync('added', path.join(f.root, 'link'))
  fs.chmodSync(path.join(f.root, 'file'), 0o755)
  git(f.root, 'add', '-A')
  const patch = path.join(f.root, '.git', 'delta.patch')
  fs.writeFileSync(patch, git(f.root, 'diff', '--cached', '--binary') + '\n')
  git(f.root, 'reset', '--mixed', 'HEAD')
  const s = JSON.parse(f.call(['prepare', '--patch', patch]).stdout)
  f.snapshots.push(s.snapshot)
  const bytes = fs.readFileSync(path.join(f.root, 'file'))
  f.call(['commit', '--snapshot', s.snapshot, '--message', 'paths'])
  assert.match(git(f.root, 'ls-tree', 'HEAD', 'file'), /^100755 /)
  assert.match(git(f.root, 'ls-tree', 'HEAD', 'link'), /^120000 /)
  assert.equal(git(f.root, 'show', 'HEAD:added'), 'new content')
  assert.equal(git(f.root, 'ls-tree', 'HEAD', 'other'), '')
  assert.equal(git(f.root, 'status', '--porcelain'), '')
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'file')), bytes)
  assert.equal(fs.readlinkSync(path.join(f.root, 'link')), 'added')
})
test('contradictory foreign staging refuses commit and preserves the complete root state', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const file = path.join(f.root, 'file')
  const own = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(file, own.replace('OWN\n', 'CONFLICT\n'))
  git(f.root, 'add', 'file')
  fs.writeFileSync(file, own)
  const before = state(f.root)
  assert.match(
    f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false).stderr,
    /merge-tree/,
  )
  assert.deepEqual(state(f.root), before)
})
test('land checks reject tracked and staged candidate drift', (t) => {
  for (const command of ['printf drift >> other', 'printf drift >> other && git add other']) {
    const f = fixture(t)
    const s = target(f)
    const before = state(f.root)
    assert.match(
      f.call(['land', '--snapshot', s.snapshot, '--check', command], false).stderr,
      /drifted/,
    )
    assert.deepEqual(state(f.root), before)
  }
})
test('unknown flags cannot silently skip requested checks and cleanup retains failed candidates', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  assert.match(
    f.call(['commit', '--snapshot', s.snapshot, '--message', 'own', '--checkk', 'false'], false)
      .stderr,
    /Unknown option/,
  )
  assert.match(f.call(['cleanup', '--snapshot', s.snapshot], false).stderr, /completed snapshot/)
  assert.ok(fs.existsSync(s.checkout))
})
test('recovery recognizes tool-owned locks left by a killed publisher', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const hook = path.join(f.root, '.git', 'hooks', 'reference-transaction')
  fs.writeFileSync(
    hook,
    '#!/bin/sh\ninput=$(cat)\ncase "$input" in\n *refs/heads/main*)\n  if test "$1" = committed; then\n   publisher=$(ps -o ppid= -p "$PPID" | tr -d " ")\n   kill -KILL "$publisher"\n  fi\n  ;;\nesac\n',
    { mode: 0o755 },
  )
  const result = f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false)
  assert.equal(result.signal, 'SIGKILL')
  assert.ok(fs.existsSync(path.join(f.root, '.git', 'agent-git.lock')))
  assert.ok(fs.existsSync(path.join(f.root, '.git', 'index.lock')))
  fs.unlinkSync(hook)
  f.call(['recover', '--snapshot', s.snapshot])
  assert.match(git(f.root, 'show', 'HEAD:file'), /^OWN\n/)
  assert.equal(git(f.root, 'diff', '--', 'file'), '')
  assert.equal(fs.existsSync(path.join(f.root, '.git', 'agent-git.lock')), false)
  assert.equal(fs.existsSync(path.join(f.root, '.git', 'index.lock')), false)
})
test('foreign staged rename cannot redirect candidate edits into another index path', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const file = path.join(f.root, 'file')
  const own = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(file, own.replace('OWN\n', 'own\n'))
  git(f.root, 'mv', 'file', 'renamed')
  fs.writeFileSync(file, own)
  const before = state(f.root)
  const renamed = fs.readFileSync(path.join(f.root, 'renamed'))
  const result = f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false)
  assert.match(result.stderr, /outside candidate paths/)
  assert.deepEqual(state(f.root), before)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'renamed')), renamed)
})
test('candidate hint flags cannot hide checked or hook-visible tracked drift', (t) => {
  for (const flag of ['--assume-unchanged', '--skip-worktree']) {
    const f = fixture(t)
    const s = f.prepare()
    const hook = path.join(f.root, '.git', 'hooks', 'pre-commit')
    fs.writeFileSync(hook, '#!/bin/sh\ntest "$(head -n 1 file)" = VALID\n', { mode: 0o755 })
    const before = state(f.root)
    const command = `git update-index ${flag} file && printf 'VALID\\n' > file`
    const result = f.call(
      ['commit', '--snapshot', s.snapshot, '--message', 'own', '--check', command],
      false,
    )
    assert.match(result.stderr, /drifted/)
    assert.deepEqual(state(f.root), before)
  }
})
test('recovery records its own native lock so a killed recovery can be retried', (t) => {
  const f = fixture(t)
  const s = f.prepare()
  const hook = path.join(f.root, '.git', 'hooks', 'reference-transaction')
  fs.writeFileSync(
    hook,
    '#!/bin/sh\ninput=$(cat)\ncase "$input" in\n *refs/heads/main*)\n  if test "$1" = prepared; then exit 1; fi\n  ;;\nesac\n',
    { mode: 0o755 },
  )
  assert.match(
    f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false).stderr,
    /recovery retained/,
  )
  fs.writeFileSync(
    hook,
    '#!/bin/sh\ninput=$(cat)\ncase "$input" in\n *refs/heads/main*)\n  if test "$1" = committed; then\n   publisher=$(ps -o ppid= -p "$PPID" | tr -d " ")\n   kill -KILL "$publisher"\n  fi\n  ;;\nesac\n',
    { mode: 0o755 },
  )
  assert.equal(f.call(['recover', '--snapshot', s.snapshot], false).signal, 'SIGKILL')
  fs.unlinkSync(hook)
  f.call(['recover', '--snapshot', s.snapshot])
  assert.equal(git(f.root, 'diff', '--', 'file'), '')
  assert.equal(fs.existsSync(path.join(f.root, '.git', 'index.lock')), false)
})
test('configured local commit hook cannot disappear in the isolated candidate', (t) => {
  const f = fixture(t)
  fs.mkdirSync(path.join(f.root, '.hooks'))
  fs.writeFileSync(path.join(f.root, '.hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n', {
    mode: 0o755,
  })
  git(f.root, 'config', 'core.hooksPath', '.hooks')
  const s = f.prepare()
  const before = state(f.root)
  const result = f.call(['commit', '--snapshot', s.snapshot, '--message', 'own'], false)
  assert.match(result.stderr, /Existing commit hook is unavailable/)
  assert.deepEqual(state(f.root), before)
})
