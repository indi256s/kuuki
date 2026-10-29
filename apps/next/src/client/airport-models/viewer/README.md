# Airport viewer

Import `AirportViewer`, `defaultAirportLayers` and `AirportViewerHandle` from `viewer/index`.
Three is imported only after an active viewer mounts. Keep `model` and `initialPose`
stable; changing either starts a fresh renderer. Set the initial controlled
`state.pose` to the same `model.cameras.desktop` or `.mobile` used by the preview.

The caller owns `state: { pose, layers, selectedFeatureId, visibleInsets? }`.
Accept `onPoseChange` and `onSelection` into that state. All nine feature kinds
start visible in `defaultAirportLayers`; clone the object before changing layers.
`onStatus` reports `loading`, `ready` after the first frame, or `error`.
Provide the prepared preview as `fallback`; it remains until `ready` and returns
on error. The caller owns localized errors and visible controls.

The forwarded ref exposes instant `zoom(factor)` (greater than one zooms in),
`reset()`, `focusFeature(id)` and `retry()`. Focus uses the supplied CSS-pixel
`visibleInsets` to avoid overlays. Changing insets or opening a panel never fits
the camera. `active=false` disposes resources; preserve controlled state outside
the viewer when showing comparison. Hidden tabs and offscreen canvases suspend
frames. Identity reset retires pending module loading and the live renderer.

One-pointer drag orbits, Shift+drag pans, and two pointers pinch/pan. Movement
over 6 CSS pixels and every multiple-pointer gesture suppress selection.
`onHover` supplies `{id,x,y}` in canvas-local CSS pixels after 250ms (neighbouring
objects immediately), and `null` on leave. The caller owns an accessible,
hoverable tooltip, Escape dismissal and a DOM object list. Canvas is decorative
for assistive technology; the object list and visible controls provide parity.

Import `AirportComparison` from `comparison/index`. Supply `plans` as a pair,
`locale` and optional `names`. It renders two measured north-up SVG drawing
panels at one physical scale, independently of Three. Its scale bars use the
actual measured drawing area; labels and CSS spacing sit outside that area.

Focused module proof covers real Three holes/extrusions/parts, physical camera
projection, explicit focus with desktop/mobile insets and analytic scale.
Compiled browser acceptance must additionally establish visible controls,
actual picking/drag/pinch, context-loss retry, no idle rendering, disposal and
equal on-screen scale through the integrated route.
