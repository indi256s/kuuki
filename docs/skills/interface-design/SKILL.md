---
name: Interface Design
description: A method for implementing a Linear-inspired interface design system.
---

# Linear-Inspired Design System (Kuuki Final)

## 0. Philosophy

**"The tool for high-performance teams."**
The interface should feel like an extension of the user's thought process—instant, precise, and visually silent until interaction occurs. The aesthetic is "Soft Modern Technical": deep dark backgrounds, subtle borders, and vivid, meaningful accents that glow.

---

## 1. Core Tokens

### 1.1 Color Palette (Dark Mode Default)

Linear does not use pure black (`#000000`). It uses deep, cool grays to reduce eye strain and create depth.

**Base Surfaces**

- **Background:** `#08090A` (The void, but breathing)
- **Surface (Card):** `#121417` (Slightly elevated)
- **Surface (Hover):** `#181A1F`
- **Surface (Active/Overlay):** `#1F2128`

**Typography & Contrast**

- **Text Primary:** `#F2F4F7` (Almost white, never pure white)
- **Text Secondary:** `#8A8F98` (Cool, medium gray - *Critical for hierarchy*)
- **Text Tertiary:** `#5F6570` (Subtle metadata)
- **Text Quaternary:** `#424752` (Disabled/Placeholder)

**Borders & Separators**

- **Border Subtle:** `rgba(255, 255, 255, 0.06)` (Layout dividers)
- **Border Default:** `rgba(255, 255, 255, 0.08)` (Card borders)
- **Border Strong:** `rgba(255, 255, 255, 0.12)` (Inputs, active elements)
- **Border Focus:** `rgba(247, 107, 110, 0.5)` (Coral glow)

**Functional Accents (The "Lights")**

- **Primary (Coral):** `#F76B6E` (Brand, Links, Focus)
  - *Glow:* `box-shadow: 0 0 16px rgba(247, 107, 110, 0.4)`
- **Success (Teal/Green):** `#2EB88A` (On track, Done)
- **Warning (Amber):** `#E5A000` (At risk)
- **Error (Red):** `#E5484D` (Failed, Off track)
- **Info (Blue):** `#0091FF`

**Data Visualization & Decoration Colors**
Primary palette for charts, graphs, tags, and illustrations (10-tone scale):

1. **Cyan:** `#26B5CE`
2. **Red:** `#E54D5A`
3. **Salmon:** `#F76B6E`
4. **Olive:** `#8F710A`
5. **Yellow:** `#EBCB4B`
6. **Orange:** `#F3904F`
7. **Purple:** `#AF7AF2`
8. **Blue:** `#4EA7F5`
9. **Slate:** `#939BA5`
10. **Green:** `#50C086`

### 1.2 Typography

**Font:** Inter (or similar neo-grotesque).
**Weights:** Regular (400), Medium (500), SemiBold (600).
**Tracking:** Tighter than default to feel "engineered".

| Role | Size (px) | Line Height | Weight | Tracking | Usage |
|------|-----------|-------------|--------|----------|-------|
| `text-xs` | 12px | 16px | Medium | 0 | Badges, captions |
| `text-sm` | 13px | 20px | Regular | -0.01em | Body, list items |
| `text-base` | 14px | 24px | Regular | -0.01em | Long form text |
| `text-lg` | 16px | 28px | Medium | -0.02em | Section headers |
| `text-xl` | 20px | 32px | Semibold | -0.02em | Modal titles |
| `text-2xl` | 24px | 32px | Semibold | -0.03em | Page titles |

*Note: Use `13px` as the default body size for that dense, information-rich dashboard feel.*

### 1.3 Spacing & Layout

**Grid Base:** 4px.
**Layout Density:** Comfortable but precise.

- **Padding - Card:** `20px` (or `p-5`)
- **Padding - Input:** `8px 12px`
- **Gap - List:** `4px` or `8px`
- **Gap - Section:** `32px` or `48px`

### 1.4 Radius

A dual-radius system creates organic containers with mechanical contents.

- **Outer (Cards/Modals):** `12px` (Soft)
- **Inner (Buttons/Inputs):** `6px` (Precise)
- **Pills:** `9999px` (Status badges)

---

