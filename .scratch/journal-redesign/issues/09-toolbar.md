# 09 Toolbar, chips and More filters drawer

Status: done
Type: task
Owner: Sonnet
Blocked by: 05, 07
Spec: Page structure 4, 5

## What

`client/journal/toolbar.tsx`: search field (`/` focuses), chips Period (date-range-picker with year presets), Place (airports and countries, either end), Airline, Aircraft (types and families), Clear all, ⋯ menu (More filters, Export all matching). `more-filters.tsx`: drawer (`Sheet side="right"` on desktop) with Status (with counts), Missing details, Alliance.

## Done

- Component test: choosing a chip value updates the store; Clear all resets; counts show.
- typecheck, lint, test green.
