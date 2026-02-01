# Kuuki Design System

## Direction

**Feel:** Nordic Skies meets Soft Modern Technical — the quiet calm of Scandinavian minimalism in light mode, transitioning to a refined technical precision in dark mode (inspired by Linear).

**Temperature:**
- **Light mode:** Cool neutrals with subtle blue undertones (slate-blue, soft stone gray) — serene, spacious
- **Dark mode:** Deep navy-charcoal base with vibrant functional accents — focused, technical

**Signature:** Generous whitespace, soft rounded corners, subtle hover animations with glow effects. Clean typography that breathes. Active states use colored glows for focus indication.

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

### Data Visualization (10-Color Palette)

For charts, graphs, and multi-category data displays:

```css
--chart-1: oklch(0.62 0.12 185);   /* #17A2A2 - Teal (primary) */
--chart-2: oklch(0.62 0.16 25);    /* #E86B5F - Red */
--chart-3: oklch(0.70 0.14 25);    /* #F58B7C - Coral */
--chart-4: oklch(0.58 0.12 95);    /* #9C8B1B - Olive */
--chart-5: oklch(0.80 0.14 90);    /* #E8C84A - Yellow */
--chart-6: oklch(0.75 0.14 55);    /* #F5A55A - Orange */
--chart-7: oklch(0.68 0.12 300);   /* #A98ED9 - Purple */
--chart-8: oklch(0.68 0.16 250);   /* #4A9FF5 - Blue */
--chart-9: oklch(0.62 0.02 260);   /* #95999E - Gray */
--chart-10: oklch(0.70 0.14 155);  /* #5DBF8A - Green */
```

**Usage:**
- Pie charts: Use 4-6 colors max for readability
- Bar charts: Primary category in `chart-1`, secondary in `chart-8`
- Line charts: Contrasting colors (e.g., `chart-1` vs `chart-2`)
- Progress indicators: `chart-1` for positive, `chart-2` for negative

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

Two-tier approach: soft for containers, tighter for interactive elements:

```css
/* Containers (soft, Scandinavian) */
--radius-lg: 14px   /* Cards */
--radius-xl: 16px   /* Large containers - Linear uses 16px */
--radius-2xl: 22px  /* Hero elements */

/* Interactive elements (tighter, technical) */
--radius-sm: 6px    /* Badges, chips */
--radius-md: 8px    /* Inputs, buttons - Linear uses 6-8px */

/* Special */
--radius-full: 9999px  /* Toggles, pills */
```

**Philosophy:**
- Cards/containers: Soft, rounded, inviting (Scandinavian)
- Inputs/buttons: Tighter, precise, technical (Linear)
- This contrast creates visual hierarchy between surface and interaction

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

Flight routes use a distinctive visual pattern with gradient lines and duration badge centered:

```tsx
<div className="flex items-center gap-3">
  {/* Origin */}
  <div>
    <div className="font-mono font-semibold text-base">{origin}</div>
    <div className="text-xs text-muted-foreground">{city}</div>
  </div>

  {/* Flight path with duration */}
  <div className="flex items-center flex-1">
    <div className="w-2 h-2 rounded-full bg-primary/60" />
    <div className="flex-1 h-px bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
    {/* Duration badge */}
    <div className="px-2 py-0.5 rounded-full bg-muted/80 border border-border/50">
      <span className="text-xs font-mono text-muted-foreground">{duration}</span>
    </div>
    <div className="flex-1 h-px bg-gradient-to-l from-primary/60 via-primary/20 to-transparent" />
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
- Gradient lines fade toward the center for depth
- Duration badge replaces plane icon — more informative
- Dots at endpoints represent airports

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

Data tables with horizontal scroll and sticky columns:

```tsx
<Card className="overflow-hidden">
  <div className="overflow-x-auto">
    <Table className="min-w-[900px]">
      {/* All columns always visible, scrollable on smaller screens */}
    </Table>
  </div>
</Card>
```

**Sticky columns:**
- Date column: `sticky left-0` — always visible when scrolling
- Actions column: `sticky right-0` — always accessible

**Row styling:**
- Alternating backgrounds: `index % 2 === 0 && 'bg-muted/20'`
- Upcoming flights: `bg-primary/[0.02]` subtle tint
- Actions fade until hover: `opacity-50 group-hover:opacity-100`
- Generous row padding: `py-4`
- Sticky cells need explicit background to prevent overlap

---

## Animation

### Timing (Linear-Inspired Physics)

Linear uses "buttery smooth" easing with specific cubic-bezier curves:

```css
/* Primary easing - smooth deceleration */
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);  /* Linear's signature */

/* Standard easing */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);

