# Kuuki DNA

> The source of truth for all product and technical decisions.
> Optimized for LLM consumption.

---

## What is DNA?

DNA documents capture the **identity** of Kuuki — the principles, decisions, and patterns that make it what it is. When building new features or making decisions, consult these documents first.

---

## Files

### Feature Passport (Product Decisions)

| File | Purpose | Read when... |
|------|---------|--------------|
| [PRINCIPLES.md](./PRINCIPLES.md) | Core beliefs, privacy philosophy, gamification stance | Starting any feature work |
| [features.md](./features.md) | Feature-specific decisions (flights, import, stats, social, passport) | Building or modifying a feature |
| [boundaries.md](./boundaries.md) | What we DON'T do — explicit scope limits | Considering new features |

### Technical Passport (How We Build)

| File | Purpose | Read when... |
|------|---------|--------------|
| [architecture.md](./architecture.md) | Stack, database design, data flow | Understanding the system |
| [patterns.md](./patterns.md) | Code patterns, testing, styling conventions | Writing code |
| [design.md](./design.md) | Design philosophy, component selection | Building UI |
| [infrastructure.md](./infrastructure.md) | Deployment, CI/CD, environments | DevOps tasks |

---

## Reading Order

### For LLMs (Recommended)

1. **Always read first:** `PRINCIPLES.md`
2. **For feature work:** `features.md` → `boundaries.md` → `design.md`
3. **For code work:** `patterns.md` → `architecture.md`
4. **For infrastructure:** `infrastructure.md`

### For Humans

Start with `PRINCIPLES.md`, then jump to the relevant file for your task.

---

## Quick Principles Reference

| Principle | One-liner |
|-----------|-----------|
| Privacy | Private by default, public by choice |
| Gamification | Celebrate achievements, don't manufacture anxiety |
| Scale | 50-500 users, optimize for craft not growth |
| Server | Minimal footprint, Supabase RLS handles security |
| UX | Progressive disclosure, teach through example |
| Stats | Percentiles over ranks, curated over exhaustive |
| Anti-gaming | Community trust, not fraud detection |

---

## When to Update DNA

Update these documents when:

- A new product decision is made
- A pattern is established that others should follow
- A "why" question keeps coming up
- Something is explicitly ruled out (add to boundaries.md)

**Don't update for:**

- Implementation details (those go in code comments)
- Temporary decisions
- One-off exceptions

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `docs/PLAN.md` | Implementation roadmap and phase status |
| `docs/SPEC.md` | Original interview-derived specification (archival) |
| `.interface-design/system.md` | Design tokens and code snippets |
| `CLAUDE.md` | Quick reference for development |
