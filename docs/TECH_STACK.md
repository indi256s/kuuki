# Kuuki - Tech Stack

> **For AI Agents:** Every package, dependency, API, and tool locked to exact versions. No ambiguity. Use these exact versions when generating code.

---

## Stack Overview

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + Vite + TypeScript | React 19, Vite 6, TS 5.7 |
| Styling | Tailwind CSS + shadcn/ui | Tailwind 4.0, OKLCH colors |
| State | Zustand + TanStack Query | Zustand 5, Query 5.62 |
| Forms | React Hook Form + Zod | RHF 7.71, Zod 4.3 |
| i18n | react-i18next | i18next 25.8 |
| Routing | React Router | 7.1 |
| Icons | Lucide React | 0.563 |
| Maps | react-simple-maps | 3.0 |
| Hosting | Cloudflare Pages | - |
| Edge API | Cloudflare Workers | - |
| Database | Supabase PostgreSQL | - |
| Auth | Supabase Auth | - |
| AI | Google Gemini 3.0 Flash | genai 1.39 |

---

## Frontend Dependencies

### Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | React DOM renderer |
| `react-router-dom` | ^7.1.0 | Client-side routing |
| `typescript` | ^5.7.0 | Type safety |

### Build Tools

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^6.0.0 | Build tool and dev server |
| `@vitejs/plugin-react` | ^4.3.0 | React plugin for Vite |
| `@tailwindcss/vite` | ^4.0.0 | Tailwind Vite integration |
| `vite-plugin-pwa` | ^1.2.0 | PWA support |

### Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^4.0.0 | Utility-first CSS |
| `tailwind-merge` | ^3.4.0 | Merge Tailwind classes |
| `class-variance-authority` | ^0.7.1 | Component variants |
| `clsx` | ^2.1.1 | Conditional classes |
| `tw-animate-css` | ^1.4.0 | Animation utilities |

### UI Components (shadcn/ui via Radix)

| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-accordion` | ^1.2.12 | Accordion component |
| `@radix-ui/react-checkbox` | ^1.3.3 | Checkbox component |
| `@radix-ui/react-collapsible` | ^1.1.12 | Collapsible sections |
| `@radix-ui/react-dialog` | ^1.1.15 | Modal dialogs |
| `@radix-ui/react-dropdown-menu` | ^2.1.16 | Dropdown menus |
| `@radix-ui/react-label` | ^2.1.8 | Form labels |
| `@radix-ui/react-navigation-menu` | ^1.2.14 | Navigation menu |
| `@radix-ui/react-popover` | ^1.1.15 | Popovers |
| `@radix-ui/react-progress` | ^1.1.8 | Progress bars |
| `@radix-ui/react-scroll-area` | ^1.2.10 | Scroll containers |
| `@radix-ui/react-select` | ^2.2.6 | Select dropdowns |
| `@radix-ui/react-separator` | ^1.1.8 | Visual separators |
| `@radix-ui/react-slot` | ^1.2.4 | Slot composition |
| `cmdk` | ^1.1.1 | Command palette |
| `sonner` | ^2.0.7 | Toast notifications |

### State Management

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^5.0.0 | Client-side state |
| `@tanstack/react-query` | ^5.62.0 | Server state / caching |

### Forms & Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | ^7.71.1 | Form management |
| `@hookform/resolvers` | ^5.2.2 | Zod integration |
| `zod` | ^4.3.6 | Schema validation |

### Internationalization

| Package | Version | Purpose |
|---------|---------|---------|
| `i18next` | ^25.8.0 | i18n core |
| `react-i18next` | ^16.5.4 | React bindings |
| `i18next-browser-languagedetector` | ^8.2.0 | Auto language detection |

### Date & Time

| Package | Version | Purpose |
|---------|---------|---------|
| `date-fns` | ^4.1.0 | Date utilities |
| `react-day-picker` | ^9.13.0 | Calendar component |

### Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| `react-simple-maps` | ^3.0.0 | World map visualization |
| `lucide-react` | ^0.563.0 | Icon library |

### Backend Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | ^2.47.0 | Supabase client |

---

## Development Dependencies

### Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.0.18 | Test runner |
| `@testing-library/react` | ^16.3.2 | React testing |
| `@testing-library/jest-dom` | ^6.9.1 | DOM matchers |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `@vitest/coverage-v8` | ^4.0.18 | Coverage reporting |
| `jsdom` | ^27.4.0 | DOM simulation |

### Linting & Types

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^9.39.2 | Code linting |
| `@eslint/js` | ^9.39.2 | ESLint JS config |
| `typescript-eslint` | ^8.54.0 | TypeScript ESLint |
| `eslint-plugin-react-hooks` | ^7.0.1 | React hooks rules |
| `eslint-plugin-react-refresh` | ^0.5.0 | Fast refresh rules |
| `@types/react` | ^19.0.0 | React types |
| `@types/react-dom` | ^19.0.0 | React DOM types |
| `@types/react-simple-maps` | ^3.0.6 | Map types |
| `globals` | ^17.3.0 | Global type definitions |

### PWA

| Package | Version | Purpose |
|---------|---------|---------|
| `workbox-window` | ^7.4.0 | Service worker utilities |

---

## Root Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `turbo` | ^2.4.0 | Monorepo build system |
| `wrangler` | ^4.62.0 | Cloudflare CLI |
| `@cloudflare/workers-types` | ^4.20260131.0 | Worker types |
| `@google/genai` | ^1.39.0 | Gemini AI SDK |

---

## Workspace Packages

### @kuuki/web

Main web application. Contains all React components, routes, and hooks.

### @kuuki/shared

Shared code between packages:
- TypeScript types
- i18n translations (`en.json`, `ru.json`)

### @kuuki/data

Static reference data:
- `aircraft.json` — 726 aircraft types
- `airports.json` — 512 airports
- `airlines.json` — 162 airlines
- `countries.json` — 246 countries/territories

---

## External Services

### Supabase

| Service | Purpose |
|---------|---------|
| PostgreSQL | Primary database |
| Auth | Email/password authentication |
| RLS | Row-level security |
| Triggers | Stats computation, badge evaluation |

**Configuration:**
- Free tier
- Direct client access (no backend proxy)
- 30-day session duration

### Cloudflare

| Service | Purpose |
|---------|---------|
| Pages | Static site hosting |
| Workers | Gemini API proxy |

**Build Settings:**
- Build command: `pnpm build`
- Output directory: `apps/web/dist`
- Node version: 18+

### Google Gemini

| Model | Purpose |
|-------|---------|
| Gemini 3.0 Flash | OCR and semantic parsing for flight import |

**API Key Management:**
- Beta: Server-side proxy (key in Worker secrets)
- Post-launch: User provides own key

---

## Environment Variables

### Client-Side (Safe to Expose)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

### Server-Side (Worker Secrets)

```env
GEMINI_API_KEY=xxx
```

**Never commit secrets.** Use Cloudflare Worker secrets:

```bash
wrangler secret put GEMINI_API_KEY
```

---

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 90+ |
| Firefox | 90+ |
| Safari | 14+ |
| Edge | 90+ |

**Not Supported:**
- Internet Explorer
- Legacy mobile browsers

---

## Node.js Compatibility

| Environment | Version |
|-------------|---------|
| Development | 18+ (recommended: 20) |
| Cloudflare Workers | V8 isolates |
| Build (CI) | 18+ |

---

## Package Manager

| Tool | Version |
|------|---------|
| pnpm | 9.15.0 |

**Commands:**
```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Run tests
pnpm lint             # Run linter
pnpm typecheck        # TypeScript check
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [PRD.md](./PRD.md) | Product requirements |
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) | UI/UX patterns |
| [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) | Database and API |
