# Kuuki Design System

## Direction

**Feel:** Dawn departure — the focused calm of early morning flights. Quiet anticipation, soft predawn light, the world below still asleep.

**Temperature:** Cool neutrals (slate-blue, predawn gray) with warm accent moments (runway lighting, terminal glow).

**Signature:** Great-circle arcs. The curved lines of flight paths inform decorative elements, progress indicators, and subtle UI curves.

**Target:** Aviation enthusiasts who genuinely love flight, not just travelers who happen to fly.

---

## Depth Strategy

**Layered shadows (altitude-inspired)**

Surfaces sit at different elevations like cloud layers. Subtle, atmospheric depth — not dramatic.

```css
--shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-md: 0 2px 8px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-lg: 0 4px 16px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04);
```

---

## Spacing

**Base unit: 4px**

Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96

Use consistently. Random values signal no system.

---

## Color Tokens

### Foreground (Text)

```css
--ink: #0f172a;              /* Primary text - deep slate */
--ink-muted: #475569;        /* Secondary text */
--ink-faint: #94a3b8;        /* Tertiary, placeholders */
--ink-inverse: #f8fafc;      /* Text on dark surfaces */
```

### Background (Surfaces)

```css
--sky: #f8fafc;              /* Base canvas - predawn light */
--sky-raised: #ffffff;       /* Cards, elevated surfaces */
--sky-sunken: #f1f5f9;       /* Inset areas, wells */
--sky-overlay: rgba(15, 23, 42, 0.5);  /* Modal backdrops */
```

### Border

```css
--edge: rgba(15, 23, 42, 0.06);        /* Subtle divisions */
--edge-strong: rgba(15, 23, 42, 0.12); /* More prominent borders */
```

### Brand / Accent

```css
--runway: #3b82f6;           /* Primary action - the blue of taxiway lights */
--runway-hover: #2563eb;
--runway-muted: rgba(59, 130, 246, 0.1);
```

### Semantic

```css
--cleared: #10b981;          /* Success - cleared for takeoff */
--cleared-muted: rgba(16, 185, 129, 0.1);
--holding: #f59e0b;          /* Warning - hold short */
--holding-muted: rgba(245, 158, 11, 0.1);
--emergency: #ef4444;        /* Error/destructive */
--emergency-muted: rgba(239, 68, 68, 0.1);
```

---

## Typography

**Font stack:** System UI with aviation-inspired fallbacks

```css
--font-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, "SF Mono", Monaco, "Cascadia Mono", monospace;
```

### Scale

| Role | Size | Weight | Tracking |
|------|------|--------|----------|
| Display | 48px | 600 | -0.02em |
| Heading 1 | 32px | 600 | -0.015em |
| Heading 2 | 24px | 600 | -0.01em |
| Heading 3 | 18px | 600 | 0 |
| Body | 15px | 400 | 0 |
| Body small | 13px | 400 | 0 |
| Label | 12px | 500 | 0.02em |
| Mono (data) | 14px | 500 | 0 |

---

## Border Radius

**Scale: 4, 6, 8, 12, 9999 (pill)**

- Small elements (badges, chips): 4px
- Cards, inputs: 8px
- Larger containers: 12px
- Buttons, pills: 6px or full

---

## Component Patterns

### Cards (Flight Log Entry)

```css
.flight-card {
  background: var(--sky-raised);
  border: 1px solid var(--edge);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  padding: 16px;
}

.flight-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--edge-strong);
}
```

### Metric Display

Use varied presentations based on context:
- **Hero number:** Large, prominent, with subtle label below
- **Inline stat:** Number and label on same line, compact
- **Progress ring:** For completion percentages
- **Comparison delta:** Show change with directional indicator

Avoid the default "icon left, big number, small label" pattern.

### Route Line (Signature Element)

SVG paths using quadratic curves to evoke great-circle routes:

```jsx
// Conceptual - curve between two points
<path
  d="M 0,20 Q 50,-10 100,20"
  stroke="var(--runway)"
  strokeWidth="2"
  fill="none"
/>
```

Use as:
- Decorative dividers
- Progress indicators
- Connection lines in data viz
- Subtle background elements

### Navigation

Inspired by departure boards / terminal wayfinding:
- Clear, scannable labels
- Current location prominently marked
- Minimal chrome


---

## Mascot

**Name:** Kuuki Cloud

![Kuuki Cloud](/apps/web/public/images/mascot.webp)

**Personality:**
- Friendly, floating, and light
- Represents the joy of flight and discovery
- Always smiling, eager to explore

**Usage:**
- Use in empty states (e.g., "No flights logged yet")
- Use in onboarding flows to guide the user
- use in achievement unlocks
- Do not overuse in dense data views

---


## States

### Interactive Elements

- **Default:** Base styling
- **Hover:** Subtle lift (shadow increase) or color shift
- **Active/Pressed:** Slight inset or darker shade
- **Focus:** 2px ring in `--runway` with 2px offset
- **Disabled:** 50% opacity, no pointer events

### Data States

- **Loading:** Skeleton with subtle pulse animation
- **Empty:** Illustration + clear action prompt
- **Error:** `--emergency-muted` background with message

---

## Animation

```css
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--duration-fast: 150ms;
--duration-normal: 200ms;
```

Keep transitions subtle. No bounce or spring effects.

---

## Dark Mode (Future)

When implemented, shift temperatures:
- `--sky` becomes deep slate/navy
- `--ink` becomes light values
- Shadows become lighter overlays
- Accent colors remain similar but may need brightness adjustment

---

## Anti-patterns

Avoid:
- Harsh, visible borders as primary structure
- Pure white cards on the gray canvas (use subtle difference)
- Generic dashboard grids without hierarchy
- Icon-heavy metric cards
- Decorative gradients
- Multiple competing accent colors
