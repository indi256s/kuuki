# Haiku enrichment API contract

Checked 13 October 2026. Read-only documentation research: Context7 `/websites/platform_claude_en_api`, followed by official Anthropic pages. No paid API calls, entitlement checks or production mutations. Recommendations below describe a fetch-based adapter for reviewable suggestions, not automatic source admission.

## Model and request

Use the fixed model ID `claude-haiku-5-5`. It has a 1M-token context and 128K maximum output; these are capacity limits, not sensible enrichment budgets. [Model overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

Send `thinking: {"type":"disabled"}` and `output_config: {"effort":"low"}` in both stages. Disabled thinking is accepted only at effort `high` or below; `xhigh`/`max` and changing per-message effort while thinking is disabled cause 400 errors. [Thinking troubleshooting](https://platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting).

Omit `temperature`, `top_p`, `top_k` and assistant prefilling. Select response blocks by `type`, never assume the first block is the answer. [Migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide).

Use native `fetch` to `https://api.anthropic.com/v1/messages`, with JSON body and headers:

```text
Authorization: Bearer <ANTHROPIC_API_KEY>
anthropic-version: 2023-06-01
content-type: application/json
anthropic-workspace-id: <ANTHROPIC_WORKSPACE_ID, when required>
```

Workspace-scoped keys can omit the workspace header. Identity-backed keys without a workspace scope require it. Production services should use a service-account identity; a personal key acts as its owner. [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication).

Local inspection found `ANTHROPIC_API_KEY` present in `.dev.vars`, absent in the shell environment. Its value, scope, expiry and entitlements were not inspected or sent anywhere. Existing `functions/env.d.ts` had no Anthropic binding at inspection. Add server-only optional bindings rather than exposing a credential through client configuration.

## Two stages

Discovery uses cited freeform output and these basic server tools:

```json
[
  { "type": "web_search_20250305", "name": "web_search", "max_uses": 2 },
  {
    "type": "web_fetch_20250910",
    "name": "web_fetch",
    "max_uses": 2,
    "max_content_tokens": 4000,
    "citations": { "enabled": true }
  }
]
```

Search citations are enabled automatically. Search results use `web_search_tool_result`, matched to `server_tool_use.id` by `tool_use_id`. Successful result entries contain `url`, `title`, `encrypted_content` and `page_age`. Text citations use `web_search_result_location` with `url`, `title`, `encrypted_index`, `cited_text`. Do not treat `page_age` as flight date. [Web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).

Fetch citations require explicit enablement. `web_fetch_tool_result.content` is either an error or `{type:"web_fetch_result",url,content:document,retrieved_at}`. Text documents have `source:{type:"text",media_type:"text/plain",data}` and optional `title`; PDF sources can be base64. Fetch cannot freely invent URLs: permitted URLs must have appeared in prior context. `max_content_tokens` is approximate and does not bound binary PDFs. [Web fetch](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool).

Extraction starts a fresh request with no tools and no citation-enabled documents. Pass only small, tool-attested packets as ordinary text, including packet IDs, original flight IDs, URLs and literal excerpts. The adapter uses low effort and requests plain JSON, then validates its shape in code. `output_config.format` is omitted; a future schema would need live verification before replacing that contract. Return rows referencing existing packet IDs and literal `evidence_quote`; do not let the extraction stage mint URLs or sources. Citation-enabled content and strict JSON output are incompatible and return 400. [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

## Provenance normalization

Document citations can be `char_location`, `page_location` or `content_block_location`. Each contains `document_index` and `cited_text`. Indexes are zero-based across document content blocks spanning request messages; character and content-block end indexes are exclusive, PDF page indexes start at one. Citations belong to individual text blocks. [Citations](https://platform.claude.com/docs/en/build-with-claude/citations).

The fetch guide illustrates index zero for one fetched document but does not establish a general multi-fetch/continuation insertion-order guarantee. Treat this as an unresolved mapping detail, not a license to map every citation to the latest URL.

Recommended deterministic rules:

1. Search packets require a citation URL matching a successful tool-returned search URL. Preserve the citation's literal `cited_text` and its containing text-block position.
2. Fetch packets require successful text documents. Resolve `cited_text` against their `source.data`; require exactly one matching source URL. When using a constructed document order, also cross-check the proposed index. Reject title-only, ambiguous or out-of-range mappings. Reject PDF citations until PDF document mapping is implemented explicitly.
3. Keep each packet separate. Extraction must select an existing packet and a nonempty quote literally contained in that packet; never stitch pieces from multiple packets into a supposedly verbatim quote.
4. Validate each flight independently: calendar departure date, IATA origin/destination and full carrier plus flight number must match evidence. Permit codeshare mapping only when the same dated source explicitly connects marketing and operating numbers. Prefix normalization must not duplicate the carrier. Missing numbers, corrupted values, route conflicts and future actual claims remain unknown.
5. Require the quoted evidence to support both identity and the aircraft value. A citation about an aircraft register plus uncited prose about a flight is insufficient. Schedule evidence remains `scheduled`; a completed flight record can be `actual` only when the excerpt establishes that relationship. Current fleet or neighboring-date equipment never confirms actual equipment.
6. Return ICAO types only from the installed catalog. Preserve operator and registration as evidence fields. If times are later added, keep event kind, actual/scheduled/estimated, timezone and local date distinct; do not derive airborne duration from undefined departure/arrival events.

These rules attest extraction provenance, not the truth of an external source. A suggestion may be presented for review without claiming that two independent origins were established. [ADR 0003](../adr/0003-automatic-missing-flight-details.md) governs the separate automatic-write boundary. This adapter does not implement source-record admission or journal writes.

## Completion and errors

Server tools execute inside Anthropic's loop; do not synthesize client `tool_result` blocks for them. For a continuing implementation, `pause_turn` requires replaying the full assistant content unchanged with the same tool definitions and a bounded continuation count. [Server tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools).

For Kuuki's current bounded endpoint, use a single total 35-second deadline across discovery and extraction, below the UI's 40-second limit. Do not continue paused discovery. Only `end_turn` qualifies for normal parsing. Classify `pause_turn`, `max_tokens`, `model_context_window_exceeded`, `refusal`, unexpected `tool_use`, timeout and malformed output separately; none means a completed negative search. [Stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons).

Inspect tool errors even on HTTP 200. Record request IDs and compact error categories, not prompts or credentials. Evaluators should accumulate usage from every attempted stage, deduplicate identical flight keys and retain partial/error statuses. Keep production reads and local evidence artifacts separate from journal writes.

## Pricing and bounds

Current direct API USD rates per million tokens:

| Prompt size          | Input | Output | 5m cache write | 1h cache write | Cache read |
| -------------------- | ----: | -----: | -------------: | -------------: | ---------: |
| Up to 100,000 tokens | $0.10 |  $0.50 |         $0.125 |          $0.20 |      $0.01 |
| Over 100,000 tokens  | $0.50 |  $2.50 |         $0.625 |          $1.00 |      $0.05 |

Web search costs $10 per 1,000 searches, plus token costs. Fetch has no separate fee; returned content consumes input tokens. Errors during search are not billed as searches. Use response `usage.server_tool_use.web_search_requests`, token counts and cache counters for accounting, not model-written claims. [Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

For uncached requests below 100K, estimated dollars are `(input_tokens × 0.10 + output_tokens × 0.50) / 1,000,000 + search_requests × 0.01`, summed across both stages. A calculated 10K input / 2K output / two-search example costs $0.022. This is an estimate, not a billing reconciliation. Tool `max_uses` and output limits are bounded controls, not a guaranteed dollar cap on provider-internal token use. Report costs as estimates and enforce an explicit evaluator request limit before each batch. The runner persists a reservation of two API requests per Haiku batch; it reports a conservative usage estimate using the high prompt tier and leaves cost unknown for incomplete usage. This request limit is not a dollar budget.
