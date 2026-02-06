# Kuuki - Frontend Guidelines

> **For AI Agents:** Complete design system with exact tokens, code examples, and patterns. Reference this for every component you create.

---

## Design Direction

**Name:** Warm Japanese Minimalism

**Feel:**
- Light mode: Warm paper-like neutrals (Washi) — breathable, organic
- Dark mode: Deep ink/charcoal with amber accents — focused, energetic

**Signature Elements:**
- Hiragana (くうき) for atmospheric branding
- Generous whitespace (Ma)
- Soft rounded corners (14px default)
- Typography-driven hierarchy
- High data density (Bento/Grid layouts)

**Target Aesthetic:** Modern travelers who feel like crazy scientists analyzing their own life data. Kyoto design studio meets Portal's GLaDOS (but friendly).

---

## Color System (OKLCH)

### Light Mode

| Token | OKLCH Value | Use |
|-------|-------------|-----|
| `--background` | `oklch(0.985 0.002 240)` | Page background |
| `--foreground` | `oklch(0.25 0.01 260)` | Body text |
| `--card` | `oklch(1 0 0)` | Card backgrounds |
| `--card-foreground` | `oklch(0.25 0.01 260)` | Card text |
| `--primary` | `oklch(0.55 0.12 25)` | Actions, links, accent |
| `--primary-foreground` | `oklch(0.99 0 0)` | Text on primary |
| `--secondary` | `oklch(0.96 0.005 260)` | Secondary backgrounds |
| `--muted` | `oklch(0.97 0.003 250)` | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.55 0.01 260)` | Secondary text |
| `--border` | `oklch(0.92 0.005 260)` | Borders |
| `--destructive` | `oklch(0.65 0.18 25)` | Errors, delete |
| `--success` | `oklch(0.72 0.14 160)` | Confirmations |
| `--warning` | `oklch(0.82 0.12 85)` | Warnings |
| `--info` | `oklch(0.55 0.10 200)` | Informational states, upcoming flights |
| `--info-foreground` | `oklch(0.3 0.08 200)` | Text on info backgrounds |

### Dark Mode

| Token | OKLCH Value | Use |
|-------|-------------|-----|
| `--background` | `oklch(0.21 0.005 260)` | Page background |
| `--foreground` | `oklch(0.95 0.005 250)` | Body text |
| `--card` | `oklch(0.25 0.005 260)` | Card backgrounds |
| `--primary` | `oklch(0.72 0.14 55)` | Amber accent |
| `--muted` | `oklch(0.26 0.005 260)` | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.65 0.01 260)` | Secondary text |
| `--border` | `oklch(0.32 0.005 260)` | Borders |

### Chart Colors

| Token | OKLCH Value |
|-------|-------------|
| `--chart-1` | `oklch(0.55 0.12 25)` |
| `--chart-2` | `oklch(0.72 0.14 160)` |
| `--chart-3` | `oklch(0.68 0.10 50)` |
| `--chart-4` | `oklch(0.82 0.12 85)` |
| `--chart-5` | `oklch(0.55 0.10 200)` |

---

## Typography

### Font Stack

| Role | Font | Weight | Class |
|------|------|--------|-------|
| Display/Headings | DM Sans | 600 | `font-display font-semibold` |
| Body | DM Sans | 400 | `font-sans` |
| Data/Numbers | JetBrains Mono | 500 | `font-mono font-medium` |

### Size Scale

| Role | Class | When to use |
|------|-------|-------------|
| Display | `text-4xl` to `text-6xl` | Page titles, hero stats |
| Heading | `text-2xl` to `text-3xl` | Section titles |
| Subhead | `text-lg` | Card titles |
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

```tsx
<span className="font-mono font-medium">42,847 km</span>
<span className="font-mono">JFK</span>
```

---

## Spacing

### Scale

| Token | Value |
|-------|-------|
| `--spacing-page` | `clamp(1rem, 5vw, 3rem)` |
| `--radius` | `0.875rem` (14px) |

### Patterns

```tsx
// Section spacing
<div className="space-y-6">

// Card padding
<Card className="p-4 md:p-6">

// Form spacing
<form className="space-y-4">
```

---

## Animation

### Timing

| Duration | Token | Use |
|----------|-------|-----|
| 100ms | `--duration-micro` | Button press, toggles |
| 150ms | `--duration-fast` | Hover states, focus |
| 250ms | `--duration-normal` | Modals, tabs |
| 400ms | `--duration-slow` | Page transitions |

### Easing

| Name | Value | Use |
|------|-------|-----|
| Smooth | `cubic-bezier(0.4, 0, 0.2, 1)` | Default |
| Bounce | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Celebrations |

### Performance Rules

