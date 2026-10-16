# Concorde generation

The checked-in sign-in figure needs no anatomy installation at runtime. To
regenerate it, run these commands from the workspace root:

```sh
mkdir -p .scratch/concorde
git clone https://github.com/wheresryan22/anatomy.git .scratch/concorde/anatomy
git -C .scratch/concorde/anatomy checkout --detach 0fad5b674b09b496d425c10f117c061dfd0c8bdc
pnpm generate:concorde
pnpm generate:concorde --preview
pnpm generate:concorde --preview --light
```

The public source is [anatomy at commit
0fad5b674b09b496d425c10f117c061dfd0c8bdc](https://github.com/wheresryan22/anatomy/tree/0fad5b674b09b496d425c10f117c061dfd0c8bdc),
licensed under MIT, copyright 2026 Ryan. `anatomy.lock.json` records SHA-256
hashes for all consumed kit files, transitive imports and the licence. The
shared `verify-kit.mjs` verifier checks them before executing kit code or
overwriting outputs.
`ANATOMY_KIT=/path/to/anatomy/kit` accepts another installation of the same
pinned files. Updating anatomy requires reviewing the new source and generated
output, then updating the commit and hashes together.

The generator writes the four `*.generated.*` files under
`apps/next/src/client/auth-card/concorde`. Preview pages go to
`.scratch/concorde/concorde.html` and `concorde-light.html`; the driver is tracked
in `preview.js`. Neither preview requires a pre-existing scratch driver. The
preview discards turn diagnostics after each frame, like the production adapter.

For geometry audits, use `pnpm generate:concorde --audit`; add `--quick` for a
shorter orbit audit. These audits can take longer than ordinary generation.

After setup, verify generation and preview creation in an empty temporary output
tree, plus rejection of modified kit files before output changes:

```sh
node --test scripts/concorde/generate.test.mjs
```

The onboarding passport bench uses this same pin and setup. Regenerate it with
`pnpm generate:passport-bench`; its SVG, scoped kit CSS and MIT geometry runtime
are checked in under `apps/next/src/client/welcome/passport`. The live layer
loads on desktop after hydration, while phones keep the compact passport strip.
