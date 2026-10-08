# Board source fidelity and reference parity

Type: task
Status: claimed

## Decision

The supplied real 69-flight JSON is authoritative for data. Preserve all routes, dates, distances and durations. It covers 14 countries, including Maldives through logged DOH→MLE on 2023-07-27. Therefore the hero shows 14 countries and upcoming DXB→MLE is not a new country. Paper’s 16-country label and the plan’s Maldives-new claim are source inconsistencies, not engine targets. No additional passport evidence has been supplied.

Task2 independent review established that absent KTT reference metadata incorrectly hides the northernmost airport and two Arctic crossings. Add sourced KTT metadata and canonical AT76 aircraft metadata, preserving all actual flights and the required ICAO mapping.

## Acceptance

- [x] Task2/Task5 plan requirements distinguish real data from illustrative board labels; owner-qualified ETag and domain times provenance are explicit.
- [x] Task2 sourced KTT/AT76 records and regenerated board pass northernmost/Arctic parity checks.
- [ ] Task5 board upcoming DXB→MLE newCountry is false; independent absent-country case is true.
- [ ] Task17/22 hero shows actual 14-country result.
- [ ] Final board review checks actual source-derived figures without fabricated evidence.

## Comments

2026-10-07 — Controller disposition of Task2 review I2. Existing historical design snapshots remain as recorded; this dated decision supersedes their conflicting country labels. KTT primary evidence: Finnish AIP EFKT AD2.2 and Finavia’s KTT/EFKT list; AT76: FAA JO7360.1K / aircraft appendix and ATR’s ATR72-600 page (the original ICAO PDF was unavailable), cited in the Task2 review/fix reports.
