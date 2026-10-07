# Old preferences have conflicting read contracts

Status: open — waiting for the user's material plan-conflict decision

Release 2 Task 11 has not been implemented. The design-owned decisions file
requires remembering account filters/layout/replay but does not choose a
preference version migration policy. No existing `parsePrefs` implementation
settles the question.

## Verified conflict

The plan's Review Focus 4 says "malformed or old prefs read as defaults".
Task 11's required test says "old version merges known fields". Its Interfaces
comment also says "unknown/old/malformed → defaults, merged per field".

For stored `{"version":0,"replayPaused":true}`, resetting old preferences
returns the default `replayPaused: false`; merging known fields returns `true`
with the current version and defaults for the other fields. These are different
observable behaviors, not equivalent test descriptions.

## Decision needed

Recommended: keep valid known fields from older versions, filling absent or
invalid fields from current defaults. Malformed JSON and unknown future
versions return complete defaults. Keep unknown facet values, as both the
plan and Task 11 explicitly require. Reconcile Review Focus and the Interfaces
comment to this policy, and test each case.

The alternative is resetting every older version to complete defaults and
correcting the required merge test.

Task 11 and subsequent tasks remain unstarted pending the user's answer.
No preferences API, UI, production/remote or GitHub action was performed.
