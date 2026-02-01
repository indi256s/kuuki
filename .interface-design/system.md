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

```tsx
<Dialog>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

- Max width constrained
- Rounded corners
- Centered with backdrop blur

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

2026-02-01 — Redesigned with shadcn/ui + Scandinavian aesthetic
