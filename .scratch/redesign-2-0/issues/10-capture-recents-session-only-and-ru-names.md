# Capture: recents are tab-session only; ru airline and aircraft names are English with no label

Status: ready-for-agent
Owner task: T15
Source: review-T12-findings.md Minor 5 and Minor 6; progress.md:173; verified at af92d26

## What is wrong
1. `apps/next/src/client/capture/capture-preferences.ts:4,7,11` keeps recents and the disclosure preference in `sessionStorage`. They vanish on tab close and a second tab starts empty. Keys are per owner and cleared on identity reset, so this is a weakness, not a leak.
2. `apps/next/src/client/capture/reference-choices.ts:27-28` builds airline and aircraft choices with no `fallback` flag. In ru only airports get the "Название на английском" label (`reference-choices.ts:24`, `ui/combobox.tsx:43-44`).

## Expected behaviour
(1) Recents and the disclosure choice survive tab close for the same owner (localStorage, still owner-keyed and cleared on sign-out/identity reset). (2) In ru, airline and aircraft options and the selected hint carry the same English-name label as airports, unless a Russian name exists.

## Acceptance check
(1) A `capture-preferences` test writes recents for owner A, simulates a new tab session, reads them back; owner B and sign-out still get nothing. Red with `sessionStorage`. (2) A combobox test in ru for an airline and an aircraft expects the English-name label. Red now. Check first that the T13 round (Russian alias table) has not already changed this.
