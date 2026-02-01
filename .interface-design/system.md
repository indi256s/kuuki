# Kuuki Design System

## Direction

**Feel:** Nordic Skies — the quiet calm of Scandinavian minimalism. Soft, airy, inviting. Like the gentle light of a Nordic morning, unhurried and peaceful.

**Temperature:** Cool neutrals with subtle blue undertones (slate-blue, soft stone gray) creating a serene, spacious atmosphere.

**Signature:** Generous whitespace, soft rounded corners, subtle hover animations. Clean typography that breathes.

**Target:** Aviation enthusiasts who appreciate refined simplicity — modern travelers who value both function and aesthetics.

---

## Tech Stack

**Component Library:** shadcn/ui (New York style)
**CSS Framework:** Tailwind CSS v4
**Color Space:** OKLCH for perceptually uniform colors
**Typography:** DM Sans (display/body) + JetBrains Mono (data)
**Icons:** Lucide React

---

## Breakpoints

Standard Tailwind breakpoints plus custom additions for large displays:

| Breakpoint | Width | Use case |
|------------|-------|----------|
| `sm` | 640px | Tablets, large phones |
| `md` | 768px | Small laptops |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktop monitors |
| `2xl` | 1536px | Large monitors |
| `3xl` | 1920px | Full HD+ / 1080p monitors |
| `4xl` | 2560px | 4K / WQHD displays |

**Large display considerations:**
- Users sit further from large monitors — UI elements can be larger
- Dialogs and forms benefit from extra width
- Maintain the "floating card" feel — don't go full-screen

---

## Depth Strategy

**Subtle shadows + borders**

Surfaces float gently above the canvas. Shadows are atmospheric, not dramatic. Borders are barely visible, defining space without harsh lines.

```css
/* Shadows are soft and minimal */
hover:shadow-md /* Only on interaction */

/* Borders are whisper-thin */
border-border/50    /* Default - barely there */
border-border       /* Hover - slightly stronger */
```

---

## Spacing

**Base unit: 4px** (Tailwind default)

Scale: 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px)

Prefer generous spacing. Let elements breathe.

---

## Color Tokens (OKLCH)

### Core Palette

```css
--background: oklch(0.985 0.002 240);  /* Soft off-white with blue tint */
--foreground: oklch(0.25 0.01 260);    /* Deep warm gray */
--card: oklch(1 0 0);                   /* Pure white */
--muted: oklch(0.97 0.003 250);        /* Subtle background */
--muted-foreground: oklch(0.55 0.01 260);
```

### Primary (Nordic Blue)

```css
--primary: oklch(0.65 0.12 240);        /* Soft sky blue */
--primary-foreground: oklch(0.99 0 0);
```

### Secondary (Warm Stone)

```css
--secondary: oklch(0.96 0.005 260);
--secondary-foreground: oklch(0.35 0.01 260);
```

### Semantic

```css
--destructive: oklch(0.65 0.18 25);     /* Soft coral red */
--success: oklch(0.72 0.14 160);        /* Calm green */
--warning: oklch(0.82 0.12 85);         /* Warm amber */
```

### Legacy Mapping

For backwards compatibility, legacy tokens map to new system:

```css
--color-runway → --primary
--color-ink → --foreground
--color-sky → --background
--color-edge → --border
--color-cleared → --success
--color-emergency → --destructive
```

---

## Typography

**Font Family:**

```css
--font-display: "DM Sans", system-ui, sans-serif;
--font-sans: "DM Sans", system-ui, sans-serif;
--font-mono: "JetBrains Mono", monospace;
```

**Letter Spacing:**

```css
--tracking-tight: -0.025em;   /* Headlines */
--tracking-normal: -0.01em;   /* Body text */
```

### Scale

| Role | Class | Weight | Notes |
|------|-------|--------|-------|
| Display | text-4xl to text-6xl | semibold | tracking-tight |
| Heading | text-2xl to text-3xl | semibold | tracking-tight |
| Subhead | text-lg | medium | |
| Body | text-base | normal | |
| Small | text-sm | normal | muted-foreground |
| Caption | text-xs | normal | muted-foreground |
| Data | font-data | medium | tabular-nums |

---

## Border Radius

**Base: 0.875rem (14px)**

Using shadcn scale:

```css
--radius-sm: 8px    /* Badges, chips */
--radius-md: 10px   /* Inputs */
--radius-lg: 14px   /* Cards, buttons */
--radius-xl: 18px   /* Large containers */
--radius-2xl: 22px  /* Hero elements */
```

Prefer generous, soft corners. Scandinavian = rounded and inviting.