**Only animate compositor-friendly properties:**

```tsx
// NEVER use transition-all
className="transition-all duration-200"  // ❌ Bad

// Always be explicit
className="transition-transform duration-200"  // ✅ Good
className="transition-[transform,opacity] duration-200"  // ✅ Good
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// Provide static fallback
<div className="animate-fade-up motion-reduce:animate-none motion-reduce:opacity-100">
```

### Stagger Animation

```tsx
{items.map((item, index) => (
  <div
    key={item.id}
    style={{ animationDelay: `${index * 75}ms` }}
    className="animate-fade-up"
  >
```

---

## Components

### shadcn/ui Components

| Need | Component | Notes |
|------|-----------|-------|
| Primary action | `<Button>` | Solid fill |
| Secondary action | `<Button variant="outline">` | Border only |
| Tertiary | `<Button variant="ghost">` | Text only |
| Data container | `<Card>` | Subtle border |
| Modal | `<Dialog>` | Centered, backdrop blur |
| Side panel | `<Sheet>` | Full height, slide |
| Form input | `<Input>` | With `<Label>` |
| Selection | `<Select>` or `<Command>` | Command for searchable |
| Toggle | `<Switch>` | Boolean settings |
| Loading | `<Skeleton>` | Match content shape |
| Notification | `toast()` from Sonner | Aviation-themed |

### Dialog vs Sheet

| Use Dialog | Use Sheet |
|------------|-----------|
| Confirmations | Settings panels |
| Quick forms | Filter drawers |
| Focused tasks | Detail views |
| Fits viewport | Content scrolls |

### Button as Link

```tsx
// ❌ Don't: Custom styled link
<Link to="/" className="px-6 py-3 bg-primary...">Sign In</Link>

// ✅ Do: Button with asChild
<Button asChild size="lg">
  <Link to="/">Sign In</Link>
</Button>
```

### Card Patterns

**Stats Card:**
```
┌─────────────────────────────┐
│  [Icon]          Top right  │
│                             │
│  42,000                     │  ← Large number (font-mono)
│  Distance (km)              │  ← Muted label
└─────────────────────────────┘
```

**Flight Card:**
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

## Form Requirements

### Input Attributes

Every form input **must** have:

| Attribute | Purpose |
|-----------|---------|
| `name` | Form submission, autocomplete |
| `autoComplete` | Password managers, autofill |
| `type` | Correct mobile keyboard |

```tsx
// ✅ Complete input
<Input
  type="email"
  name="email"
  autoComplete="email"
  placeholder="you@example.com"
/>

// ✅ Password field
<Input
  type="password"
  name="password"
  autoComplete="current-password"  // or "new-password"
/>
```

### Common Autocomplete Values

| Field | Value |
|-------|-------|
| Email | `autocomplete="email"` |
| Password (login) | `autocomplete="current-password"` |
| Password (signup) | `autocomplete="new-password"` |
| Name | `autocomplete="name"` |
| Non-auth fields | `autocomplete="off"` |

### Labels

Every input needs a label:

```tsx
// Option 1: htmlFor
<Label htmlFor="email">Email</Label>
<Input id="email" />

// Option 2: Wrap
<label>
  <span>Email</span>
  <Input />
</label>
```

### Error Display

```tsx
// Inline errors, not modals
<div role="alert" className="text-destructive text-sm">
  {error.message}
</div>
```

---

## Accessibility

### Icon Buttons

Icon-only buttons **must** have `aria-label`:

```tsx
// ❌ Don't
<button onClick={onClose}><X className="w-4 h-4" /></button>

// ✅ Do
<button onClick={onClose} aria-label="Close dialog">
  <X className="w-4 h-4" aria-hidden="true" />
</button>
```

### Decorative Icons

Icons next to text labels are decorative:

```tsx
<Label className="flex items-center gap-2">
  <Mail className="w-4 h-4" aria-hidden="true" />
  Email
</Label>
```

### Focus States

