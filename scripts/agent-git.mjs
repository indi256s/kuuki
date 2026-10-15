#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
)
const usage = `agent-git prepare (--patch FILE [--base SHA] | --target SHA)
agent-git commit --snapshot FILE --message TEXT [--check COMMAND]
agent-git land --snapshot FILE --check COMMAND
agent-git recover --snapshot FILE
agent-git cleanup --snapshot FILE`
const [command, ...args] = process.argv.slice(2)
const allowed = {
  prepare: ['patch', 'base', 'target'],
  commit: ['snapshot', 'message', 'check'],
  land: ['snapshot', 'check'],
  recover: ['snapshot'],
  cleanup: ['snapshot'],
}
const options = {}
function parseOptions() {
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || !args[i + 1]) throw new Error(usage)
    if (!allowed[command]?.includes(args[i].slice(2))) throw new Error('Unknown option: ' + args[i])
    if (options[args[i].slice(2)]) throw new Error('Duplicate option')
    options[args[i].slice(2)] = args[i + 1]
  }
}
function run(cwd, argv, env = {}, input) {
  const result = spawnSync('git', argv, {
    cwd,
    env: { ...cleanEnv, GIT_OPTIONAL_LOCKS: '0', ...env },
    input,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(`git ${argv[0]}: ${result.stderr.toString().trim()}`)
  return result.stdout
}
const git = (cwd, argv, env, input) => run(cwd, argv, env, input).toString().trim()
const write = (file, data) => {
  const temporary = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  fs.renameSync(temporary, file)
}
const exists = (file) => fs.existsSync(file)
function context(cwd) {
  const root = git(cwd, ['rev-parse', '--show-toplevel'])
  return {
    root,
    common: git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
    index: git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']),
    branch: git(root, ['symbolic-ref', 'HEAD']),
    base: git(root, ['rev-parse', 'HEAD']),
  }
}
function snapshot() {
  if (!options.snapshot) throw new Error('--snapshot required')
  const file = path.resolve(options.snapshot)
  const s = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (
    s.version !== 1 ||
    file !== path.join(s.directory, 'manifest.json') ||
    fs.readFileSync(path.join(s.directory, 'owner'), 'utf8') !== s.directory ||
    path.dirname(s.checkout) !== s.directory
  )
    throw new Error('Not a tool-owned snapshot')
  if (
    path.dirname(s.directory) !== fs.realpathSync(os.tmpdir()) ||
    !path.basename(s.directory).startsWith('kuuki-agent-git-') ||
    fs.realpathSync(s.directory) !== s.directory
  )
    throw new Error('Snapshot directory is not tool-owned temporary storage')
  if (git(s.checkout, ['rev-parse', '--show-toplevel']) !== s.checkout)
    throw new Error('Snapshot checkout identity changed')
  const c = context(s.root)
  if (c.common !== s.common) throw new Error('Repository identity changed')
  const worktrees = run(s.root, ['worktree', 'list', '--porcelain', '-z']).toString().split('\0')
  if (!worktrees.includes(`worktree ${s.checkout}`))
    throw new Error('Snapshot worktree registration missing')
  return { ...s, file, index: c.index }
}
function locked(s, action) {
  const lock = path.join(s.common, 'agent-git.lock')
  let fd
  clearStaleLock(s, lock, 'cooperative')
  try {
    fd = fs.openSync(lock, 'wx', 0o600)
  } catch {
    throw new Error(`Busy cooperative lock: ${lock}`)
  }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, snapshot: s.file }))
  try {
    return action()
  } finally {
    fs.closeSync(fd)
    fs.unlinkSync(lock)
  }
}
const guard = (s) => path.join(s.common, 'agent-git-recovery.json')
function expected(s) {
  const c = context(s.root)
  if (c.branch !== s.branch || c.base !== s.base) throw new Error('Stale root HEAD or branch')
  if (exists(guard(s))) throw new Error(`Pending recovery: ${guard(s)}`)
}
function admit(s) {
  const symbolic = spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], {
    cwd: s.checkout,
    env: cleanEnv,
  })
  if (symbolic.status !== 1) throw new Error('Candidate must remain detached')
  const expectedHead = s.candidate ?? s.target
  if (git(s.checkout, ['rev-parse', 'HEAD']) !== expectedHead)
    throw new Error('Candidate HEAD drifted')
  if (
    git(s.checkout, ['write-tree']) !== s.tree ||
    run(s.checkout, ['diff', '--name-only', '-z']).length
  )
    throw new Error('Candidate tracked files or index drifted')
  const index = path.join(s.directory, 'verification.index')
  fs.rmSync(index, { force: true })
  const env = { GIT_INDEX_FILE: index }
  git(
    s.checkout,
    ['-c', 'core.sparseCheckout=false', '-c', 'core.ignorestat=false', 'read-tree', s.tree],
    env,
  )
  git(s.checkout, ['-c', 'core.filemode=true', 'add', '-u', '--'], env)
  if (git(s.checkout, ['write-tree'], env) !== s.tree)
    throw new Error('Candidate tracked files drifted behind index hints')
}
function check(s) {
  admit(s)
  if (options.check) {
    const result = spawnSync(options.check, {
      cwd: s.checkout,
      shell: true,
      env: cleanEnv,
      maxBuffer: 64 * 1024 * 1024,
    })
    fs.writeFileSync(
      path.join(s.directory, 'check.log'),
      Buffer.concat([result.stdout, result.stderr]),
    )
    if (result.status !== 0) throw new Error(`Check failed; log: ${s.directory}/check.log`)
  }
  admit(s)
}
const changed = (s) =>
  run(s.root, [
    'diff-tree',
    '--no-renames',
    '--no-commit-id',
    '--name-only',
    '-r',
    '-z',
    s.base,
    s.tree,
  ])
    .toString()
    .split('\0')
    .filter(Boolean)
