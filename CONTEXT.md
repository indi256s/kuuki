# Kuuki — Domain Context (Glossary)

Ubiquitous language for the Kuuki project. Glossary only — no implementation
details, no plans. Started 2026-06-23 during the Phase 8 prod-login grilling.

## Auth & migration vocabulary

### Login enablement
Establishing a *usable* credential in a migrated account so it can authenticate.
The current flow confirms email ownership with a one-use activation link and
lets the account owner choose a personal password, preserving the original ID.
**Not** the same as Password reset.

### Password reset (flow)
A self-serve "forgot password → prove identity → set a new password" flow.
Remains outside the current remediation scope for already activated accounts.
Cloudflare Email Sending supports migrated-account activation; that flow does
not provide general password recovery.

### Migrated account
One of the 26 `users` rows ported from the old Supabase backend. Owns
flights / visits / stats / badges keyed by `user_id`. Its original Supabase
password is **unrecoverable** (bcrypt hashes were not in the export).

### RESET_REQUIRED sentinel
A deliberately *structurally-invalid* value for `password_hash` (it contains no
`$`, so `verifyPassword` bails before any crypto). Marks an account as
intentionally **un-loginnable** until a real credential is seeded. The default
state of every migrated account.

### Pepper (AUTH_SECRET coupling)
Every password hash is `HMAC-SHA256(AUTH_SECRET, password)` *before* PBKDF2.
Consequence: a stored hash only verifies under the **same** AUTH_SECRET that
made it. A hash made with a different secret silently fails at sign-in.

### Verification account
A disposable account used to verify activation and sign-in. Staging checks use
synthetic accounts and personal test credentials. Production legacy accounts
remain on the RESET_REQUIRED sentinel until their owners activate them.
