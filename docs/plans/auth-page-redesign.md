# Auth Page Redesign: Orbital Brand Experience

> Remove blocking cards, let the katakana + planes breathe, rotate feature/example text under the Kuuki title.

---

## Interview Summary

| Decision | Answer |
|----------|--------|
| Visual hierarchy | Brand first (katakana + planes), values secondary |
| User context | Closed beta for friends — they already trust you |
| Value communication | **Rotating tagline** under Kuuki logo (replaces static tagline) |
| Tagline format | Single line, 4 items, 8s each |
| Progress indicator | Subtle dots (4 dots, current highlighted) |
| Katakana opacity | Hero element (10-12% opacity, static) |
| Animation style | Soft slide (old slides up/fades, new slides in) |
| Stat tone | Casual/warm |
| Mobile layout | Full atmosphere — planes behind form, horizontal katakana |
| Left panel | Keep Kuuki logo, rotating tagline replaces static one |

---

## Content: 4 Rotating Taglines

```typescript
const rotatingTaglines = [
  "Snap a boarding pass. We'll figure it out.",
  "Flights, countries, airports — all the nerdy stuff.",
  "Halfway to the Moon, apparently.",
  "23 countries down, 172 to go.",
]
```

Each displays for 8 seconds with soft slide animation + subtle dot indicator.

---

## Design Changes

### 1. Remove Feature Cards

**Delete:** The entire `features` array and the card grid at bottom of left panel (lines 26-47, 84-101 in current AuthPage.tsx).

**Result:** Clean space for katakana + planes to breathe.

### 2. Rotating Tagline (Replaces Static)

**Current:**
```tsx
<p className="text-neutral-500 dark:text-white/50 text-sm font-medium tracking-wide">
  {t('common.tagline', 'Keep track of your flights')}
</p>
```

**New:**
```tsx
<RotatingTagline
  items={rotatingTaglines}
  interval={8000}
  className="text-neutral-500 dark:text-white/50 text-sm font-medium tracking-wide"
/>
```

Includes 4 subtle dots below the text.

### 3. Enhance Katakana

**Current:** `text-neutral-900/[0.03] dark:text-white/[0.03]` (3% opacity)

**New:** `text-neutral-900/[0.12] dark:text-white/[0.10]` (10-12% opacity, hero)

### 4. Mobile: Full Atmosphere

- Orbital planes at reduced opacity behind the form
- Horizontal katakana "クウキ" above the form
- Rotating tagline visible on mobile too
- Form card with higher opacity for readability

---

## Component: RotatingTagline

New component: `apps/web/src/components/auth/RotatingTagline.tsx`

```tsx
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface RotatingTaglineProps {
  items: string[]
  interval?: number
  className?: string
}

export function RotatingTagline({ items, interval = 8000, className }: RotatingTaglineProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setIsExiting(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length)
        setIsExiting(false)
      }, 300)
    }, interval)

    return () => clearInterval(timer)
  }, [items.length, interval])

  return (
    <div className="space-y-2">
      {/* Rotating text */}
      <div className="relative h-5 overflow-hidden">
        <p
          className={cn(
            "transition-all duration-300 ease-out",
            className,
            isExiting ? "translate-y-[-100%] opacity-0" : "translate-y-0 opacity-100"
          )}
        >
          {items[currentIndex]}
        </p>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5">
        {items.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1 h-1 rounded-full transition-all duration-300",
              i === currentIndex
                ? "bg-primary/60 w-2"
                : "bg-neutral-300 dark:bg-white/20"
            )}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/routes/AuthPage.tsx` | Remove feature cards, replace static tagline with RotatingTagline, adjust katakana opacity, restructure for mobile |
| `apps/web/src/components/auth/RotatingTagline.tsx` | **NEW** — Rotating tagline with dot indicators |
| `apps/web/src/components/auth/index.ts` | Export RotatingTagline |
| `packages/shared/src/i18n/en.json` | Add rotating tagline translations |
| `packages/shared/src/i18n/ru.json` | Add rotating tagline translations |

---

## i18n Keys

```json
{
  "auth": {
    "taglines": {
      "import": "Snap a boarding pass. We'll figure it out.",
      "collection": "Flights, countries, airports — all the nerdy stuff.",
      "moon": "Halfway to the Moon, apparently.",
      "countries": "23 countries down, 172 to go."
    }
  }
}
```

Russian:
```json
{
  "auth": {
    "taglines": {
      "import": "Сфоткай посадочный. Мы разберёмся.",
      "collection": "Рейсы, страны, аэропорты — вся нёрдятина.",
      "moon": "Полпути до Луны, между прочим.",
      "countries": "23 страны позади, ещё 172 впереди."
    }
  }
}
```

---

## Visual Reference

### Desktop Layout (New)

```
┌──────────────────────────────────────────────────┐
│ ┌─────────────────┬────────────────────────────┐ │
│ │ Kuuki           │                            │ │
│ │ "Snap a board..." │    Join Kuuki            │ │
│ │ ● ○ ○ ○         │                            │ │
│ │                 │    [Form fields]           │ │
│ │   クウキ (12%)  │                            │ │
│ │   + orbital     │                            │ │
│ │   planes        │                            │ │
│ │                 │                            │ │
│ │   (clean space) │                            │ │
│ │                 │                            │ │
│ └─────────────────┴────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Mobile Layout (New)

```
┌────────────────────┐
│     ク ウ キ       │  ← Horizontal, 8% opacity
│                    │
│  ✈️ ✈️ (behind)    │  ← Orbital planes
│ ┌────────────────┐ │
│ │ Kuuki          │ │
│ │ "23 countries..│ │
│ │ ○ ○ ○ ●        │ │
│ │                │ │
│ │  Join Kuuki    │ │
│ │  [Form]        │ │
│ │                │ │
│ └────────────────┘ │
└────────────────────┘
```

---

## Verification Checklist

1. **Visual:**
   - [ ] Katakana visible at 10-12% opacity
   - [ ] Orbital planes animate smoothly
   - [ ] No feature cards blocking the view
   - [ ] Rotating tagline readable under Kuuki logo
   - [ ] Dot indicators visible and update correctly

2. **Animation:**
   - [ ] Soft slide transition (300ms)
   - [ ] 8-second interval feels natural
   - [ ] Current dot highlights smoothly
   - [ ] No layout shift during rotation

3. **Mobile:**
   - [ ] Planes visible behind form
   - [ ] Horizontal katakana above form
   - [ ] Rotating tagline works on mobile
   - [ ] Form fully usable and readable

4. **Technical:**
   - [ ] `pnpm typecheck` passes
   - [ ] `pnpm build` succeeds
   - [ ] i18n keys work in both languages

---

## Execution Steps

1. Create `RotatingTagline.tsx` component
2. Export from `components/auth/index.ts`
3. Add i18n keys (en + ru)
4. Refactor `AuthPage.tsx`:
   - Remove feature cards
   - Replace static tagline with RotatingTagline
   - Increase katakana opacity to 10-12%
   - Restructure for mobile atmosphere
5. Test rotation, dots, and mobile layout
6. Commit and push
