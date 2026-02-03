---
name: brand-guidelines
description: Kuuki brand identity, design tokens, and visual guidelines. Use for consistent styling across UI, marketing materials, and any artifact that should match Kuuki's Nordic Skies aesthetic.
license: Complete terms in LICENSE.txt
---

# Kuuki Brand Guidelines

## Brand Identity

**Name:** Kuuki (always romanized, no kanji in UI)

**Tagline:** Your visual legacy of flight

**What Kuuki is:** A flight stats vault for aviation enthusiasts. Log journeys, build your collection, discover patterns, compare with others.

**What Kuuki is NOT:** A social network, booking tool, loyalty tracker, or travel planning app.

---

## Design Direction: Nordic Skies

**Philosophy:** Scandinavian minimalism meets Linear-inspired technical precision.

**Feel:**
- Light mode: Cool neutrals with subtle blue undertones — serene, spacious
- Dark mode: Deep navy-charcoal with vibrant functional accents — focused, technical

**Signature Elements:**
- Generous whitespace
- Soft rounded corners (12-16px for containers)
- Subtle hover animations with glow effects
- Typography-driven hierarchy
- Monochromatic palette with one accent color

**Target Aesthetic:** Modern travelers who value both function and aesthetics. Think: Scandinavian airline lounge, not budget terminal.

---

## Color Palette

### Dark Mode (Primary)

**Base Surfaces:**
| Token | Hex | Use |
|-------|-----|-----|
| Background | `#08090A` | Page background |
| Surface | `#121417` | Cards, elevated containers |
| Surface Hover | `#181A1F` | Interactive hover states |
| Surface Active | `#1F2128` | Active/overlay states |

**Typography:**
| Token | Hex | Use |
|-------|-----|-----|
| Text Primary | `#F2F4F7` | Headings, primary content |
| Text Secondary | `#8A8F98` | Labels, secondary info |
| Text Tertiary | `#5F6570` | Metadata, hints |
| Text Disabled | `#424752` | Disabled states |

**Borders:**
| Token | Value | Use |
|-------|-------|-----|
| Border Subtle | `rgba(255,255,255,0.06)` | Layout dividers |
| Border Default | `rgba(255,255,255,0.08)` | Card borders |
| Border Strong | `rgba(255,255,255,0.12)` | Inputs, active elements |
| Border Focus | `rgba(94,106,210,0.5)` | Focus rings |

**Functional Accents:**
| Name | Hex | Use |
|------|-----|-----|
| Primary (Indigo) | `#5E6AD2` | Brand, links, focus |
| Success (Teal) | `#2EB88A` | Completed, on track |
| Warning (Amber) | `#E5A000` | At risk states |
| Error (Red) | `#E5484D` | Errors, destructive |
| Info (Blue) | `#0091FF` | Informational |

**Chart Colors (10-tone):**
1. Cyan: `#26B5CE`
2. Red: `#E54D5A`
3. Salmon: `#F76B6E`
4. Olive: `#8F710A`
5. Yellow: `#EBCB4B`
6. Orange: `#F3904F`
7. Purple: `#AF7AF2`
8. Blue: `#4EA7F5`
9. Slate: `#939BA5`
10. Green: `#50C086`

### Glow Effects

Primary glow (for focus, active states):
```css
box-shadow: 0 0 0 1px #5E6AD2, 0 0 12px -2px rgba(94, 106, 210, 0.6);
```

---

## Typography

### Font Pairing

| Role | Font | Weight | Tracking |
|------|------|--------|----------|
| Display/Headings | DM Sans | Semibold (600) | -0.02em |
| Body text | DM Sans | Regular (400) | -0.01em |
| Data/numbers | JetBrains Mono | Medium (500) | 0 |
| Code/technical | JetBrains Mono | Regular (400) | 0 |

### Size Scale

| Role | Size | Line Height | Use |
|------|------|-------------|-----|
| Display | 24-48px | 1.2 | Page titles, hero stats |
| Heading | 20px | 1.4 | Section titles |
| Subhead | 16px | 1.5 | Card titles |
| Body | 14px | 1.7 | Main content |
| Small | 13px | 1.5 | Secondary info (Linear-style density) |
| Caption | 12px | 1.4 | Timestamps, hints |

### Data Display Rules

Always use monospace (`font-mono`) for:
- Flight numbers (UA1234)
- IATA codes (JFK, LHR)
- Distances (42,847 km)
- Durations (14h 30m)
- Counts and statistics

---

## Spacing & Layout

**Grid Base:** 4px

| Element | Value |
|---------|-------|
| Card padding | 20px |
| Input padding | 8px 12px |
| List gap | 4-8px |
| Section gap | 32-48px |

### Border Radius

| Element | Radius |
|---------|--------|
| Cards/Modals | 12px |
| Buttons/Inputs | 6px |
| Pills/Badges | 9999px |

---

## Visual Effects

### Elevation (Shadows)

**Low (Card Hover):**
```css
box-shadow: 0px 2px 4px rgba(0,0,0,0.2), 0px 4px 10px rgba(0,0,0,0.1);
```

**Medium (Dropdown):**
```css
box-shadow: 0px 4px 8px rgba(0,0,0,0.4), 0px 12px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05);
```

**High (Modal):**
```css
box-shadow: 0px 20px 48px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1);
```

### Glassmorphism

For floating headers, command palette, toasts:
```css
background: rgba(18, 20, 23, 0.7);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.05);
```

---

## Animation

### Timing & Easing

| Duration | Use |
|----------|-----|
| 150ms | Micro-interactions (hover, focus) |
| 200-300ms | Standard transitions |
| 500ms | Celebrations, entrance |

**Default Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` — buttery smooth

### Stagger Pattern

For lists: 75ms delay per item
```css
animation-delay: calc(var(--index) * 75ms);
```

---

## Design Principles

### 1. Content First
Data is the hero. UI exists to present flight stats clearly.

### 2. Calm Over Flashy
Every element earns its place. Subtle > loud.

### 3. Progressive Disclosure
Show relevant information at the right time.

### 4. Mobile-First
Design for mobile, enhance for desktop.

---

## Brand Voice

**Tone:** Confident but not arrogant. Technical but accessible. Celebratory but not anxious.

**Copy Guidelines:**
- Use aviation terminology naturally
- Celebrate achievements without creating pressure
- "Your visual legacy" not "Track your flights"
- Percentiles over exact rankings ("Top 15%" not "#47 of 312")

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Multiple accent colors | Single primary color |
| Heavy drop shadows | Soft, atmospheric shadows |
| Decorative gradients | Subtle or none |
| Icon-heavy designs | Typography-driven |
| Pure gray backgrounds | Blue-tinted neutrals |
| Dense layouts | Generous whitespace |
| Daily streaks | Milestone celebrations |
| Progress bars | Earned achievements |

---

## Quick Reference

**Brand Colors (copy-paste):**
```
Primary: #5E6AD2
Background: #08090A
Surface: #121417
Text: #F2F4F7
Text Muted: #8A8F98
Border: rgba(255,255,255,0.08)
Success: #2EB88A
Error: #E5484D
```

**Fonts:**
- DM Sans (headings + body)
- JetBrains Mono (data + code)

**Radius:** 12px containers, 6px buttons

**Direction:** Nordic Skies — Scandinavian minimalism meets Linear precision
