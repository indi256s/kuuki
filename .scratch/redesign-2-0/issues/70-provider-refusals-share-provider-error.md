# Provider refusals of a corrupt or unsupported document surface as a generic provider error

Status: resolved
Owner task: import (T11 follow-up)
Source: rereview-T11-r2-sol.md finding M7 (provider part). Verified at feature/redesign-2.0 69be4b7.

## What is wrong
`functions/api/import/_provider.ts` classifies Gemini failures by numeric HTTP status only; every other refusal becomes `PROVIDER_ERROR` (`_provider.ts:34`). A member whose file the provider rejects as unreadable sees "recognition unavailable" instead of a file problem. The installed `@google/genai` 1.39.0 `ApiError` exposes only `status` and `message`, but `message` carries the serialized JSON error body, so structured `error.status` and `error.details[].reason` (for example `API_KEY_INVALID`) survive the SDK boundary.

## Expected behaviour
Parse the JSON envelope in `ApiError.message` when present. Map a reason that specifically identifies the uploaded document to the file error kind; keep configuration reasons (`API_KEY_INVALID`, region/permission) and anything ambiguous, including a bare `INVALID_ARGUMENT`, as `PROVIDER_ERROR`. Do not match human-readable message text.

## Acceptance check
Unit tests with synthetic SDK errors: a document-specific reason maps to the file kind; `API_KEY_INVALID`, a region refusal and a bare `INVALID_ARGUMENT` stay `PROVIDER_ERROR`; a non-JSON message stays `PROVIDER_ERROR`. If no document-specific reason exists in the provider's documented error catalogue, close this issue with that evidence linked.

## Continuation disposition — 2026-10-05

8d95a75 preserves structured configuration errors and verifies generic fallbacks. Installed SDK refusal enums identify safety/content policy, not a documented corrupt/unsupported-document reason; those must not be mislabeled INVALID_FILE. A supported document-specific provider reason/catalogue remains unverified, so the requested classifier is not claimed complete.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06

No code change to the classifier. Current provider documentation does not define a structured reason or status that identifies an unreadable, corrupt or unsupported uploaded document:
- https://ai.google.dev/gemini-api/docs/api-errors lists only request-level codes (`invalid_request`, `failed_precondition`, `authentication`, `permission_denied`, `not_found`, ...), policy block codes (`safety`, `recitation`, `language`, `prohibited_content`, `spii`, `blocklist`, `content_blocked`, ...) and generation error codes (`malformed_function_call`, `no_image`, ...). That page documents the Interactions API format; none of its entries concern an invalid file.
- https://ai.google.dev/gemini-api/docs/troubleshooting no longer carries an error table and points to the page above.
- https://google.aip.dev/193 only defines the `ErrorInfo.reason` format (`[A-Z][A-Z0-9_]+[A-Z0-9]`) and gives no catalogue; `google/rpc/error_details.proto` likewise lists none.
- Installed `@google/genai` 1.39.0 (`pnpm-lock.yaml`): `ApiError` carries only `status` and `message`; refusal enums cover safety and content policy.
Matching message text is excluded by the issue, so a bare 400 `INVALID_ARGUMENT` stays `PROVIDER_ERROR`. Existing tests already cover `API_KEY_INVALID`, `LOCATION_POLICY_VIOLATED`, bare `INVALID_ARGUMENT` and an unknown reason; added a guard test for a non-JSON 400 message in `functions/test/import-provider.test.ts`. Revisit if Google documents a file-specific reason.

Commit: 9e02904 (guard test, this record). Checks run on that tree: `pnpm typecheck:api` pass; `functions/test/import-provider.test.ts` 26/26 pass; `pnpm test:api` 44 files / 500 tests pass.
