# Replayed import submission ignores the source

Status: wontfix
Owner task: T10 (closed)
Source: progress.md:159, :166 (T10 review M4, parked as intended); verified at af92d26

## Behaviour
`functions/api/_services/importJob.ts:46-52` looks up the batch by `(user_id, submissionOperationId)` and returns the stored batch without comparing the new payload. A different file or text under the same operation id gets the first batch back. It is tested: `functions/test/import-drafts.test.ts:53-66` sends `content: 'different text, same operation'` and expects the same batch and one provider call.

## Reason for wontfix
The id means "this submission", and a retry after a lost response must not start a second provider call or a second batch. The batch stores only `source_type` and `source_label` (migration 0007), no source digest, because raw input is never persisted. There is nothing to compare against without storing a hash of user documents. Unlike the flights ledger, a mismatch cannot lose data: at worst the user sees the first batch, which they can discard (terminal batches are kept at most 30 days).

## Reopen if
Clients start reusing operation ids across different sources, or a source digest is added to batches for another reason.
