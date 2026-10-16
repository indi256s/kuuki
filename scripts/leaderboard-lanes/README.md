# Leaderboard lane generation

Run commands from the workspace root. The build inputs are the anatomy checkout
and checksum lock used by [Concorde](../concorde/README.md), plus the measured
fleet geometry in `packages/data/src/aircraft-geometry/*.json`.

Set up anatomy once:

```sh
mkdir -p .scratch/concorde
git clone https://github.com/wheresryan22/anatomy.git .scratch/concorde/anatomy
git -C .scratch/concorde/anatomy checkout --detach 0fad5b674b09b496d425c10f117c061dfd0c8bdc
```

The default kit is `.scratch/concorde/anatomy/kit`.
`ANATOMY_KIT=/path/to/anatomy/kit` accepts another copy of those exact inputs.
The shared verifier checks every file in `scripts/concorde/anatomy.lock.json`,
including transitive module imports, `iso.css` and the MIT license, before
importing kit code or writing output. Missing files or checksum mismatches fail
with setup guidance. Review source and generated output before updating the pin.

Generate the three-vehicle gate and measured fleet, then install their outputs:

```sh
node scripts/leaderboard-lanes/build.mjs
node scripts/leaderboard-lanes/fleet.mjs
node scripts/leaderboard-lanes/install.mjs
```

The first two commands write SVGs, CSS, metadata and standalone previews under
`.scratch/leaderboard-lanes/` (`gate/`, `gate.html`, `fleet/`, `fleet.html` and
`lines.html` and `fleet-lines.html`). The installer reads those gate and fleet files and replaces
the app's art, CSS and mapping in `apps/next/src/client/leaderboard/lanes/`; it
requires no anatomy installation. Run both generators before installing to
avoid mixing outputs from different inputs.

Add `--audit` to either generator to run geometry audits. Optional camera and
sampling inputs are `AZ`, `EL`, `K`, `LATHE_STEPS` and `DISC_STEPS`; `MASS` controls
fleet scale blending (default `0.5`). Keep the same camera inputs for both
commands. See the generator headers for geometry conventions.
