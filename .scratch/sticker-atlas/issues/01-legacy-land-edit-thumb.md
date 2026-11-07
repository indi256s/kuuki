# Legacy land visit: segmented thumb rests on "By train" while editing

Status: needs-triage
Type: task

A visit stored before migration 0018 as `entry_method = 'land'` with no `mode` has no matching way among
Train · Car · Sea · Other. When the owner chooses Edit on such a row in the country sheet, the form keeps the
stored way (it is left out of the PATCH until a segment is picked), and no radio is checked for assistive
technology. `SegmentedControl` (`apps/next/src/client/ui/segmented-control.tsx`) still draws its thumb on the
first segment when its value matches no option, so the form looks as if "By train" were selected.

Data stays correct; only the visual state is misleading, and only for legacy land rows opened for edit.

Fix options: let `SegmentedControl` hide its thumb when the value matches no option (shared control; check its
other consumers), or show a fifth, read-only "By land" segment only while editing a legacy row.

Found during W2 of docs/plans/2026-11-07-sticker-atlas.md.
