# Agent access reuses journal operations

Decision updated 2026-10-13: the initial workstream is WebMCP in an open page.
Remote MCP, external OAuth connections and agent plugins are deferred. This
supersedes the earlier combined-release decision; implementation has not begun.
See the [current scope](../../.scratch/personal-agents/spec.md) and
[WebMCP plan](../plans/2026-10-13-webmcp.md).

WebMCP will expose journal operations through the same server logic, ownership
checks and validation as the interface, so agent access does not create a second
set of mutation rules. The initial scope executes explicit user requests rather
than scheduling autonomous work. Browser access does not promise operation while
Kuuki is closed.

An explicit owner instruction conveyed through their agent can authorize a
journal change or confirm a performed journey and its visited countries. An
agent's inference alone does not confirm travel. Browser support and client
compatibility remain subject to verification. Password changes and account
deletion remain owner-completed actions in Kuuki for the initial scope.

Stopping a request prevents new operations from starting; committed changes
remain. Already dispatched operations are reconciled and reported as completed,
remaining or unknown, rather than treating cancellation as rollback.

For future remote access, the agreed direction is to reuse these operations,
with account authorization, separate read/write permissions and revocable
access. Revoking a connection must prevent new operations immediately, including
those using unexpired tokens; it does not undo committed journal changes. The
OAuth stack and remote client compatibility are not decided by this ADR.