---

## Component Patterns

### Card

```tsx
<Card className="border-border/50 hover:border-border hover:shadow-md transition-all">
  <CardContent className="p-5">
    {/* Content */}
  </CardContent>
</Card>
```

- Subtle border (50% opacity)
- Shadow only on hover
- Smooth transition

### Button

```tsx
<Button>Primary Action</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
```

- Primary: Solid fill, high contrast
- Outline: Border only, subtle
- Ghost: Text only, minimal

### Stats Card

```tsx
<Card className="group hover:shadow-md transition-all">
  <CardContent className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-3xl font-semibold font-data">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <div className="p-2.5 rounded-xl bg-secondary/50 group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5 text-primary" />
      </div>
    </div>
  </CardContent>
</Card>
```

### Dialog/Modal

Dialogs use responsive sizing that scales with viewport. Use the `size` prop for explicit control:

```tsx
<Dialog>
  <DialogContent size="md"> {/* Default - scales with breakpoints */}
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

**Size variants:**

| Size | When to use |
|------|-------------|
| `sm` | Confirmations, simple prompts |
| `md` | Default — general purpose, scales with viewport |
| `lg` | Forms with multiple fields (like FlightForm) |
| `xl` | Complex multi-step content |
| `full` | Import review, data-heavy views |

**Responsive behavior (size="md"):**

| Breakpoint | Max width |
|------------|-----------|
| Mobile | `calc(100% - 2rem)` |
| `sm` | 512px (max-w-lg) |
| `lg` | 576px (max-w-xl) |
| `xl` | 672px (max-w-2xl) |
| `3xl` | 768px (max-w-3xl) |
| `4xl` | 896px (max-w-4xl) |

- Padding also scales: `p-6` → `lg:p-8` → `xl:p-10`
- Close button position adjusts for larger padding
- Rounded corners, centered with backdrop blur

### Sheet (Side Panel)

Slide-over panels for content that benefits from full height:

```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button>Open</Button>
  </SheetTrigger>
  <SheetContent side="right" size="md">
    <SheetHeader>
      <SheetTitle>{title}</SheetTitle>
    </SheetHeader>
    {/* Content */}
  </SheetContent>
</Sheet>
```

- Same `size` variants as Dialog
- `side` prop: `"left"` | `"right"` | `"top"` | `"bottom"`
- Best for: settings panels, filter drawers, detail views

### Route Visualization

Flight routes use a distinctive visual pattern with gradient lines and centered plane icon:

```tsx
<div className="flex items-center gap-3">
  {/* Origin */}
  <div>
    <div className="font-mono font-semibold text-base">{origin}</div>
    <div className="text-xs text-muted-foreground">{city}</div>
  </div>

  {/* Flight path */}
  <div className="flex items-center flex-1">
    <div className="w-2 h-2 rounded-full bg-primary/60" />
    <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/30 to-primary/60" />
    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
      <PlaneIcon className="w-3 h-3 text-primary rotate-90" />
    </div>
    <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/30 to-primary/60" />
    <div className="w-2 h-2 rounded-full bg-primary/60" />
  </div>

  {/* Destination */}
  <div className="text-right">
    <div className="font-mono font-semibold text-base">{destination}</div>
    <div className="text-xs text-muted-foreground">{city}</div>
  </div>
</div>
```

- Airport codes in `font-mono` for data clarity
- Gradient line creates depth and movement
- Dots at endpoints represent airports
- Plane icon centered on the route

---

## Page Layouts

### Responsive Two-Column Layout

For data-heavy pages on large screens (3xl+), use sidebar + content layout:

```tsx
// Detect large screen
const [isLargeScreen, setIsLargeScreen] = useState(false)

useEffect(() => {
  const mq = window.matchMedia('(min-width: 1920px)')
  setIsLargeScreen(mq.matches)
  mq.addEventListener('change', (e) => setIsLargeScreen(e.matches))
}, [])

// Render layout
<main className="max-w-6xl 3xl:max-w-[1600px] 4xl:max-w-[1800px] mx-auto px-6">
  {isLargeScreen ? (
    <div className="flex gap-8">
      <aside className="w-72 flex-shrink-0">
        <FilterSidebar /> {/* Sticky */}
      </aside>
      <div className="flex-1 min-w-0">
        <ContentArea />
      </div>
    </div>
  ) : (
    <>
      <HorizontalFilters />
      <ContentArea />
    </>
  )}