/* Durations */
--duration-fast: 150ms;
--duration-normal: 300ms;  /* Linear uses 300ms default */
--duration-slow: 500ms;
```

### Keyframe Animations

```css
/* Entrance animations */
@keyframes fade-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Glow pulse for active/unlocked states */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 15px oklch(0.55 0.22 275 / 0.3); }
  50% { box-shadow: 0 0 25px oklch(0.55 0.22 275 / 0.5); }
}

/* Sparkle for celebrations */
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
}

/* Toast animations */
@keyframes toast-slide-up {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Utilities:**

```css
.animate-fade-up        /* Opacity + translateY */
.animate-fade-slide-up  /* Staggered entrance */
.animate-glow-pulse     /* Active state glow */
.animate-sparkle        /* Celebration effect */
.stagger-children       /* Auto-delay children */
```

### Staggered Animations

For lists and grids, use `animation-delay` to create wave effects:

```tsx
{items.map((item, i) => (
  <Card
    key={item.id}
    className="animate-[fade-slide-up_0.5s_ease-out_forwards] opacity-0"
    style={{ animationDelay: `${i * 75}ms` }}
  />
))}
```

**Principles:**

- Subtle, purposeful motion
- Use Linear's cubic-bezier for buttery smoothness
- Stagger page load animations (75ms intervals)
- Scale icons on hover (group-hover:scale-110)
- Glow effects on focus/active states (dark mode)
- Celebration animations for unlocks and achievements

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

Full dark mode support with user preference persistence. Dark mode follows Linear-inspired "Soft Modern Technical" principles.

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

### Dark Palette (Linear-Inspired)

Neutral surfaces use zinc-based tones (no purple tint) for a cleaner technical feel:

```css
/* Surfaces */
--background: oklch(0.16 0.015 275);   /* #1a1a2e - Deep navy charcoal */
--card: oklch(0.2 0.015 275);           /* #252532 - Elevated surface */
--muted: oklch(0.22 0.01 275);          /* Subtle backgrounds */

/* Borders (zinc-based, no purple) */
--border: oklch(0.38 0.02 275);         /* #4a4a6a - Subtle */
--border-hover: oklch(0.45 0.02 275);   /* #5c5c7a - Default */

/* Text */
--foreground: oklch(0.98 0 0);          /* #FFFFFF */
--muted-foreground: oklch(0.65 0.01 250); /* #9CA3A8 */

/* Primary (Indigo action color) */
--primary: oklch(0.55 0.22 275);        /* #5E5CE6 */
--primary-foreground: oklch(0.98 0 0);

/* Destructive (Coral) */
--destructive: oklch(0.65 0.18 25);     /* #EF6565 */
```

### Dark Mode Glows & Focus States

Active elements use colored shadows for emphasis (Linear signature):

```css
/* Primary glow - inputs, active cards */
box-shadow: 0 0 15px oklch(0.55 0.22 275 / 0.4);

/* Card elevation shadow */
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
```

**Implementation:**

```tsx
// Input focus with glow
<Input className="focus:ring-2 focus:ring-primary/40 focus:shadow-[0_0_15px_oklch(0.55_0.22_275_/_0.3)]" />

// Card with glow on active state
<Card className="hover:shadow-[0_0_20px_oklch(0.55_0.22_275_/_0.15)]" />
```

### Dark Mode Component Adjustments

| Component | Light Mode | Dark Mode |
|-----------|------------|-----------|
| Input border | `border-border/50` | `border-[#4a4a6a]` |
| Input focus | Ring only | Ring + glow |
| Card shadow | `shadow-md` on hover | Soft diffuse + glow |
| Toggle active | Primary fill | Primary fill + subtle glow |
| Button primary | Solid primary | Solid primary, no border |
| Button ghost | Transparent + border | Transparent + gray border (`#4B5563`) |

**Best Practices:**

- Use semantic tokens (`bg-background`, `text-foreground`) not raw colors
- Test both themes during development
- Use `dark:` variants for hardcoded colors
- Apply glows sparingly — only on focus/active states
- Keep surfaces layered: background → card → elevated elements

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

---

## Linear-Inspired Additions (Phase 5)

Summary of enhancements based on Linear design system research:

| Feature | Description |
|---------|-------------|
| **Dark Mode Depth** | Navy-charcoal surfaces, zinc-based borders (no purple tint) |
| **Glow Effects** | Colored box-shadow on focus/active states |
| **Two-Tier Radius** | Soft containers (16px) + tight controls (6-8px) |
| **Buttery Easing** | `cubic-bezier(0.16, 1, 0.3, 1)` for smooth motion |
| **Chart Palette** | 10-color system for data visualization |
| **Staggered Animations** | 75ms intervals for list/grid entrances |

These additions complement the existing Nordic Skies light mode aesthetic while providing a more technical, focused dark mode experience.

---

## Last Updated

2026-02-01 — Added Linear-inspired dark mode enhancements, chart colors, animation physics
