import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  // `pnpm typecheck` runs `next typegen` + tsc over the same files, so the build skips its own pass.
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
