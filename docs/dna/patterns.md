# Kuuki DNA: Code Patterns

> Established patterns for consistent code across the codebase.
> Follow these patterns when adding new features.

---

## Project Structure

```
kuuki/
├── apps/web/                 # React SPA
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── ui/          # shadcn/ui primitives
│   │   │   ├── auth/        # Login, signup, invite
│   │   │   ├── dashboard/   # Dashboard, stats cards
│   │   │   ├── flights/     # Flight list, forms
│   │   │   ├── import/      # AI import flow
│   │   │   ├── passport/    # Country stamps
│   │   │   ├── social/      # Profiles, leaderboards
│   │   │   └── common/      # Shared (WindLoader, etc)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities (cn, supabase client)
│   │   ├── pages/           # Route components
│   │   ├── stores/          # Zustand stores
│   │   └── types/           # TypeScript types
│   └── index.css            # Tailwind + design tokens
├── packages/
│   ├── shared/              # Cross-package code
│   │   └── src/i18n/        # Translations (en.json, ru.json)
│   └── data/                # Static reference data
│       ├── airports.json
│       ├── airlines.json
│       ├── aircraft.json
│       └── countries.json
├── functions/               # Cloudflare Workers
│   └── api/
│       └── parse.ts         # Gemini proxy
├── supabase/
│   └── migrations/          # Database migrations
└── docs/
    ├── dna/                 # This documentation
    ├── plans/               # Ad-hoc design docs
    └── tasks/               # Phase task lists
```

---

## State Management

### Zustand for Local State

Use Zustand for client-only state that doesn't need server sync:

```typescript
// stores/uiStore.ts
import { create } from 'zustand'

interface UIStore {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
```

**Use for:**
- UI state (sidebar, modals)
- Form state (multi-step flows)
- Temporary data (import preview)

### TanStack Query for Server State

Use TanStack Query for all Supabase data:

```typescript
// hooks/useFlights.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useFlights() {
  return useQuery({
    queryKey: ['flights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flights')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateFlight() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (flight: FlightInput) => {
      const { data, error } = await supabase
        .from('flights')
        .insert(flight)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
```

**Patterns:**
- Query keys are arrays: `['flights']`, `['flights', id]`, `['stats', userId]`
- Mutations invalidate related queries
- Use `select()` after insert/update to get returned data
- Throw errors to let Query handle them

---

## Component Patterns

### Page Components

Pages live in `src/pages/` and handle:
- Data fetching (via hooks)
- Layout structure
- Error boundaries

```typescript
// pages/DashboardPage.tsx
export function DashboardPage() {
  const { data: stats, isLoading, error } = useStats()
  const { data: flights } = useFlights()

  if (isLoading) return <DashboardSkeleton />
  if (error) return <ErrorState error={error} />

  return (
    <div className="space-y-6">
      <StatsCards stats={stats} />
      <RouteMap flights={flights} />
      <RecentFlights flights={flights?.slice(0, 5)} />
    </div>
  )
}
```

### Feature Components

Feature components are self-contained and reusable:

```typescript
// components/flights/FlightCard.tsx
interface FlightCardProps {
  flight: Flight
  onEdit?: () => void
  onDelete?: () => void
}

export function FlightCard({ flight, onEdit, onDelete }: FlightCardProps) {
  // Component logic
}
```

### UI Components (shadcn)

Located in `src/components/ui/`. Don't modify these directly — extend via className or create wrapper components.

```typescript
// Good: Extend via className
<Button className="w-full" size="lg">Submit</Button>

// Good: Create wrapper for repeated patterns
export function SubmitButton({ children, ...props }: ButtonProps) {
  return (
    <Button className="w-full" size="lg" {...props}>
      {children}
    </Button>
  )
}

// Avoid: Modifying ui/button.tsx directly
```

---

## Form Patterns

### React Hook Form + Zod

All forms use React Hook Form with Zod validation:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const flightSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  origin: z.string().length(3, 'Must be IATA code'),
  destination: z.string().length(3, 'Must be IATA code'),
  airline_iata: z.string().min(2, 'Airline is required'),
  aircraft_icao: z.string().optional(),
})

type FlightFormData = z.infer<typeof flightSchema>