function merge(s, a, b) {
  return git(s.root, ['merge-tree', '--write-tree', `--merge-base=${s.base}`, a, b]).split('\n')[0]
}
function treeCommit(s, tree) {
  return git(s.root, ['commit-tree', tree, '-p', s.base], {}, 'agent-git temporary tree\n')
}
function live(s) {
  const index = path.join(s.directory, 'live.index')
  fs.rmSync(index, { force: true })
  const env = { GIT_INDEX_FILE: index }
  git(s.root, ['read-tree', s.base], env)
  const paths = changed(s)
  if (paths.length) git(s.root, ['--literal-pathspecs', 'add', '-A', '--', ...paths], env)
  const tree = git(s.root, ['write-tree'], env)
  if (merge(s, treeCommit(s, s.tree), treeCommit(s, tree)) !== tree)
    throw new Error('Candidate changes are absent or conflicting in live root files')
  return tree
}
function clearStaleLock(s, lock, kind) {
  if (command !== 'recover' || !exists(lock)) return
  let owner
  try {
    owner =
      kind === 'cooperative'
        ? JSON.parse(fs.readFileSync(lock, 'utf8'))
        : JSON.parse(fs.readFileSync(guard(s), 'utf8')).indexLock
    if (owner.snapshot !== s.file || !Number.isInteger(owner.pid) || owner.pid <= 0) return
    try {
      process.kill(owner.pid, 0)
      return
    } catch (error) {
      if (error.code !== 'ESRCH') return
    }
    const stat = fs.statSync(lock)
    if (kind === 'index' && (stat.ino !== owner.ino || stat.dev !== owner.dev)) return
    fs.unlinkSync(lock)
  } catch {
    /* Unknown locks require manual diagnosis. */
  }
}
function indexLock(s, action) {
  const lock = `${s.index}.lock`
  let fd
  clearStaleLock(s, lock, 'index')
  try {
    fd = fs.openSync(lock, 'wx', 0o600)
  } catch {
    throw new Error(`Busy root index lock: ${lock}`)
  }
  try {
    return action(lock)
  } finally {
    fs.closeSync(fd)
    if (exists(lock)) fs.unlinkSync(lock)
  }
}
function publish(s, recovery, lock) {
  const current = context(s.root)
  const bytes = fs.readFileSync(s.index)
  const old = fs.readFileSync(recovery.oldIndex)
  const next = fs.readFileSync(recovery.newIndex)
  if (
    current.branch !== s.branch ||
    ![s.base, recovery.commit].includes(current.base) ||
    (!bytes.equals(old) && !bytes.equals(next)) ||
    (current.base === s.base && !bytes.equals(old))
  )
    throw new Error('Recovery refuses intervening ref or index changes')
  if (live(s) !== recovery.liveTree)
    throw new Error('Recovery refuses intervening live candidate-path changes')
  if (current.base === s.base) git(s.root, ['update-ref', s.branch, recovery.commit, s.base])
  fs.copyFileSync(recovery.newIndex, lock)
  fs.renameSync(lock, s.index)
  write(path.join(s.directory, 'completed.json'), { head: recovery.commit })
  fs.unlinkSync(guard(s))
}
function prepare() {
  if (options.target && options.base) throw new Error('--base is only valid with --patch')
  if (Boolean(options.patch) === Boolean(options.target)) throw new Error(usage)
  const c = context(process.cwd())
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kuuki-agent-git-')))
  fs.chmodSync(directory, 0o700)
  const s = {
    version: 1,
    ...c,
    directory,
    checkout: path.join(directory, 'checkout'),
    kind: options.patch ? 'patch' : 'target',
  }
  fs.writeFileSync(path.join(directory, 'owner'), directory)
  if (options.base && git(c.root, ['rev-parse', `${options.base}^{commit}`]) !== c.base)
    throw new Error('--base must equal current HEAD')
  const target = options.target ? git(c.root, ['rev-parse', `${options.target}^{commit}`]) : c.base
  if (options.target) git(c.root, ['merge-base', '--is-ancestor', c.base, target])
  git(c.root, ['worktree', 'add', '--detach', s.checkout, target])
  s.target = target
  s.tree = git(s.checkout, ['write-tree'])
  write(path.join(directory, 'manifest.json'), s)
  if (options.patch) {
    fs.copyFileSync(path.resolve(options.patch), path.join(directory, 'patch'))
    try {
      git(s.checkout, ['apply', '--index', path.join(directory, 'patch')])
    } catch (error) {
      throw new Error(`${error.message}; failed preparation retained: ${directory}/manifest.json`)
    }
  }
  s.tree = git(s.checkout, ['write-tree'])
  s.target = target
  write(path.join(directory, 'manifest.json'), s)
  return { snapshot: path.join(directory, 'manifest.json'), checkout: s.checkout, tree: s.tree }
}
function commit(s) {
  if (s.kind !== 'patch' || !options.message)
    throw new Error('commit requires a patch snapshot and --message')
  expected(s)
  check(s)
  const hooksResult = spawnSync('git', ['config', '--path', '--get', 'core.hooksPath'], {
    cwd: s.root,
    env: cleanEnv,
  })
  const hooks = hooksResult.stdout.toString().trim()
  const hookPath = hooks ? path.resolve(s.checkout, hooks) : path.join(s.common, 'hooks')
  const rootHookPath = hooks ? path.resolve(s.root, hooks) : path.join(s.common, 'hooks')
  const executable = (file) => {
    try {
      fs.accessSync(file, fs.constants.X_OK)
      return true
    } catch {
      return false
    }
  }
  for (const name of [
    'pre-commit',
    'prepare-commit-msg',
    'commit-msg',
    'post-commit',
    'post-rewrite',
    'reference-transaction',
  ]) {
    if (executable(path.join(rootHookPath, name)) && !executable(path.join(hookPath, name)))
      throw new Error(
        `Existing commit hook is unavailable in candidate: ${name}; install the candidate's hooks before retrying`,
      )
  }
  const hookLog = path.join(s.directory, 'hook.log')
  const result = spawnSync(
    'git',
    [
      '-c',
      `core.hooksPath=${hookPath}`,
      'commit',
      ...(s.candidate ? ['--amend'] : []),
      '-m',
      options.message,
    ],
    { cwd: s.checkout, env: cleanEnv, maxBuffer: 64 * 1024 * 1024 },
  )
  fs.writeFileSync(
    hookLog,
    Buffer.concat([result.stdout ?? Buffer.alloc(0), result.stderr ?? Buffer.alloc(0)]),
  )
  if (result.status !== 0) throw new Error(`Candidate commit or hook failed; log: ${hookLog}`)
  const candidate = git(s.checkout, ['rev-parse', 'HEAD'])
  s.candidate = candidate
  admit(s)
  if (
    git(s.checkout, ['rev-parse', 'HEAD^{tree}']) !== s.tree ||
    git(s.checkout, ['rev-parse', 'HEAD^']) !== s.base
  )
    throw new Error('Hook changed candidate commit')
  write(s.file, { ...JSON.parse(fs.readFileSync(s.file, 'utf8')), candidate })
  return locked(s, () =>
    indexLock(s, (lock) => {
      expected(s)
      const oldIndex = path.join(s.directory, 'old.index')
      const newIndex = path.join(s.directory, 'new.index')
      fs.copyFileSync(s.index, oldIndex)
      fs.copyFileSync(s.index, newIndex)
      const env = { GIT_INDEX_FILE: newIndex }
      const indexTree = git(s.root, ['write-tree'], env)
      const merged = merge(s, candidate, treeCommit(s, indexTree))
      const candidatePaths = new Set(changed(s))
      const mergePaths = run(s.root, [
        'diff-tree',
        '--no-renames',
        '--no-commit-id',
        '--name-only',
        '-r',
        '-z',
        indexTree,
        merged,
      ])
        .toString()
        .split('\0')
        .filter(Boolean)
      if (mergePaths.some((file) => !candidatePaths.has(file)))
        throw new Error(
          'Foreign staging redirects changes outside candidate paths; coordinate manual integration',
        )
      const entries = run(s.root, ['ls-tree', '-r', '-z', merged])
        .toString()
        .split('\0')
        .filter(Boolean)
      const map = new Map(
        entries.map((entry) => [
          entry.slice(entry.indexOf('\t') + 1),
          entry.slice(0, entry.indexOf('\t')).split(' '),
        ]),
      )
      const records = changed(s)
        .map((file) => {
          const entry = map.get(file)
          return entry
            ? `${entry[0]} ${entry[2]}\t${file}\0`
            : `0 ${'0'.repeat(s.base.length)}\t${file}\0`
        })
        .join('')
      git(s.root, ['update-index', '-z', '--index-info'], env, records)
      if (git(s.root, ['write-tree'], env) !== merged)
        throw new Error('Scoped index update does not match merged candidate tree')
      const lockStat = fs.statSync(lock)
      const recovery = {
        snapshot: s.file,
        commit: candidate,
        oldIndex,
        newIndex,
        liveTree: live(s),
        indexLock: { pid: process.pid, snapshot: s.file, ino: lockStat.ino, dev: lockStat.dev },
      }
      write(path.join(s.directory, 'recovery.json'), recovery)
      write(guard(s), recovery)
      try {
        publish(s, recovery, lock)
      } catch (error) {
        throw new Error(
          `${error.message}; recovery retained: ${guard(s)}; run agent-git recover --snapshot ${s.file}`,
        )
      }
      return { commit: candidate, snapshot: s.file }
    }),
  )
}
function land(s) {
  if (s.kind !== 'target' || !options.check)
    throw new Error('land requires a target snapshot and --check')
  expected(s)
  check(s)
  if (git(s.checkout, ['rev-parse', 'HEAD']) !== s.target) throw new Error('Candidate HEAD drifted')
  return locked(s, () => {
    expected(s)
    git(s.root, ['merge-base', '--is-ancestor', s.base, s.target])
    const incoming = changed(s)
    const dirty = [
      run(s.root, ['diff', '--name-only', '-z']),
      run(s.root, ['diff', '--cached', '--name-only', '-z']),
      run(s.root, ['ls-files', '--others', '--exclude-standard', '-z']),
      run(s.root, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z']),
    ]
      .map((buffer) => buffer.toString())
      .join('')
    const paths = dirty.split('\0').filter(Boolean)
    if (
      incoming.some((a) =>
        paths.some((b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)),
      )
    )
      throw new Error('Incoming paths overlap staged, unstaged or untracked work')
    git(s.root, ['merge', '--ff-only', '--no-overwrite-ignore', s.target])
    write(path.join(s.directory, 'completed.json'), { head: s.target })
    return { head: s.target }
  })
}
try {
  parseOptions()
  let result
  if (command === 'prepare') result = prepare()
  else if (command === '--help' || command === 'help' || !command) result = { usage }
  else {
    const s = snapshot()
    if (command === 'commit') result = commit(s)
    else if (command === 'land') result = land(s)
    else if (command === 'recover')
      result = locked(s, () =>
        indexLock(s, (lock) => {
          const recovery = JSON.parse(fs.readFileSync(guard(s), 'utf8'))
          if (recovery.snapshot !== s.file) throw new Error('Recovery belongs to another snapshot')
          const stat = fs.statSync(lock)
          recovery.indexLock = { pid: process.pid, snapshot: s.file, ino: stat.ino, dev: stat.dev }
          write(path.join(s.directory, 'recovery.json'), recovery)
          write(guard(s), recovery)
          publish(s, recovery, lock)
          return { recovered: recovery.commit }
        }),
      )
    else if (command === 'cleanup') {
      if (exists(guard(s))) throw new Error('Resolve pending recovery before cleanup')
      if (!exists(path.join(s.directory, 'completed.json')))
        throw new Error(
          'Cleanup requires a completed snapshot; retain failed candidates for inspection',
        )
      admit(s)
      const completed = JSON.parse(
        fs.readFileSync(path.join(s.directory, 'completed.json'), 'utf8'),
      )
      if (git(s.checkout, ['rev-parse', 'HEAD']) !== completed.head)
        throw new Error('Completed checkout HEAD drifted')
      git(s.root, ['worktree', 'remove', '--force', s.checkout])
      fs.rmSync(s.directory, { recursive: true })
      result = { cleaned: s.directory }
    } else throw new Error(usage)
  }
  process.stdout.write(JSON.stringify(result) + '\n')
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
