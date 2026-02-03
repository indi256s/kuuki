# PWA Implementation Design

**Date:** 2026-02-02
**Status:** Implementing

## Overview

Add Progressive Web App (PWA) support to Kuuki with a custom icon featuring Katakana ク (KU).

## Icon Design

| Property | Value |
|----------|-------|
| Character | ク (Katakana KU) |
| Background | `#08090A` (dark theme-color) |
| Foreground | `#D4A544` (amber, from `oklch(0.72 0.14 55)`) |
| Shape | Rounded square |
| Font | Bold Japanese sans-serif |

## Files

```
apps/web/public/
├── kuuki.svg            # Favicon
├── icon-192.png         # PWA standard icon
├── icon-512.png         # PWA large/splash icon
├── apple-touch-icon.png # iOS (180×180)
└── manifest.webmanifest # PWA manifest
```

## PWA Configuration

- **Name:** Kuuki
- **Short name:** Kuuki
- **Theme color:** #08090A
- **Background color:** #08090A
- **Display:** standalone
- **Start URL:** /

## Implementation

Using `vite-plugin-pwa` with Workbox for:
- Precaching app shell assets
- Runtime caching for API responses
- Offline fallback support
