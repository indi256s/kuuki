---
name: brand-guidelines
description: Kuuki brand identity, design tokens, and visual guidelines. Use for consistent styling across UI, marketing materials, and any artifact that should match Kuuki's Warm Japanese Minimalism aesthetic.
license: Complete terms in LICENSE.txt
---

# Kuuki Brand Guidelines

## Brand Identity

**Name:** Kuuki (Primary), くうき (Brand Atmosphere)

**Tagline:** Your visual legacy of flight

**What Kuuki is:** A flight stats vault for aviation enthusiasts. Log journeys, build your collection, discover patterns.

**Core Concept:** Atmosphere (Kuuki). Weightless, breathable, essential.

---

## Design Direction: Warm Japanese Minimalism

**Philosophy:** Traditional Japanese aesthetics (Ma, Shibui) meet high-precision instrumentation.

**Feel:**

- Light mode: Warm paper-like neutrals, terracotta accents, breathable 'Ma' (negative space).
- Dark mode: Deep charcoal/ink (not void black), amber/warm light accents — lantern-like focus.

**Signature Elements:**

- **Hiragana (くうき):** Used as subtle, atmospheric texture (large, low opacity, gradients).
- **Grainy Textures:** "Washi" paper effects to soften digital edges.
- **Glassmorphism:** Warm, blurred surfaces (frosted glass) rather than cold ice.
- **Flowing Animation:** Motion that mimics air/wind currents.

**Target Aesthetic:** Modern travelers who value mindfulness and precision. Think: Kyoto design studio meets cockpit avionics.

---

## Color Palette

### Primary & Brand

**Coral (Terracotta):** `#F76B6E`
Used for: Primary actions, brand logos, active states, "lantern" glows.

### Neutral Surfaces (Warm/Ink)

**Dark Mode (Primary Interaction):**

| Token | Hex | Description |
|-------|-----|-------------|
| Background | `#08090A` | Deep Ink (Not pure black) |
| Surface | `#121417` | Charcoal |
| Card/Float | `rgba(255,255,255,0.03)` | Frosted Ink |

**Light Mode:**

| Token | Hex | Description |
|-------|-----|-------------|
| Background | `#FAFAF9` | Warm Paper |
| Surface | `#FFFFFF` | Bone/White |

### Functional Accents (The "Lights")

| Name | Hex | Use |
|------|-----|-----|
| **Coral** | `#F76B6E` | Primary, Brand, Focus |
| **Teal** | `#2EB88A` | Success, On track |
| **Orange** | `#F3904F` | Warning, Transit |
| **Red** | `#E54D5A` | Error, Destructive |
| **Cyan** | `#26B5CE` | Info, Sky |

### Data/Chart Palette (Curated)

1. **Coral:** `#F76B6E`
2. **Teal:** `#2EB88A`
3. **Orange:** `#F3904F`
4. **Yellow:** `#EBCB4B`
5. **Cyan:** `#26B5CE`
6. **Blue:** `#4EA7F5`
7. **Purple:** `#AF7AF2`
8. **Green:** `#50C086`

### Glow Effects ("Lantern")

Focus/Active states should emit a warm, diffused light:

```css
box-shadow: 0 0 15px rgba(247, 107, 110, 0.4);
```

---

## Typography

### Font Pairing

| Role | Font | Style |
|------|------|-------|
| **Brand/Atmosphere** | **Hiragana (System)** | Bold, used for "くうき" watermark |
| **Headings/UI** | **DM Sans** | Precise, geometric but human |
| **Data/Tech** | **JetBrains Mono** | Tabular, engineering aesthetic |

### Usage Rules

- **Kuuki (Romanized):** Use for standard text, titles, and headers.
- **くうき (Hiragana):** Use ONLY for decorative, large-scale background elements or logo marks. Do NOT use for body copy.
- **Monospace:** Continue to use for all flight data (codes, times, distances).

---

## Spacing & Layout

**Grid Base:** 4px

**Philosophy:** 'Ma' (Space between things). Whitespace is active, not empty.

| Element | Value |
|---------|-------|
| Card padding | 24px (Generous) |
| Section gap | 48-64px |
| Border Radius | 16-32px (Softer, organic curves) |

---

## Visual Effects

### Textures & Gradients

- **Noise/Grain:** Use subtle SVG noise overlays (`opacity: 0.15`) to break digital flatness.
- **Atmospheric Gradients:** Radial gradients that fade from Brand color to transparent, mimicking light sources.

### Glassmorphism (Warm)

```css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.06);
```

---

## Design Principles

### 1. Atmosphere First

The UI should feel lighter than air. Use transparency, blur, and gradients to create depth without weight.

### 2. Quiet Precision

Data should be presented with engineering exactness (JetBrains Mono), surrounded by calm surfaces.

### 3. Progressive Disclosure

Don't overwhelm. Reveal complexity as the user dives deeper.

### 4. Warmth over Cold

Avoid clinical blues and grays. Lean towards warm stones, inks, and paper tones.

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Cold/Clinical styling | Warm, organic technicality |
| Hard drop shadows | Soft, diffused glows |
| "Tech" Neon Blue | Terracotta/Coral/Warm hues |
| Dense information | 'Ma' / Breathable space |
| Kanji in functional text | Romanized for utility, Hiragana for vibe |

---

## Quick Reference

**Brand Colors:**

```
Primary: #F76B6E (Coral)
Bg Dark: #08090A (Ink)
Bg Light: #FAFAFA (Paper)
Text: #F2F4F7
```

**Fonts:**

- DM Sans
- JetBrains Mono
- (Hiragana for art)

**Direction:** Warm Japanese Minimalism — "Atmosphere & Precision"
