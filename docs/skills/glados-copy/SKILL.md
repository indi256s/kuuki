---
name: glados-copy
description: Use when writing UI copy for Kuuki - empty states, fun facts, loading messages, tooltips, error messages. Wit is allowed only in non-critical contexts; trust contexts are calm and direct.
---

> Design and voice are governed by [DESIGN.md](../../../DESIGN.md) (see "Copy and trust"). Where this file conflicts, DESIGN.md wins.

# Sarcastic Copy Variants

## Where wit is allowed

Sober trust contexts get one calm, direct, precise version and **no jokes**: capture and import, authentication and activation, privacy and settings, errors and validation, destructive actions (including delete confirmations), and anything about stamping or confirming flights. Wit is allowed only as a secondary line in non-critical places (empty states, loading flavour of one line, achievements, profile insights, landing), and never replaces the instruction.

Russian copy addresses the user as «вы» (never «ты»). Write every string in RU and EN together, with real plural forms.

For allowed contexts, provide two variants:
1. **Normal** - Friendly, helpful, professional
2. **Sarcastic** - Dry wit, passive-aggressive warmth, deadpan observations

## Format

Always present both options clearly:

```
**Normal:**
[friendly version]

**Sarcastic:**
[witty version]
```

## Voice Guidelines

- Deadpan delivery, understated humor
- Observations that are technically true but uncomfortably honest
- Polite phrasing with subtle edge
- Backhanded encouragement
- Never mean - just... observant
- Dry, not dramatic
- Occasional "for science" when encouraging action

## Examples

### Empty Flight List
**Normal:**
No flights yet. Add your first flight to start tracking your journey.

**Sarcastic:**
No flights recorded. Your passport must be feeling very well-rested. Add one. For science.

### Loading State
**Normal:**
Loading your flights...

**Sarcastic:**
Retrieving your data. One moment.

### Distance Milestone
**Normal:**
You've flown far enough to circle the Earth!

**Sarcastic:**
You've traveled the circumference of Earth. That's a lot of recycled cabin air.

### No Upcoming Flights
**Normal:**
No upcoming trips planned.

**Sarcastic:**
Nothing scheduled. Your suitcase called. It's worried.

### Error State
**Normal:**
Something went wrong. Please try again.

**Sarcastic:**
That didn't work. Surprising absolutely no one, probably.

### First Flight Added
**Normal:**
Your first flight! Welcome to Kuuki.

**Sarcastic:**
First flight logged. We were starting to wonder.

### 10 Countries Visited
**Normal:**
10 countries! You're becoming a world traveler.

**Sarcastic:**
10 countries. Only 185 to go. For science.

## When NOT to Use Sarcastic

- Capture, import, authentication and activation
- Destructive actions and confirmations
- Critical error messages that need clarity
- Legal/privacy text
- Accessibility descriptions
- Form validation (keep these clear)
- Anything that could genuinely upset someone
