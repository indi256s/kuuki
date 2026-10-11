# Verify figure press behavior on a real iPhone

Status: open
Type: task

The touch pose works in Chromium emulation and releases when `data-dragging` begins. Real iOS Safari has not been checked.

On a real iPhone, press and release fleet/map/clock/tape tiles, scroll through them, then long-press to reorder. Confirm the pose appears while pressing, does not flash during scrolling, and releases when dragging starts. Reduced motion must keep the touch pose off.

Only if reproduced: a missing `:active` pose may need a tile touch listener; a scrolling flash may need a 50ms press delay. Do not apply either speculative workaround without device evidence.
