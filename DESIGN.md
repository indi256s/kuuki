---
name: Kuuki
description: Warm Japanese-minimal flight legacy tracker
colors:
  background: "var(--background)"
  foreground: "var(--foreground)"
  primary: "var(--primary)"
  card: "var(--card)"
  muted: "var(--muted)"
  muted-foreground: "var(--muted-foreground)"
  border: "var(--border)"
  chart-1: "var(--chart-1)"
typography:
  display:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    letterSpacing: "-0.01em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
rounded:
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1rem"
  xl: "1.5rem"
spacing:
  page: "clamp(1rem, 5vw, 3rem)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "var(--primary-foreground)"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
---

## Overview

Kuuki uses OKLCH design tokens in `apps/web/src/index.css` with terracotta primary (light) and amber primary (dark). Typography is DM Sans with JetBrains Mono for stats. Cards cap at 16px radius; glass blur is rare and functional (toasts only), not default chrome.

## Colors

Canonical tokens live in CSS (`--background`, `--primary`, `--chart-*`, `--map-*`). Light background is a cool near-white (`oklch(0.985 0.002 260)`), not warm cream. Map surfaces use `--map-background`, `--map-country`, `--map-stroke`, and `--map-route-fallback`.

## Typography

- Display/headings: DM Sans, semibold, `tracking-tight`, `text-balance` on h1–h3.
- Body: DM Sans, muted via `--muted-foreground` at full opacity (never halved for placeholders).
- Stats: JetBrains Mono, tabular nums.
- Hero clamp max 6rem; display letter-spacing floor −0.04em.

## Elevation

Prefer a single affordance: flat border **or** shadow up to 8px blur, never both on cards. Sticky headers use solid `bg-background/95` without backdrop blur. Auth and dashboard cards use `border-border/50` only.

## Components

- **Button**: primary solid fill; icon size minimum 44×44px touch target on mobile.
- **Card**: `rounded-xl`, border only, no `shadow-sm` pairing.
- **Note/callout**: full border tint (`border-primary/20 bg-primary/[0.03]`), no side-stripe accents.
- **Maps**: react-simple-maps fills reference `--map-*` CSS variables.

## Do's and Don'ts

**Do** use semantic headings (`h1` once per page, `CardTitle` as `h3`). **Do** test placeholder contrast at 4.5:1. **Do** use `--ease-smooth` / ease-out-quart for motion.

**Don't** use `background-clip: text` gradients for branding. **Don't** use `border-left` accent stripes on cards. **Don't** use `feTurbulence` paper-grain filters. **Don't** hard-code slate/indigo hex on journey or map pages.
