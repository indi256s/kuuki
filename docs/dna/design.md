# Kuuki DNA: Design Philosophy

> Design principles and component selection guidance.
> For exact tokens and code snippets, see `.interface-design/system.md`.

---

## Design Direction

**Name:** Warm Japanese Minimalism

**Feel:** Traditional Japanese aesthetics (Ma, Shibui) in light mode, **Mad Scientist / Laboratory** in dark mode.

**Temperature:**

- Light mode: Warm paper-like neutrals (Washi) — breathable, organic
- Dark mode: Deep ink/charcoal with vibrant experimental accents — focused, energetic

**Signature elements:**

- **Hiragana (くうき):** Atmospheric branding
- Generous whitespace ('Ma')
- Soft rounded corners (16-32px for containers)
- **Experimental Glows:** Dynamic, pulse-like energy (Science/Magic)
- Typography-driven hierarchy
- **Data Density:** High (Bento/Grid layouts)

**Target aesthetic:** Modern travelers who feel like crazy scientists analyzing their own life data. Think: Kyoto design studio meets Portal's GLaDOS (but friendly).

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

### Performance Rules

**Only animate compositor-friendly properties:**

```tsx
// ❌ Don't: transition-all triggers layout reflow
className="transition-all duration-200"

// ✅ Do: Explicit properties, only transform/opacity
className="transition-[transform,opacity] duration-200"
// or
className="transition-transform duration-200"
```

**Never use `transition: all`** — always list specific properties.

### Reduced Motion

Respect `prefers-reduced-motion`. Already handled in `index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

For custom animations, provide static fallbacks:

```tsx
// Animated version shows; static version is visible for reduced motion users
<div className="animate-fade-up motion-reduce:animate-none motion-reduce:opacity-100">
```

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

### Always-Dark Sections (Auth Pages)

Some sections like login/signup have a dark atmospheric background regardless of system theme.

**Still use semantic tokens** — they work because the wrapper has `dark` class:

```tsx
// ❌ Don't: Hardcode white for dark backgrounds
<span className="text-white/80">Email</span>
<Input className="text-white placeholder:text-white/20" />

