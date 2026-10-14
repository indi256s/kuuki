# Ring text fonts (build-time only)

`pnpm generate:stamps` bakes the stamp ring text into glyph outlines (`ring-bake.ts`), so no font is loaded in the browser and none of these files is served from `public/`.

Fonts are semibold (600), SIL Open Font License 1.1:

- Latin, Cyrillic, Greek: Commissioner (the UI face), npm devDependency `@expo-google-fonts/commissioner`.
- Arabic, Armenian, Bengali, Devanagari, Ethiopic, Georgian, Hebrew, Khmer, Lao, Myanmar, Sinhala, Thaana, Thai: Noto Sans, npm devDependencies `@expo-google-fonts/noto-sans-*`.
- Tibetan: Noto Serif Tibetan (`@expo-google-fonts/noto-serif-tibetan`); Noto Sans has no Tibetan on npm.
- CJK (the `*-subset.ttf` files here): subsets of Noto Sans SC, TC, JP and KR from `@expo-google-fonts/noto-sans-{sc,tc,jp,kr}@0.4.4`, cut to the glyphs the ring names use, because the full fonts are 50 to 95 MB each. Licence text: `OFL.txt`.

Regenerate a subset after changing a CJK name in `../ring-endonyms.overrides.json`:

```
pyftsubset NotoSansSC_600SemiBold.ttf --text="中国" --layout-features='*' --no-hinting \
  --output-file=NotoSansSC-SemiBold-subset.ttf
```

Characters per file: SC 中国; TC 香港澳門台灣; JP 日本; KR 대한민국조선.
