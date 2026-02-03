# Kuuki DNA: Design Philosophy

> Design principles and component selection guidance.
> For exact tokens and code snippets, see `.interface-design/system.md`.

---

## Design Direction

**Name:** Warm Japanese Minimalism

**Feel:** Traditional Japanese aesthetics (Ma, Shibui) in light mode, high-precision instrumentation in dark mode.

**Temperature:**

- Light mode: Warm paper-like neutrals (Washi) — breathable, organic
- Dark mode: Deep ink/charcoal with warm lantern accents — focused, atmospheric

**Signature elements:**

- **Hiragana (くうき):** Atmospheric branding
- Generous whitespace ('Ma')
- Soft rounded corners (16-32px for containers)
- Subtle "lantern" glows (Coral/Warm light)
- Typography-driven hierarchy
- Monochromatic palette with Coral/Terracotta accent

**Target aesthetic:** Modern travelers who value mindfulness and precision. Think: Kyoto design studio meets cockpit avionics.

---

## Design Principles

### 1. Content First

Data is the hero. UI exists to present flight stats clearly.

| Do | Don't |
|----|-------|
| Large, readable numbers | Decorative illustrations |
| Clear data hierarchy | Competing visual elements |
| Whitespace for breathing room | Dense, cramped layouts |

### 2. Calm Over Flashy

Avoid visual noise. Every element should earn its place.

| Do | Don't |
|----|-------|
| Subtle hover states | Flashy animations |
| Soft shadows | Hard drop shadows |
| Muted backgrounds | Gradient overload |
| Reserve celebration for milestones | Confetti on every action |

### 3. Progressive Disclosure

Show relevant information at the right time.

| Do | Don't |
|----|-------|
| Stats tabs unlock with data | Show empty tabs |
| "Add more details" expands form | Show all fields always |
| Sample data for empty states | Just "Add your first flight" |

### 4. Mobile-First Responsive

Design for mobile, enhance for desktop.

| Do | Don't |
|----|-------|
| Bottom tab bar on mobile | Shrink desktop nav |
| Touch-friendly targets (44px) | Tiny tap targets |
| Cards on mobile, tables on desktop | Same layout everywhere |

---

## Component Selection Guide

### When to Use What

| Need | Component | Notes |
|------|-----------|-------|
| Primary action | `<Button>` | Solid fill, high contrast |
| Secondary action | `<Button variant="outline">` | Border only |
| Tertiary/subtle | `<Button variant="ghost">` | Text only |
| Data container | `<Card>` | Subtle border, shadow on hover |
| Modal dialog | `<Dialog>` | Centered, backdrop blur |
| Side panel | `<Sheet>` | Full height, slide from edge |
| Form input | `<Input>` | With `<Label>` and `<FormMessage>` |
| Selection | `<Select>` or `<Combobox>` | Combobox for searchable |
| Toggle | `<Switch>` | For boolean settings |
| Loading | `<Skeleton>` | Match content shape |
| Notification | `toast()` | Aviation-themed messages |

### Dialog vs Sheet

| Use Dialog for | Use Sheet for |
|----------------|---------------|
| Confirmations | Settings panels |
| Quick forms (add flight) | Filter drawers |
| Focused tasks | Detail views |
| Content that fits viewport | Content that scrolls |

### Card Patterns

**Stats card:**

```
┌─────────────────────────────┐
│  [Icon]          Top right  │
│                             │
│  42,000                     │  ← Large number
│  Distance (km)              │  ← Muted label
└─────────────────────────────┘
```

**Flight card:**

```
┌─────────────────────────────┐
│  JFK ●────[2h 30m]────● LHR │  ← Route visualization
│  New York          London   │  ← City names
│                             │
│  United · 737-800           │  ← Details row
│  Jan 15, 2026               │  ← Date
└─────────────────────────────┘
```

---

## Color Usage

### Semantic Colors

| Token | Use for |
|-------|---------|
| `primary` | Actions, links, active states |
| `destructive` | Delete, errors, warnings |
| `success` | Confirmations, positive states |
| `muted` | Backgrounds, disabled states |
| `muted-foreground` | Secondary text, labels |

### When NOT to Add Color

- Stats numbers (use foreground, not colored)
- Icons (muted or primary only)
- Borders (always border token)
- Backgrounds (background/card/muted only)

**Exception:** Badge colors for achievements (each badge can have its own accent).

### Data Visualization

Use the 10-color chart palette for multi-category displays:

- `chart-1` through `chart-10`
- Primary category: `chart-1` (teal)
- Limit to 4-6 colors per chart for readability

---

## Typography Rules

### Font Pairing

| Role | Font | Weight |
|------|------|--------|
| Display/Headings | DM Sans | Semibold |
| Body text | DM Sans | Normal |
| Data/numbers | JetBrains Mono | Medium |
| Code/technical | JetBrains Mono | Normal |

### Size Scale