</main>
```

**Key principles:**
- Sidebar width: `w-72` (288px) — enough for filters, not too wide
- Sidebar position: `sticky top-24` — stays visible while scrolling
- Main content: `flex-1 min-w-0` — fills remaining space, allows shrinking
- Gap: `gap-8` (32px) — generous separation

### Page Max Widths

| Breakpoint | Max width | Use case |
|------------|-----------|----------|
| Default | `max-w-6xl` (1152px) | Standard content |
| `3xl` | `max-w-[1600px]` | Two-column layouts |
| `4xl` | `max-w-[1800px]` | Extra wide content |

---

## Filter Patterns

### FlightFilters Component

Dual-mode component that renders as horizontal bar or vertical sidebar:

```tsx
<FlightFilters
  layout="horizontal" // or "vertical"
  filters={filters}
  onFiltersChange={setFilters}
  // ... other props
/>
```

**Horizontal mode (mobile/tablet):**
- Dropdowns in a row with wrapping
- Airport search inputs below
- Count displayed on the right

**Vertical mode (3xl+ sidebar):**
- Stacked sections with labels
- Flight count summary card at top
- Separators between filter groups
- Icons for visual hierarchy

---

## Table Patterns

### FlightTable

Data tables with progressive column visibility:

| Column | Visible at |
|--------|------------|
| Date, Route, Actions | Always |
| Airline | `lg` (1024px+) |
| Times, Aircraft | `xl` (1280px+) |
| Distance, Duration | `3xl` (1920px+) |

**Row styling:**
- Alternating backgrounds: `index % 2 === 0 && 'bg-muted/20'`
- Upcoming flights: `bg-primary/[0.02]` subtle tint
- Actions fade until hover: `opacity-50 group-hover:opacity-100`
- Generous row padding: `py-4`

---

## Animation

**Timing:**

```css
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;
```

**Utilities:**

```css
.animate-fade-in    /* Opacity 0 → 1 */
.animate-fade-up    /* Opacity + translateY */
.animate-scale-in   /* Opacity + scale */
.stagger-children   /* Auto-delay children */
```

**Principles:**

- Subtle, purposeful motion
- No bounce or spring effects
- Stagger page load animations
- Scale icons on hover (group-hover:scale-110)

---

## Glassmorphism (Sparingly)

```css
.glass {
  background: oklch(1 0 0 / 0.8);
  backdrop-filter: blur(12px);
}
```

Use for:

- Sticky headers
- Overlays

Avoid overuse.

---

## Dark Mode

Full dark mode support with user preference persistence.

**Theme Hook:** `useTheme()` from `@/hooks/useTheme`

```tsx
const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

// theme: 'light' | 'dark' | 'system'
// resolvedTheme: 'light' | 'dark' (actual applied theme)
// setTheme: (theme) => void
// toggleTheme: () => void
```

**Theme Toggle:** `<ThemeToggle />` from `@/components/common/ThemeToggle`

- Sun/Moon icon button
- Already integrated in `AppHeader` and `DashboardPage`

**Storage:** `localStorage` key `kuuki-theme`

**CSS:** `.dark` class on `<html>` element activates dark tokens.

### Dark Palette

```css
--background: oklch(0.16 0.01 260);  /* Deep slate */
--foreground: oklch(0.95 0.005 250); /* Near white */
--card: oklch(0.2 0.01 260);          /* Elevated slate */
--primary: oklch(0.7 0.12 240);       /* Brighter blue */
--border: oklch(0.28 0.01 260);       /* Subtle edge */
```

**Best Practices:**

- Use semantic tokens (`bg-background`, `text-foreground`) not raw colors
- Test both themes during development
- Use `dark:` variants for hardcoded colors

---

## Anti-patterns

**Avoid:**

- Harsh borders as primary structure
- Multiple competing accent colors
- Dense layouts without breathing room
- Heavy shadows (keep it airy)
- Generic Inter/Roboto fonts
- Pure gray (add slight blue undertone)
- Icon-heavy metric cards
- Decorative gradients (except subtle bg-gradient-soft)

**Prefer:**

- Generous whitespace
- Soft, rounded corners
- Subtle hover states
- Typography-driven hierarchy
- Monochromatic with one accent color
- Content-first layouts

---

## Mascot

**Name:** Kuuki Cloud

**Usage:**

- Empty states
- Onboarding flows
- Achievement unlocks

Do not overuse in dense data views.

---

## File Structure

```
apps/web/src/
├── components/
│   └── ui/           # shadcn components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       └── ...
├── index.css         # Design tokens + utilities
└── lib/
    └── utils.ts      # cn() helper
```

---

## Last Updated

2026-02-01 — Added 4K support, responsive layouts, route visualization patterns
