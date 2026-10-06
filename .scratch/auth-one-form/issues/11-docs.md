# DESIGN.md, GLOSSARY and runbook updates

Status: ready-for-agent
Type: task
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10
Spec: [spec.md](../spec.md) — "Documentation", user story 70

## What to build
Make the documentation changes listed in the spec's "Documentation" section: DESIGN.md (five accents in D2, text wordmark, plane-field brand panel with paused/reduced-motion behaviour replacing "at most 3 planes" and "ambient loops never animate", create-step swap replacing the sign-in ↔ sign-up ↔ forgot-password transition row); GLOSSARY (add **Get-back-in link** and **Create step**, update **Password reset** and **Login enablement**). Then run the `update-docs-after-feature` skill for runbook or doc text that names the old routes or flows. Use the `domain-modeling` skill conventions for GLOSSARY edits.

## Acceptance
Docs describe what the integrated branch actually does, checked against the code. Nothing else changes.
