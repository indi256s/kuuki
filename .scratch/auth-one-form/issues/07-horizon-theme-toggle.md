# Horizon theme toggle in the card corner

Status: ready-for-agent
Type: task
Blocked by: 04
Spec: [spec.md](../spec.md) — "Visual system › Theme toggle (Horizon)", "Seam 2 › Theme toggle", user stories 58–62
Design: board 4.1 "Theme toggle" row

## What to build
A small Kuuki component carrying Horizon's published SVG paths from `@theme-toggles/react` (MIT), with an attribution comment naming the package and author. Don't render the package's own component. It goes in the card corner and the mobile sheet header, replacing ticket 04's temporary theme control there. Follow every artwork, state, optical-shift, behaviour and accessibility detail in the spec section: 16px icon in the 44×44 button, sun translated 50% in dark over 500ms `cubic-bezier(0,0,0.15,1)`, icon shifted up 4.5px in dark and 0.5px in light, the click explicitly sets the opposite theme through the existing appearance contract, `system` stays until the first click, `aria-pressed` reflects dark, the name and title are a constant "Dark theme"/"Тёмная тема", and changes are instant under reduced motion. The avatar menu and Settings controls stay unchanged.

## Acceptance
Every "Seam 2 › Theme toggle" case (emulateMedia light → unpressed; click → `data-theme` dark and `aria-pressed=true`; survives reload). Full navigation suite, typecheck and unit tests pass.
