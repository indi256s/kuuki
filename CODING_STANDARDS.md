# Coding standards for review

Apply these when reviewing a diff. ESLint, the pre-commit hook and CI enforce the mechanical rules. These are the judgement calls they cannot check.

1. **Contract coverage.** Each ADR clause, plan acceptance item or design-brief rule that the diff implements has a test that goes red if the clause breaks. A test that would stay green against the old behaviour does not count.
2. **Carried gaps.** A gap handed to a later task becomes a failing test or an issue file under `.scratch/`, not only a ledger note.
3. **Gate before read.** Auth, ownership and visibility checks run before any private read. A guest gets a redirect status, not a streamed 200.
4. **Canonical fields win.** In error envelopes and DTOs, spread optional details first and the canonical fields (`error`, `code`, ids, states) after.
5. **Historical data.** Repair and derivation code tolerates malformed legacy rows: it skips and reports them without throwing. Migrations are additive and preserve historical passport evidence.
6. **States and copy.** UI diffs follow `DESIGN.md` "Interaction and states": loading, empty, partial, error and ready stay distinct. Every user-visible string has EN and RU copy, with real plural forms and «вы».
7. **Docs match config.** Runbook and ADR statements about flags, bindings and environments match the checked-in `wrangler.toml` files and workflows.