| Role | Class | When to use |
|------|-------|-------------|
| Display | `text-4xl` to `text-6xl` | Page titles, hero stats |
| Heading | `text-2xl` to `text-3xl` | Section titles |
| Subhead | `text-lg` | Card titles, labels |
| Body | `text-base` | Main content |
| Small | `text-sm` | Secondary info |
| Caption | `text-xs` | Timestamps, hints |

### Data Display

Always use `font-mono` for:

- Flight numbers
- IATA codes
- Distances
- Durations
- Counts

```typescript
<span className="font-mono font-semibold">42,847 km</span>
```

---

## Animation Guidelines

### Timing

| Duration | Use for |
|----------|---------|
| 150ms | Micro-interactions (hover, focus) |
| 300ms | Standard transitions (modals, tabs) |
| 500ms | Entrance animations, celebrations |

### Easing

**Default:** `cubic-bezier(0.16, 1, 0.3, 1)` — Linear's "buttery smooth"

### What to Animate

| Animate | Don't animate |
|---------|---------------|
| Modal entrance/exit | Data updates |
| Hover states | Color changes |
| Tab transitions | Layout shifts |
| Page transitions | Skeleton loading |
| Celebration moments | Every interaction |

### Staggered Animations

For lists and grids, stagger by 75ms:

```typescript
style={{ animationDelay: `${index * 75}ms` }}
```

---

## Responsive Breakpoints

| Breakpoint | Width | UI changes |
|------------|-------|------------|
| Mobile | < 640px | Bottom tab bar, cards, single column |
| Tablet | 640-1024px | Side nav appears, 2-column grids |
| Desktop | 1024-1920px | Full nav, tables, 4-column grids |
| Large | > 1920px | Two-panel layouts, extra wide dialogs |

### Mobile-Specific Patterns

| Desktop | Mobile |
|---------|--------|
| Left sidebar | Bottom tab bar |
| Data tables | Card list |
| Horizontal filters | Bottom sheet |
| Dialog | Full-screen modal |
| Hover tooltips | Tap to reveal |

---

## Empty State Design

### Philosophy

Empty states are an opportunity, not a dead end.

### Pattern

```
┌─────────────────────────────────────┐
│                                     │
│         [Illustration/Icon]         │
│                                     │
│     Your flight log is empty        │  ← Clear headline
│                                     │
│   This could be you. Import your    │  ← Helpful subtext
│   flights to see stats like this:   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  [Sample stats preview]     │   │  ← Show what's possible
│   └─────────────────────────────┘   │
│                                     │
│       [Import Flights] [Add One]    │  ← Clear CTAs
│                                     │
└─────────────────────────────────────┘
```

### Rules

- Show sample data, not just "nothing here"
- Provide clear next action
- Use playful but not childish tone
- Match the overall aesthetic

---

## Dark Mode Considerations

### Surface Layering

```
Background (darkest)
  → Card (slightly lighter)
    → Elevated elements (lighter still)
```

### Glow Effects

In dark mode, use colored glows for focus states:

```css
/* Focus glow */
box-shadow: 0 0 15px oklch(0.55 0.22 275 / 0.3);
```

Use sparingly — only on:

- Input focus
- Active card states
- Selected items

### Border Adjustments

Borders are more visible in dark mode. Use `/50` opacity:

```typescript
className="border-border/50 dark:border-border/30"
```

---

## Anti-Patterns

### Visual Anti-Patterns

| Don't | Why | Do instead |
|-------|-----|------------|
| Multiple accent colors | Visual noise | Single primary color |
| Heavy drop shadows | Dated, heavy | Soft, atmospheric shadows |
| Decorative gradients | Distracting | Subtle or none |
| Icon-heavy designs | Cluttered | Typography-driven |
| Pure gray backgrounds | Cold, sterile | Blue-tinted neutrals |
| Dense layouts | Overwhelming | Generous whitespace |

### UX Anti-Patterns

| Don't | Why | Do instead |
|-------|-----|------------|
| Tooltips for essential info | Mobile can't hover | Inline or expandable |
| Confirmation modals for everything | Annoying | Inline "click again to confirm" |
| Loading spinners | Jarring | Skeleton placeholders |
| Success modals | Interrupts flow | Toast notification |
| Onboarding tutorials | Ignored | Learn by doing with sample data |

---

## Quick Reference

### New Feature Checklist

Before building UI for a new feature:

- [ ] Does it follow content-first principle?
- [ ] Is it calm, not flashy?
- [ ] Does it use progressive disclosure?
- [ ] Is it mobile-first?
- [ ] Uses semantic color tokens?
- [ ] Uses correct typography scale?
- [ ] Has appropriate empty state?
- [ ] Works in dark mode?
- [ ] Animations are subtle and purposeful?

### LLM Guidance

When generating UI code:

1. **Use shadcn components** — Don't reinvent buttons, cards, dialogs
2. **Use design tokens** — `bg-background`, not `bg-white`
3. **Use cn() helper** — For conditional classes
4. **Mobile-first** — Write base styles for mobile, add breakpoint modifiers
5. **Check system.md** — For exact token values and component examples
