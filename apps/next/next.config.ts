import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  experimental: process.env.KUUKI_TESTING_API === '1'
    ? { exposeTestingApiInProductionBuild: true }
    : {},
}

export default nextConfig