```tsx
// Always show focus - never use outline-none alone
className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### Semantic HTML

| Need | Use | Not |
|------|-----|-----|
| Action | `<button>` | `<div onClick>` |
| Navigation | `<Link>` | `<button>` with router |
| Toggle | `<button aria-expanded>` | `<div>` |

### Touch Targets

Minimum **44×44px** for all interactive elements:

```tsx
<button className="min-h-[44px] min-w-[44px] p-3">
```

---

## Responsive Design

### Breakpoints

| Breakpoint | Width | Changes |
|------------|-------|---------|
| Mobile | < 640px | Bottom tab bar, cards, single column |
| Tablet | 640-1024px | Side nav, 2-column grids |
| Desktop | 1024-1920px | Full nav, tables, 4-column grids |
| Large | > 1920px | Two-panel layouts |

### Mobile Patterns

| Desktop | Mobile |
|---------|--------|
| Left sidebar | Bottom tab bar |
| Data tables | Card list |
| Horizontal filters | Bottom sheet |
| Dialog | Full-screen modal |
| Hover tooltips | Tap to reveal |

### Safe Areas

```css
.pb-safe { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
.h-tab-bar { height: calc(64px + env(safe-area-inset-bottom)); }
```

---

## Code Patterns

### Conditional Classes

```tsx
import { cn } from '@/lib/utils'

<div className={cn(
  'p-4 rounded-lg',
  isActive && 'bg-primary text-primary-foreground',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

### Design Token Usage

```tsx
// ✅ Use semantic tokens
<div className="bg-background text-foreground border-border">

// ❌ Never use raw colors
<div className="bg-white text-gray-900 border-gray-200">
```

**If you type `white`, `black`, `neutral`, or `gray` in a class, STOP and use a token.**

### Import Order

```tsx
// 1. React
import { useState } from 'react'

// 2. External libraries
import { useQuery } from '@tanstack/react-query'

// 3. Internal absolute imports
import { Button } from '@/components/ui/button'
import { useFlights } from '@/hooks/useFlights'

// 4. Relative imports
import { FlightCard } from './FlightCard'

// 5. Types
import type { Flight } from '@/types'
```

---

## Anti-Patterns

### Visual Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| Multiple accent colors | Visual noise | Single primary color |
| Heavy drop shadows | Dated | Soft, atmospheric shadows |
| Icon-heavy designs | Cluttered | Typography-driven |
| Pure gray backgrounds | Cold | Blue-tinted neutrals |

### Code Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| `text-white`, `text-black` | Hardcoded | `text-foreground` |
| `bg-white`, `bg-black` | Hardcoded | `bg-background`, `bg-card` |
| `bg-neutral-*` | Not in system | `bg-muted` |
| `transition-all` | Performance | Specific properties |
| `<div onClick>` | Accessibility | `<button>` |

### UX Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| Tooltips for essential info | Mobile can't hover | Inline text |
| Confirmation modals everywhere | Annoying | Inline confirm |
| Loading spinners | Jarring | Skeleton placeholders |
| Success modals | Interrupts flow | Toast notification |

---

## Empty States

### Pattern

```
┌─────────────────────────────────────┐
│         [Illustration/Icon]         │
│                                     │
│     Your flight log is empty        │  ← Headline
│                                     │
│   Import your flights or add one    │  ← Helpful subtext
│   to see stats like this:           │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  [Sample stats preview]     │   │  ← Show what's possible
│   └─────────────────────────────┘   │
│                                     │
│       [Import] [Add Flight]         │  ← Clear CTAs
└─────────────────────────────────────┘
```

### Rules

- Show sample data, not just "nothing here"
- Provide clear next action
- Match the overall aesthetic

---

## Dark Mode

### Surface Layering

```
Background (darkest)
  → Card (slightly lighter)
    → Elevated (lighter still)
```

### Border Adjustments

Borders more visible in dark mode:

```tsx
className="border-border/50 dark:border-border/30"
```

---

## Internationalization

### Date & Number Formatting

```tsx
// ❌ Don't hardcode
const date = `${d.getMonth()}/${d.getDate()}`

// ✅ Use Intl
const date = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}).format(d)

const distance = new Intl.NumberFormat(locale).format(km) + ' km'
```

### Language Detection

```tsx
const locale = navigator.language || 'en-US'
```

---

## New Feature Checklist

Before building UI:

**Design**
- [ ] Content-first principle?
- [ ] Calm, not flashy?
- [ ] Progressive disclosure?
- [ ] Mobile-first?
- [ ] Semantic color tokens?
- [ ] Correct typography scale?
- [ ] Has empty state?
- [ ] Works in dark mode?

**Accessibility**
- [ ] Buttons have visible text OR `aria-label`
- [ ] Inputs have `<label>`
- [ ] Focus states visible (`focus-visible:ring-*`)
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Semantic HTML (`<button>`, `<a>`)

**Forms**
- [ ] Inputs have `name` and `autocomplete`
- [ ] Correct input `type`
- [ ] Errors inline, first error focused

**Animation**
- [ ] No `transition-all`
- [ ] Only `transform`/`opacity`
- [ ] Respects `prefers-reduced-motion`

**Touch**
- [ ] Touch targets 44×44px minimum
- [ ] Safe area insets

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [PRD.md](./PRD.md) | Product requirements |
| [TECH_STACK.md](./TECH_STACK.md) | Dependencies |
| [APP_FLOW.md](./APP_FLOW.md) | User flows |
