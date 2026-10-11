# Batch 2: shared-iso-renderer

Status: resolved

Scope and fixes: ../spec.md § Batch 2. Verification: ../spec.md § Verification.

## Comments

2026-10-11: done and checked in the main thread (renders + rbox code). Note for batch 3: fleet.ts:138 divides blur by k to cancel the double scaling; drop the *k at its call sites and this division. --iso-shadow has no Paint role yet.
