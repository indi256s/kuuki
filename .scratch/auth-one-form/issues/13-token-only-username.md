# Associate token-only activation with its email for password managers

Status: needs-triage
Type: task
Spec: [spec.md](../spec.md) — user story 44

## Carried gap

The isolated activation page receives a token and has no email metadata. Its hidden username is therefore empty. Reset can use a valid, user-typed same-origin session hint, but that hint is unavailable on another origin or device. Story 44's unconditional email association is not established for these visits.

## Decision needed

Choose a way to expose the email safely to a holder of a valid token while retaining the activation origin's restricted page/script/completion-API contract. The current implementation does not add a token-to-email endpoint, put email or credentials in a query string, store reset tokens, or infer email from an existing signed-in session.

## Acceptance for the follow-up

A real token-only visit associates the new password with the correct email; invalid/used tokens reveal no email; the token is scrubbed from the URL and remains out of persistent storage. The main card receives a safe email hint after saving without automatic sign-in. Include isolated-host gate and credential-leak checks with the selected design.
