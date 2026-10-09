# ADR 0003: Automatic filling of missing flight details

Status: Accepted product boundary, 2026-10-08. Implementation and release
remain pending the evidence contract and experiment.

Kuuki will automatically fill missing aircraft types and times for completed
saved flights using confirmed evidence, rather than requiring confirmation of
every proposal. It preserves existing values, including edits made while the
lookup runs. Actual times take priority; dated scheduled times are an allowed
fallback and remain visibly identified as scheduled. An AI confidence value
or a discovered URL alone is not confirmation. Automatic filling requires two
independent sources with demonstrably separate primary data origins. Different
websites copying the same upstream data do not qualify. If independence cannot
be established, automatic filling is skipped.

The owner accepts a weaker confirmation rule than requiring two attestations
for every field. If the two sources identify different aircraft manufacturers,
nothing is filled for that occurrence. If they disagree on models of the same
manufacturer, the aircraft model from the first source is used. If both identify
the same aircraft type, their details may be combined, including times supplied
by only one source. Aircraft-model conflicts within a manufacturer and conflicts
between times of the same event use a fixed priority among admitted sources,
not search-result or model-response order. The concrete priority is determined
by inspecting source data. A manufacturer match is not a confirmation of the exact
model; this is an explicitly accepted trade-off for coverage.

Accepted times retain their event and whether they are observed or scheduled
individually. Observed gate times take priority, followed by takeoff/landing
times and then scheduled times. An unknown event or the first/last ADS-B
observation is not admitted as a departure/arrival event. A pair combining
scheduled and observed times or incompatible events is not a measured duration.
Partial enrichment may fill a supported subset without filling every gap.
Two independent sources establishing the occurrence and its times may fill
times even when neither source supplies the aircraft type. Missing aircraft
information is not a manufacturer conflict.

Evidence and negative lookup results are shared for the same flight occurrence,
while associations with journals stay private. Sharing reuses a lookup rather
than supplying a second confirmation.
Deleting a journal or account removes its private associations, while shared
public results and negative lookup history may remain without those links,
including after the last linked flight is deleted. Retention stays within the
source's permitted storage period; personal documents are not shared evidence.
This avoids repeating the same paid lookup after a later import.

This keeps daily enrichment useful without allowing it to revise the owner's
recorded history. Source admission and the concrete priority ordering
remain pending source inspection in the
[working spec](../../.scratch/claude-flight-enrichment/spec.md).
