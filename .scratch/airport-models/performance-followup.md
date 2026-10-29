# Airport Models — remaining mobile performance goal

Status: open, 2026-10-29. Owner: next performance task; no production release implied.

Target remains p95 frame submission interval ≤33 ms. After layer/material batching,
BER records 34.2 ms untraced and 34.3 ms traced on Chrome 156 / ANGLE Vulkan
SwiftShader, DPR 1, 320×700, reduced motion. CPU render work is 0.3 ms, 11 draw
calls, 36 365 triangles and zero idle frames. These values do not establish GPU
time or FPS on a physical phone; the remaining bottleneck is not diagnosed.

Use the existing real-canvas Playwright case (`--grep 'real airport canvases'`)
after `pnpm next:build` to reproduce the recorded software profile. Capture a
separate physical-phone/hardware-GPU interaction trace with browser/device/DPR,
viewport, motion preference and source revision recorded. Compare equal camera
and layer states; retain exact geometry, picking, controls and fallback behavior.
Do not lower the goal or infer real-device FPS from headless screenshot timing.

Evidence and implementation: [optimization report](../../docs/research/2026-10-29-airport-models-optimization.md).
