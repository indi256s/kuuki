# Lighthouse Audit Checklist

Manual audit checklist for Phase 6d Polish & Performance. Run Chrome DevTools Lighthouse on each page and verify all items.

## Target Scores

| Metric         | Target |
| -------------- | ------ |
| Performance    | >90    |
| Accessibility  | >95    |
| Best Practices | >90    |
| SEO            | >90    |

## Pages to Audit

1. **Landing page** (`/`) - logged out
2. **Dashboard** (`/dashboard`) - logged in, with sample flights
3. **Flight list** (`/flights`) - with 20+ flights
4. **Passport page** (`/passport`) - with visited countries

---

## Performance Checklist (Target: >90)

### Images

- [ ] All images use modern formats (WebP/AVIF)
- [ ] Images have proper `width` and `height` attributes
- [ ] Images use lazy loading (`loading="lazy"`) where appropriate
- [ ] No images larger than necessary for display size

### Fonts

- [ ] DM Sans subset properly (latin only if not using Cyrillic)
- [ ] `font-display: swap` set in font loading
- [ ] Critical fonts preloaded via `<link rel="preload">`
- [ ] JetBrains Mono loaded only when needed

### JavaScript

- [ ] Route code splitting enabled (lazy loading routes)
- [ ] No large unused dependencies in bundle
- [ ] Tree shaking working (check for dead code)
- [ ] Third-party scripts deferred or async

### CSS

- [ ] Tailwind CSS tree-shaking enabled
- [ ] No large unused CSS blocks
- [ ] Critical CSS inlined (if using SSR)

### Network

- [ ] Resources compressed (gzip/brotli)
- [ ] Proper cache headers set
- [ ] No render-blocking resources

---

## Accessibility Checklist (Target: >95)

### Color Contrast

- [ ] All text meets WCAG AA (4.5:1 for normal text, 3:1 for large)
- [ ] Interactive elements have sufficient contrast in all states
- [ ] Dark mode contrast verified separately

### Focus Indicators

- [ ] All interactive elements have visible focus states
- [ ] Focus ring color has sufficient contrast
- [ ] Focus order follows logical reading order

### Touch Targets

- [ ] Buttons meet 44px minimum (enforced via `@media (pointer: coarse)`)
- [ ] Adequate spacing between adjacent touch targets (8px minimum)
- [ ] MobileTabBar tabs are 64px (verified in code)

### Content

- [ ] All images have meaningful `alt` text
- [ ] Decorative images have empty `alt=""`
- [ ] Icons have `aria-hidden="true"` or accessible labels

### Structure

- [ ] Single `<h1>` per page
- [ ] Heading hierarchy is logical (h1 → h2 → h3)
- [ ] Landmark regions used (`<nav>`, `<main>`, `<aside>`)
- [ ] Skip link present (if applicable)

### Forms

- [ ] All inputs have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Required fields are indicated programmatically

### Motion

- [ ] `prefers-reduced-motion` support verified
- [ ] Test with OS reduced motion setting enabled
- [ ] All animations eliminated in reduced motion mode

---

## Best Practices Checklist (Target: >90)

### Security

- [ ] All resources loaded over HTTPS
- [ ] No mixed content warnings
- [ ] No console errors or warnings

### Browser Compatibility

- [ ] Works in latest Chrome, Firefox, Safari
- [ ] No deprecated API warnings

### Mobile

- [ ] Viewport meta tag present and correct
- [ ] Safe areas handled for notched devices (iPhone)
- [ ] Content doesn't overflow viewport

---

## SEO Checklist (Target: >90)

### Meta Tags

- [ ] Unique `<title>` on each page (under 60 chars)
- [ ] Unique `<meta name="description">` on each page (under 160 chars)
- [ ] Open Graph tags present (og:title, og:description, og:image)

### Structure

- [ ] Semantic HTML used (`<nav>`, `<main>`, `<article>`, `<section>`)
- [ ] Proper heading hierarchy
- [ ] Crawlable links using anchor tags

### Technical

- [ ] robots.txt allows indexing
- [ ] sitemap.xml present (if applicable)
- [ ] Canonical URLs set

---

## How to Run Audit

1. Open Chrome DevTools (F12)
2. Go to **Lighthouse** tab
3. Select categories: Performance, Accessibility, Best Practices, SEO
4. Choose device: **Mobile** (more strict)
5. Click **Analyze page load**

### Tips

- Run in Incognito mode to avoid extension interference
- Test on simulated slow connection for realistic results
- Run multiple times and take average (results vary)

---

## Issue Tracking

Use this section to track issues found during audits:

### Page: [PAGE NAME]

| Issue                                   | Category | Severity | Fixed |
| --------------------------------------- | -------- | -------- | ----- |
| Example: Missing alt text on hero image | A11y     | Medium   | [ ]   |

---

## Post-Audit Actions

After addressing issues:

1. Re-run Lighthouse to verify fixes
2. Document final scores in this file
3. Update design system documentation if patterns changed

### Final Scores

| Page      | Performance | A11y | Best Practices | SEO | Date |
| --------- | ----------- | ---- | -------------- | --- | ---- |
| Landing   |             |      |                |     |      |
| Dashboard |             |      |                |     |      |
| Flights   |             |      |                |     |      |
| Passport  |             |      |                |     |      |
