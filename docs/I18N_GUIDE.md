# i18n Guide - Kuuki Translation System

> Historical: describes the removed Vite app's i18next setup. Next still uses the shared JSON files for badge names; other Next copy lives with its components. For current work, read [DESIGN.md](../DESIGN.md) for UI and [GLOSSARY.md](../GLOSSARY.md) for domain terms.

This guide covers how to work with translations and pluralization in the Kuuki app.

## Overview

Kuuki uses [i18next](https://www.i18next.com/) for internationalization with support for:

- English (en) - Primary language
- Russian (ru) - Secondary language

Translation files are located in `packages/shared/src/i18n/`:

- `en.json` - English translations
- `ru.json` - Russian translations

## Basic Usage

In React components, use the `useTranslation` hook:

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()

  return <h1>{t('dashboard.title')}</h1>
}
```

## Pluralization

i18next automatically handles pluralization based on the `count` parameter. Use plural suffix keys to define different forms.

### English Pluralization

English has two forms:

- `_one` - Singular (count = 1)
- `_other` - Plural (count ≠ 1)

**Example in `en.json`:**

```json
{
  "flights": {
    "count_one": "{{count}} flight",
    "count_other": "{{count}} flights"
  }
}
```

**Usage in component:**

```tsx
t('flights.count', { count: 1 }) // "1 flight"
t('flights.count', { count: 5 }) // "5 flights"
```

### Russian Pluralization

Russian has three forms based on complex rules:

- `_one` - Ends in 1 (but not 11): 1, 21, 31, 41, 101, 121...
- `_few` - Ends in 2-4 (but not 12-14): 2, 3, 4, 22, 23, 24, 32...
- `_other` - All other cases: 0, 5-20, 25-30, 35-40, 100, 1000...

**Example in `ru.json`:**

```json
{
  "flights": {
    "count_one": "{{count}} полёт",
    "count_few": "{{count}} полёта",
    "count_other": "{{count}} полётов"
  }
}
```

**Automatic selection:**

```tsx
t('flights.count', { count: 1 }) // "1 полёт"    (_one)
t('flights.count', { count: 2 }) // "2 полёта"   (_few)
t('flights.count', { count: 5 }) // "5 полётов"  (_other)
t('flights.count', { count: 21 }) // "21 полёт"   (_one)
t('flights.count', { count: 22 }) // "22 полёта"  (_few)
t('flights.count', { count: 25 }) // "25 полётов" (_other)
```

### Russian Plural Rules Reference

| Count                | Form     | Suffix   | Example               |
| -------------------- | -------- | -------- | --------------------- |
| 1, 21, 31, 41...     | Singular | `_one`   | 1 полёт, 21 полёт     |
| 2-4, 22-24, 32-34... | Few      | `_few`   | 2 полёта, 22 полёта   |
| 0, 5-20, 25-30...    | Many     | `_other` | 5 полётов, 20 полётов |

**Special cases:**

- Numbers ending in 11, 12, 13, 14 always use `_other` (не `_one` или `_few`)
- Zero (0) uses `_other`

## Adding New Pluralized Translations

### Step 1: Identify if pluralization is needed

Use pluralization when:

- The translation contains a count that affects noun forms
- Examples: "X flights", "X countries", "X travelers"

Don't use pluralization when:

- The count doesn't affect surrounding words
- The phrase doesn't contain countable nouns

### Step 2: Add English translations

In `en.json`, add `_one` and `_other` suffixes:

```json
{
  "toasts": {
    "flightsDeleted_one": "{{count}} flight removed",
    "flightsDeleted_other": "{{count}} flights removed"
  }
}
```

### Step 3: Add Russian translations

In `ru.json`, add `_one`, `_few`, and `_other` suffixes:

```json
{
  "toasts": {
    "flightsDeleted_one": "Удалён {{count}} полёт",
    "flightsDeleted_few": "Удалено {{count}} полёта",
    "flightsDeleted_other": "Удалено {{count}} полётов"
  }
}
```

### Step 4: Use in components

Pass the `count` parameter - i18next will select the correct form automatically:

```tsx
const { t } = useTranslation()