// ✅ Do: Use semantic tokens (they resolve correctly in dark context)
<span className="text-foreground/80">Email</span>
<Input className="text-foreground placeholder:text-muted-foreground/50" />
```

The auth page wrapper should have `className="dark"` to force dark mode tokens.

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

### Code Anti-Patterns

**Never use these Tailwind classes** — they bypass the design system:

| Don't | Why | Do instead |
|-------|-----|------------|
| `text-white`, `text-black` | Hardcoded, breaks themes | `text-foreground`, `text-primary-foreground` |
| `bg-white`, `bg-black` | Hardcoded, breaks themes | `bg-background`, `bg-card`, `bg-popover` |
| `bg-neutral-*`, `text-neutral-*` | Not in our token system | `bg-muted`, `text-muted-foreground` |
| `border-black/*`, `border-white/*` | Hardcoded borders | `border-border`, `border-border/50` |
| `shadow-[rgba(...)]` | Inline shadows | `shadow-sm`, `ring-1 ring-border/50` |
| Custom styled `<a>`/`<Link>` as button | Inconsistent states | `<Button asChild>` |

**Example — Button as Link:**

```tsx
// ❌ Don't: Custom styled link
<Link to="/" className="px-6 py-3 bg-primary text-primary-foreground rounded-lg...">
  Sign In
</Link>

// ✅ Do: Button with asChild
<Button asChild size="lg">
  <Link to="/">Sign In</Link>
</Button>
```

### UX Anti-Patterns

| Don't | Why | Do instead |
|-------|-----|------------|
| Tooltips for essential info | Mobile can't hover | Inline or expandable |
| Confirmation modals for everything | Annoying | Inline "click again to confirm" |
| Loading spinners | Jarring | Skeleton placeholders |
| Success modals | Interrupts flow | Toast notification |
| Onboarding tutorials | Ignored | Learn by doing with sample data |
| Immediate destructive actions | No recovery | Confirmation modal or undo |
| Zoom restrictions | Accessibility violation | Never use `user-scalable=no` |

### Accessibility Anti-Patterns

| Don't | Why | Do instead |
|-------|-----|------------|
| Icon button without `aria-label` | Invisible to screen readers | Add descriptive label |
| Input without `<label>` | Form inaccessible | Use `htmlFor` or wrap |
| `<div onClick>` for actions | No keyboard/AT support | Use `<button>` |
| `outline-none` alone | Focus invisible | Add `focus-visible:ring-*` |
| Hardcoded date formats | Locale issues | Use `Intl.DateTimeFormat` |
| Large lists without virtualization | Performance | Use `virtua` or `content-visibility` |
| `autoFocus` on mobile | Opens keyboard unexpectedly | Desktop only, sparingly |

---

## Accessibility Requirements

Based on [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).

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

Icons next to text labels are decorative — hide from screen readers:

```tsx
<Label className="flex items-center gap-2">
  <Mail className="w-4 h-4" aria-hidden="true" />
  Email
</Label>
```

### Focus States

- **Always show focus** — Never use `outline-none` without a replacement
- **Use `focus-visible:`** — Not `focus:` (avoids ring on mouse click)
- **Compound controls** — Use `focus-within:` for grouped elements

```tsx
// ✅ Correct focus pattern
className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### Semantic HTML

| Need | Use | Not |
|------|-----|-----|
| Action | `<button>` | `<div onClick>` |
| Navigation | `<Link>` or `<a>` | `<button>` with router push |
| Toggle | `<button aria-expanded>` | `<div>` |
| Alert | `<div role="alert">` | Plain `<div>` |

### Screen Reader Announcements

Use `aria-live` for async updates (toasts, validation):

```tsx
<div aria-live="polite">{statusMessage}</div>
```

---

## Form Requirements

### Input Attributes

Every form input **must** have:

| Attribute | Purpose |
|-----------|---------|
| `name` | Form submission, autocomplete |
| `autocomplete` | Password managers, autofill |
| `type` | Correct keyboard on mobile |

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
  autoComplete="current-password"  // or "new-password" for signup
/>
```

### Common Autocomplete Values

| Field | Value |
|-------|-------|
| Email | `autocomplete="email"` |
| Password (login) | `autocomplete="current-password"` |
| Password (signup) | `autocomplete="new-password"` |
| Name | `autocomplete="name"` |
| Phone | `autocomplete="tel"` |
| Non-auth fields | `autocomplete="off"` |

### Labels

Every input needs a label — either via `htmlFor` or wrapping:

```tsx
// Option 1: htmlFor
<Label htmlFor="email">Email</Label>
<Input id="email" />

// Option 2: Wrap (for custom controls)
<label>
  <span>Email</span>
  <Input />
</label>
```

### Error Handling

- Display errors **inline** next to fields, not in modals
- Focus first error on form submit
- Use `role="alert"` for error containers

```tsx
<div role="alert" className="text-destructive text-sm">
  {error.message}
</div>
```

### Form UX

| Do | Don't |
|----|-------|
| Keep submit enabled until request starts | Disable submit while typing |
| Show spinner during request | Show generic "loading" |
| Focus first error on submit | Show all errors in modal |
| Warn before losing unsaved changes | Silent data loss |
| Never block paste | `onPaste + preventDefault` |

---

## Touch & Mobile

### Touch Targets

Minimum **44×44px** for all interactive elements (WCAG 2.5.5):

```tsx
// ✅ Proper touch target
<button className="min-h-[44px] min-w-[44px] p-3">
```

### Prevent Double-Tap Zoom

Add to all interactive elements:

```tsx
className="touch-action-manipulation"
// or in CSS: touch-action: manipulation;
```

### Safe Areas

Full-bleed layouts must respect notches:

```tsx
// ✅ Already in index.css
.pb-safe { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
.h-tab-bar { height: calc(64px + env(safe-area-inset-bottom)); }
```

### Modal Scroll Containment

Prevent scroll "bleed" through modals:

```tsx
<SheetContent className="overscroll-behavior-contain">
```

### AutoFocus

Use sparingly:

- ✅ Single primary input on desktop
- ❌ Never on mobile (opens keyboard unexpectedly)
- ❌ Never multiple elements

---

## Internationalization

### Date & Number Formatting

**Never hardcode formats.** Use `Intl.*` APIs:

```tsx
// ❌ Don't
const date = `${d.getMonth()}/${d.getDate()}/${d.getFullYear()}`

// ✅ Do
const date = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}).format(d)

// ❌ Don't
const distance = `${km.toFixed(0)} km`

// ✅ Do
const distance = new Intl.NumberFormat(locale).format(km) + ' km'
```

### Language Detection

Use browser APIs, not IP geolocation:

```tsx
const locale = navigator.language || 'en-US'
```

---

## Quick Reference

### New Feature Checklist

Before building UI for a new feature:

**Design**

- [ ] Does it follow content-first principle?
- [ ] Is it calm, not flashy?
- [ ] Does it use progressive disclosure?
- [ ] Is it mobile-first?
- [ ] Uses semantic color tokens?
- [ ] Uses correct typography scale?
- [ ] Has appropriate empty state?
- [ ] Works in dark mode?

**Accessibility**

- [ ] All buttons have visible text OR `aria-label`
- [ ] All inputs have associated `<label>`
- [ ] Focus states visible (`focus-visible:ring-*`)
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Uses semantic HTML (`<button>`, `<a>`, not `<div onClick>`)

**Forms**

- [ ] Inputs have `name` and `autocomplete` attributes
- [ ] Correct input `type` (email, tel, password)
- [ ] Errors displayed inline, first error focused
- [ ] Unsaved changes warning if applicable

**Animation**

- [ ] No `transition-all` — specific properties only
- [ ] Only animates `transform`/`opacity`
- [ ] Respects `prefers-reduced-motion`

**Touch & Mobile**

- [ ] Touch targets minimum 44×44px
- [ ] Safe area insets for full-bleed
- [ ] No `autoFocus` on mobile

### LLM Guidance

When generating UI code:

**Components & Styling**

1. **Use shadcn components** — Don't reinvent buttons, cards, dialogs
2. **Use design tokens** — `bg-background`, not `bg-white`; `text-foreground`, not `text-gray-900`
3. **Use cn() helper** — For conditional classes
4. **Mobile-first** — Write base styles for mobile, add breakpoint modifiers
5. **Button for all button-like elements** — Use `<Button asChild>` for links that look like buttons
6. **No hardcoded colors** — If you type `white`, `black`, `neutral`, or `gray` in a class, stop and use a token

**Accessibility**
7. **Icon buttons need aria-label** — `<button aria-label="Close"><X aria-hidden="true" /></button>`
8. **Decorative icons need aria-hidden** — Icons next to text labels get `aria-hidden="true"`
9. **Semantic HTML** — Use `<button>` for actions, `<Link>` for navigation, never `<div onClick>`

**Forms**
10. **Inputs need name + autocomplete** — `<Input name="email" autoComplete="email" />`
11. **Labels required** — Every input needs `<Label htmlFor>` or be wrapped in `<label>`

**Animation**
12. **No transition-all** — Use `transition-transform` or `transition-[prop1,prop2]`
13. **Only animate transform/opacity** — Compositor-friendly, no layout thrashing

**Check Anti-Patterns sections above for common violations.**
