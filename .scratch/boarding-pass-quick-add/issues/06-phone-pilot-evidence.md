# 06 — Phone pilot and representative corpus (OQ4)

Status: ready-for-human
Type: research
Requirements: spec Testing Decisions "Phone pilot" and "Pilot decision gate"

## Blocker

This implementation thread has no authorized corpus of real boarding passes and no target iPhone/Android devices. Generated barcode fixtures and the simulated T3 concept do not establish decoder accuracy, camera behavior or time savings.

## Needed to resolve

- 30 authorized passes: 15 paper-pass photos, 15 screenshots/PDFs covering both saved formats.
- Target iPhone (Safari) and Android (Chrome) devices running a preview build.
- Per source group and device: local read success, silently wrong identities (any → stop), time from acquisition to a correct reviewable card for local read vs online recognition, including first load, PDF handling and year confirmation.
- Decision: reconsider priority if either group succeeds < 80% or median time is not at least halved.

Feature acceptance and release readiness stay blocked until this evidence exists.
