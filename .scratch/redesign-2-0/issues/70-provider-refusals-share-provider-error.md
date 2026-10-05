# Provider refusals of a corrupt or unsupported document surface as a generic provider error

Status: ready-for-agent
Owner task: import (T11 follow-up)
Source: rereview-T11-r2-sol.md finding M7 (provider part). Verified at feature/redesign-2.0 69be4b7.

## What is wrong
`functions/api/import/_provider.ts` classifies Gemini failures by numeric HTTP status only; every other refusal becomes `PROVIDER_ERROR` (`_provider.ts:34`). A member whose file the provider rejects as unreadable sees "recognition unavailable" instead of a file problem. The installed `@google/genai` 1.39.0 `ApiError` exposes only `status` and `message`, but `message` carries the serialized JSON error body, so structured `error.status` and `error.details[].reason` (for example `API_KEY_INVALID`) survive the SDK boundary.

## Expected behaviour
Parse the JSON envelope in `ApiError.message` when present. Map a reason that specifically identifies the uploaded document to the file error kind; keep configuration reasons (`API_KEY_INVALID`, region/permission) and anything ambiguous, including a bare `INVALID_ARGUMENT`, as `PROVIDER_ERROR`. Do not match human-readable message text.

## Acceptance check
Unit tests with synthetic SDK errors: a document-specific reason maps to the file kind; `API_KEY_INVALID`, a region refusal and a bare `INVALID_ARGUMENT` stay `PROVIDER_ERROR`; a non-JSON message stays `PROVIDER_ERROR`. If no document-specific reason exists in the provider's documented error catalogue, close this issue with that evidence linked.
