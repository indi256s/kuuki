---
name: Interface Design
description: Use when implementing or reviewing Kuuki interfaces, shared controls or design tokens; DESIGN.md owns the visual contract.
---

# Kuuki Interface Design

Read [DESIGN.md](../../../DESIGN.md) before UI work. It is the authoritative visual contract; this skill routes to it and the installed implementation.

1. Read only the sections affected: **Color and surfaces**, **Token roles** and **Typeface decision** for tokens; **Type and layout**, **Surfaces and elevation** and **Motion** for styling; **Interaction and states**, **Shell and navigation** and **Primitives** for controls and flows. Check the relevant component or journey section for specific decisions, including proposal status.
2. Reuse [shared UI primitives](../../../apps/next/src/client/ui/) and their existing call sites. Resolve token values from [styles.css](../../../apps/next/src/app/styles.css). The [development gallery](../../../apps/next/src/app/dev/gallery/gallery.tsx) is the component reference; its availability and theme/locale options are documented in DESIGN.md § Primitives.
3. Apply the affected checks in [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) § Verify a change. Read current package scripts for commands and [the design lint rule](../../../scripts/oxlint-design.mjs) for enforced token and transition rules. Use the repository's browser policy when a functional check requires browser interaction.

Finish with the existing primitives and tokens implementing the affected DESIGN contract, or report a specific conflict requiring a design decision.
