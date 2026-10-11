# Resumed Opus final review

Status: resolved

The resumed Opus high visual review independently confirmed seven of eleven final fixes and found four remaining defects. The parent verified and corrected them:

- Restrict the 8px auth-field margin to links or hints inside the label row. The reset-password hint below its input now leaves margin at 0px; Russian sign-in/create keeps 8px in both states at 390px and 1280px.
- Include 2px figure padding in the half-tile minimum height: all figure boxes measure 114px, and values share the same position within each row.
- Raise the destination map label's screen-space baseline from -6px to -14px. Fresh section-head renders at k=0.95 clear the sheet edge at rest and on hover in light and dark; tile geometry remains 137×96 and 148×103. The review's offset-scaling diagnosis was incorrect: `Scene.screenText` offsets already use screen pixels; the sheet geometry scales around them.
- Replace stale illustration timing, touch, reduced-motion and uncommitted hero claims in DESIGN.md with the shared motion contract and the completed three-plane podium.

Fresh isolated checks used the real AuthCard and reset-password component, current scene builders and CSS in agent-browser. Evidence: `/tmp/svg-resume-checks/late-*`. Typecheck, lint (the existing capture/flight-form warning), 10 recovery unit tests, OpenNext build and all 40 navigation tests passed. Browser and local gallery server were closed after inspection. No production operations performed. Real iOS touch verification remains open in issue 09.