export function FlightForm() {
  const form = useForm<FlightFormData>({
    resolver: zodResolver(flightSchema),
    defaultValues: {
      date: '',
      origin: '',
      destination: '',
      airline_iata: '',
    },
  })

  const onSubmit = (data: FlightFormData) => {
    // Handle submission
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

### Form Layout

Use shadcn Form components for consistent styling:

```typescript
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    <FormField
      control={form.control}
      name="origin"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Origin</FormLabel>
          <FormControl>
            <Input placeholder="JFK" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

---

## i18n Patterns

### Adding Translations

Always add keys to both `en.json` and `ru.json`:

```json
// packages/shared/src/i18n/en.json
{
  "dashboard": {
    "title": "Dashboard",
    "stats": {
      "flights": "Total Flights",
      "distance": "Distance Flown"
    }
  }
}

// packages/shared/src/i18n/ru.json
{
  "dashboard": {
    "title": "Панель",
    "stats": {
      "flights": "Всего рейсов",
      "distance": "Пройдено"
    }
  }
}
```

### Using Translations

```typescript
import { useTranslation } from 'react-i18next'

export function StatsCard() {
  const { t } = useTranslation()

  return (
    <Card>
      <CardTitle>{t('dashboard.stats.flights')}</CardTitle>
    </Card>
  )
}
```

### Interpolation

```json
{
  "stats": {
    "percentile": "Top {{percent}}%"
  }
}
```

```typescript
t('stats.percentile', { percent: 15 }) // "Top 15%"
```

---

## Testing Patterns

### Unit Tests with Vitest

```typescript
// hooks/useFlights.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFlights } from './useFlights'

describe('useFlights', () => {
  it('fetches flights for current user', async () => {
    const { result } = renderHook(() => useFlights(), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(3)
  })
})
```

### Component Tests

```typescript
// components/flights/FlightCard.test.tsx
import { render, screen } from '@testing-library/react'
import { FlightCard } from './FlightCard'

describe('FlightCard', () => {
  it('renders flight route', () => {
    render(<FlightCard flight={mockFlight} />)

    expect(screen.getByText('JFK')).toBeInTheDocument()
    expect(screen.getByText('LHR')).toBeInTheDocument()
  })
})
```

### What to Test

| Test | Coverage |
|------|----------|
| Hooks | Data fetching, mutations, state logic |
| Utilities | Distance calculation, date formatting, validation |
| Components | Rendering, user interactions, edge cases |

**Don't test:**
- shadcn/ui components (already tested)
- Supabase client (mock it)
- External APIs (mock them)

---

## Error Handling Patterns

### Query Errors

```typescript
const { data, error, isError } = useQuery(...)

if (isError) {
  return <ErrorState error={error} />
}
```

### Mutation Errors

```typescript
const mutation = useMutation({
  mutationFn: ...,
  onError: (error) => {
    toast.error(t('errors.saveFailed'))
    console.error(error)
  },
})
```

### Error Boundaries

Wrap routes in error boundaries:

```typescript
// pages/DashboardPage.tsx
export function DashboardPage() {
  return (
    <ErrorBoundary fallback={<DashboardError />}>
      <DashboardContent />
    </ErrorBoundary>
  )
}
```

---

## Styling Patterns

### Tailwind Classes

Use the `cn()` helper for conditional classes:

```typescript
import { cn } from '@/lib/utils'

<div className={cn(
  'p-4 rounded-lg',
  isActive && 'bg-primary text-primary-foreground',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

### Design Tokens

Use semantic tokens, not raw colors:

```typescript
// Good
<div className="bg-background text-foreground border-border">

// Avoid
<div className="bg-white text-gray-900 border-gray-200">
```

### Responsive Design

Mobile-first with breakpoint prefixes:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
```

### Dark Mode

Use `dark:` prefix for dark mode overrides:

```typescript
<div className="bg-card dark:bg-card border dark:border-border/50">
```

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `FlightCard.tsx` |
| Hooks | camelCase with `use` prefix | `useFlights.ts` |
| Utilities | camelCase | `formatDistance.ts` |
| Types | PascalCase | `Flight.ts` |
| Pages | PascalCase with `Page` suffix | `DashboardPage.tsx` |
| Tests | Same name with `.test` | `FlightCard.test.tsx` |
| Stores | camelCase with `Store` suffix | `uiStore.ts` |

---

## Import Order

```typescript
// 1. React
import { useState, useEffect } from 'react'

// 2. External libraries
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

// 3. Internal absolute imports
import { Button } from '@/components/ui/button'
import { useFlights } from '@/hooks/useFlights'

// 4. Relative imports
import { FlightCard } from './FlightCard'

// 5. Types
import type { Flight } from '@/types'
```
