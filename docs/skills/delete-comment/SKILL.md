---
name: delete-comment
description: Sweep code comments out of Kuuki source. Classify each one, move decisions into ADRs and hacks into issues, strip the rest and ratchet the comment baseline down. Use for /delete-comment, a comment cleanup, or when `pnpm lint:comments` fails.
---

# Delete comments

Kuuki bans code comments. `node scripts/comments.mjs check` (part of `pnpm lint` and the pre-commit hook) fails when a file has more comments than `scripts/comment-baseline.json` allows. It and `pnpm comments:ratchet` count the staged content (the Git index), so another owner's unstaged or untracked edits never block a commit; stage your files before ratcheting. New files start at zero. The baseline only goes down.

Tool directives are not comments and stay: `oxlint-disable…`, `eslint-…`, `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`, `/// <reference`, `@vitest-environment`, `@jsx…`, `#__PURE__`, `webpack…`, `@vite-ignore`, `prettier-ignore`, `oxfmt-ignore`, `c8`/`istanbul`/`v8 ignore`, `#region`, `@license`, `/*!`, and verbatim `Copyright (c)` notices on adapted third-party code. `DIRECTIVE` in `scripts/comments.mjs` owns that list.

Scope: JS, TS and CSS under `apps/next`, `functions`, `packages`, `workers`, `scripts` and `db/scripts`, minus generated files and `apps/next/public`. Shell, TOML, YAML and SQL migrations are out of scope.

## Input

A path, a list of files, or nothing for every file in the baseline. In a shared checkout, skip files with another owner's uncommitted changes (`git diff --name-only`). They stay in the baseline for a later sweep. Also skip files whose source text a generator hashes, unless you mean to regenerate and ship its artifacts: `generatorCodeSha256` in `scripts/airport-models/prepare.ts` hashes four files, so stripping them fails `pnpm airport-models:check`.

## Steps

1. **List.** `node scripts/comments.mjs list <files> > <scratch>/inventory.jsonl` writes one JSON row per comment: file, line, text and surrounding code. With no files it lists everything in scope. Consecutive `//` lines are separate rows, so read them as one comment.
2. **Classify** every row:
   - **Tautology:** repeats what the names, types or code already say. Delete.
   - **Stale:** refers to code, files, tools or behaviour that no longer exist. Grep before calling it stale. Delete.
   - **Excuse:** justifies a hack, shortcut or "for now" (TODO, FIXME, "keep in sync with", swallowed errors, fudge numbers). Delete, and file an issue.
   - **Decision record:** a non-obvious decision the code can't express, where deleting it would likely cause a regression or a wrong redesign (external bug workarounds, browser quirks, security or privacy boundaries, ordering invariants, data contracts, performance reasons, domain rules). Delete, and move it into an ADR.
     An unavoidable external workaround with no better fix is a decision record, not an excuse. Most comments are tautologies. Hold decision records to a high bar.
3. **Record before deleting.**
   - Decision records: append to the ADR that already owns the area in `docs/adr/`. Otherwise append to the code-decisions ADR for its path: 0009 server (`functions`, `workers`, `db/scripts`), 0010 `packages` and `scripts`, 0011 app shell, UI, `lib` and runtime, 0012 import, onboarding and ground, 0013 overview, journal, leaderboard and maps, 0014 passport, profile and account. Each entry names the symbol and file it applies to and states the decision with its reason, so it reads without the code beside it.
   - Excuses: one file per hack at `.scratch/comment-debt/issues/NN-slug.md` (see `docs/agents/issue-tracker.md`), with `Status: needs-triage`, the file and symbol, the original comment, what is hacky and the proper fix.
4. **Strip.** `node scripts/comments.mjs strip <files>`, then `pnpm exec oxfmt <files>`. It removes whole-line comments with their line, trailing comments, inline block comments and JSX `{/* … */}` with its braces, and leaves directives, strings, regexes and JSX text alone. A strip that leaves an empty `catch {}` has removed the only reason the failure was safe to ignore; add the location to `.scratch/comment-debt/issues/31-name-ignored-failures-in-empty-catches.md`.
5. **Ratchet.** `pnpm comments:ratchet` lowers the baseline to the new counts and drops files that reach zero. Then run `pnpm lint:comments`.
6. **Verify.** `pnpm airport-models:check`, `pnpm check:airport-catalog`, `pnpm typecheck`, `pnpm typecheck:api`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `node --test scripts/comments.test.mjs` if you touched the tool.

## When `lint:comments` fails

- **"N comments, M allowed":** a comment was added. Express the intent in code (a name, a type, a small function, a test), or record it as in step 3 and delete it.
- **"fewer comments than the baseline":** someone deleted comments. Run `pnpm comments:ratchet` and commit the baseline.

Never raise a count in `scripts/comment-baseline.json` to make the check pass.
