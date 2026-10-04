import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  ...nextVitals,
  ...nextTypescript,
  { ignores: ['.next/**', '.open-next/**', 'public/maps/maplibre-6.12.0/**', 'api-routes.generated.ts', 'next-env.d.ts'] },
]

export default config