## 2. Visual Effects

### 2.1 Shadows & Glows (The "Linear Look")

Linear relies on "inner light" rather than just drop shadows.

**Elevation Levels:**

1. **Low (Card Hover):** `0px 2px 4px rgba(0,0,0,0.2), 0px 4px 10px rgba(0,0,0,0.1)`
2. **Medium (Dropdown/Popover):** `0px 4px 8px rgba(0,0,0,0.4), 0px 12px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)`
3. **High (Modal):** `0px 20px 48px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)`

**Glows:**
Used for active states (focus rings, active tabs).

- `box-shadow: 0 0 0 1px #F76B6E, 0 0 12px -2px rgba(247, 107, 110, 0.6)`

### 2.2 Glassmorphism

Used sparingly for floating headers, toast messages, and command palettes.

- **Background:** `rgba(18, 20, 23, 0.7)`
- **Backdrop Blur:** `blur(12px)`
- **Border:** `1px solid rgba(255,255,255,0.05)`

### 2.3 Gradients

- **Subtle Surface:** `linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(255,255,255,0))` on card hover.
- **Masks:** Text truncation uses `mask-image: linear-gradient(to right, black 90%, transparent)`.

---

## 3. UI Components

### 3.1 Buttons

- **Primary:** Background `#F2F4F7` (White), Text `#08090A` (Black). *Inverted high contrast.*
- **Secondary:** Background `rgba(255,255,255,0.05)`, Text `#F2F4F7`, Border `1px solid rgba(255,255,255,0.05)`. Hover: `rgba(255,255,255,0.08)`.
- **Ghost:** Transparent, Text `#8A8F98`. Hover: Text `#F2F4F7`, Background `rgba(255,255,255,0.05)`.

### 3.2 Inputs (Search/Text)

- **Background:** `transparent` or `#08090A`.
- **Border:** `1px solid rgba(255,255,255,0.1)`.
- **Focus:** Border `#5E6AD2` + Indigo Glow.
- **Icon:** Always include a leading icon (Search, User, etc.) in `#8A8F98`.

### 3.3 Cards

- **Bg:** `#121417`.
- **Border:** `1px solid rgba(255,255,255,0.05)`.
- **Hover:** Slight border lighten (`rgba(255,255,255,0.1)`) + Low Elevation.

### 3.4 Command Palette (Search)

- **Size:** Large, centered.
- **Appearance:** High blur glass.
- **Glow:** "Northern Lights" effect behind it (purple/blue blob blurry background).

### 3.5 Charts (Dashboard)

- **Type:** Stacked Bar or thin Line.
- **Colors:**
  - Metric 1: `#E5484D` (Red - e.g., Bugs)
  - Metric 2: `#F5A524` (Orange)
  - Metric 3: `#2EB88A` (Green)
  - Background Bars: `#1F2128` (Dark Gray)
- **Grid:** Dotted or extremely subtle (`rgba(255,255,255,0.03)`).
- **Tooltips:** Inverted (White bg, Black text) for max contrast.

---

## 4. Animation Physics

"Instant, then smooth."

- **Duration:** 200ms - 300ms.
- **Curve:** `cubic-bezier(0.2, 0.8, 0.2, 1)` (Snappy start, soft landing).
- **Micro-interactions:**
  - Hover: Scale `0.98` to `1.02` (Subtle breath).
  - Toggle: Smooth slide.

---

## 5. Implementation Notes (CSS/Tailwind)

**Tailwind Configuration Strategy:**

1. **Colors:** Extend `colors` with `linear` palette variables.
2. **Opacity:** Heavy use of `bg-white/5` or `border-white/10`.
3. **Ref:**
    - `bg-surface` -> `#121417`
    - `border-highlight` -> `rgba(255,255,255,0.1)`

```css
/* Example Utility Class Extensions */
.glass {
  @apply bg-[#0B0C0E]/80 backdrop-blur-xl border border-white/5;
}

.glow-text {
  text-shadow: 0 0 20px rgba(255,255,255,0.5);
}

.chart-gradient {
  background: linear-gradient(180deg, rgba(94, 106, 210, 0.2) 0%, rgba(94, 106, 210, 0) 100%);
}
```

---

*Verified against user references.*
