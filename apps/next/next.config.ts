import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: false,
  // Ring baking needs native Node font-file resolution and HarfBuzz's adjacent WASM file.
  serverExternalPackages: [
    'harfbuzzjs',
    '@expo-google-fonts/commissioner',
    '@expo-google-fonts/noto-sans-arabic',
    '@expo-google-fonts/noto-sans-armenian',
    '@expo-google-fonts/noto-sans-bengali',
    '@expo-google-fonts/noto-sans-devanagari',
    '@expo-google-fonts/noto-sans-ethiopic',
    '@expo-google-fonts/noto-sans-georgian',
    '@expo-google-fonts/noto-sans-hebrew',
    '@expo-google-fonts/noto-sans-khmer',
    '@expo-google-fonts/noto-sans-lao',
    '@expo-google-fonts/noto-sans-myanmar',
    '@expo-google-fonts/noto-sans-sinhala',
    '@expo-google-fonts/noto-sans-thaana',
    '@expo-google-fonts/noto-sans-thai',
    '@expo-google-fonts/noto-serif-tibetan',
  ],
  partialPrefetching: false,
  // `pnpm typecheck` runs `next typegen` + tsc over the same files, so the build skips its own pass.
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