// Delete 3 flights
toast.success(t('toasts.flightsDeleted', { count: 3 }))
// English: "3 flights removed"
// Russian: "Удалено 3 полёта"
```

## Common Patterns

### Stats and Counts

```json
// en.json
{
  "stats": {
    "totalFlights_one": "{{count}} flight",
    "totalFlights_other": "{{count}} flights"
  }
}

// ru.json
{
  "stats": {
    "totalFlights_one": "{{count}} полёт",
    "totalFlights_few": "{{count}} полёта",
    "totalFlights_other": "{{count}} полётов"
  }
}
```

### Confirmation Dialogs

```json
// en.json
{
  "flights": {
    "batchDeleteTitle_one": "Delete {{count}} Flight?",
    "batchDeleteTitle_other": "Delete {{count}} Flights?"
  }
}

// ru.json
{
  "flights": {
    "batchDeleteTitle_one": "Удалить {{count}} полёт?",
    "batchDeleteTitle_few": "Удалить {{count}} полёта?",
    "batchDeleteTitle_other": "Удалить {{count}} полётов?"
  }
}
```

### Import Success Messages

```json
// en.json
{
  "import": {
    "success": {
      "count_one": "{{count}} flight added to your log",
      "count_other": "{{count}} flights added to your log"
    }
  }
}

// ru.json
{
  "import": {
    "success": {
      "count_one": "{{count}} полёт добавлен в журнал",
      "count_few": "{{count}} полёта добавлено в журнал",
      "count_other": "{{count}} полётов добавлено в журнал"
    }
  }
}
```

## Testing Pluralization

Test with different count values to verify all forms:

**English:**

- count = 0: Should use `_other`
- count = 1: Should use `_one`
- count = 2+: Should use `_other`

**Russian:**

- count = 0: Should use `_other`
- count = 1: Should use `_one`
- count = 2, 3, 4: Should use `_few`
- count = 5-20: Should use `_other`
- count = 21: Should use `_one`
- count = 22, 23, 24: Should use `_few`
- count = 25-30: Should use `_other`

## Configuration

i18next configuration is in `apps/web/src/lib/i18n.ts`:

```typescript
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: initialResources,
    lng: initialLang,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],
    // ... pluralization works automatically
  })
```

No additional configuration is needed for pluralization - i18next handles it based on the language code.

## Best Practices

1. **Always add translations to both files** - Never add a key to only one language file
2. **Test with edge cases** - Especially test Russian with 1, 2, 5, 11, 21, 22
3. **Use consistent naming** - Follow existing patterns in the translation files
4. **Avoid awkward workarounds** - Don't use "flight(s)" - use proper pluralization
5. **Keep translations natural** - Ensure pluralized forms sound natural in each language
6. **Document complex cases** - If a translation has special requirements, add comments

## Debugging

If pluralization isn't working:

1. **Check the key name** - Make sure you're using the base key without the suffix in your code
2. **Verify all forms exist** - English needs `_one` and `_other`, Russian needs `_one`, `_few`, and `_other`
3. **Check the count parameter** - Make sure you're passing `{ count: n }` to the translation function
4. **Inspect in browser** - Switch languages and test with different count values
5. **Check for typos** - Verify suffix spelling (`_one`, not `_1` or `_single`)

## Migration from Old Format

Old format (avoid):

```json
{
  "flights": {
    "count": "{{count}} flight(s)"
  }
}
```

New format (correct):

```json
{
  "flights": {
    "count_one": "{{count}} flight",
    "count_other": "{{count}} flights"
  }
}
```

Components using `t('flights.count', { count: n })` work with both formats, but the new format provides grammatically correct pluralization.

## Resources

- [i18next Plurals Documentation](https://www.i18next.com/translation-function/plurals)
- [Unicode CLDR Plural Rules](http://www.unicode.org/cldr/charts/43/supplemental/language_plural_rules.html)
- [Russian Plural Rules Explained](https://www.russianlessons.net/grammar/nouns_plural.php)

## Examples in Codebase

Search the translation files for `_one`, `_few`, and `_other` suffixes to see real examples:

```bash
# Find all pluralized keys in English
grep -n "_one\|_other" packages/shared/src/i18n/en.json

# Find all pluralized keys in Russian
grep -n "_one\|_few\|_other" packages/shared/src/i18n/ru.json
```
