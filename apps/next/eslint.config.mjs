import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// DESIGN.md: components take colours from the semantic CSS variables in styles.css and never use `transition: all`.
// The hex shape only matches a literal that is entirely a colour, or a colour in CSS text (after `:`, `,`, `(` or whitespace),
// so URL fragments such as '#main' or href="#content" are not flagged.
const hex = '#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\\w-])'
const paletteRegex = `/^\\s*${hex}\\s*$|[\\s:,(]${hex}|\\b(?:rgba?|hsla?|oklch)\\(/`
const transitionAllRegex = '/transition:\\s*all\\b|\\btransition-all\\b/'
const paletteMessage = 'Use a semantic CSS variable from apps/next/src/app/styles.css (DESIGN.md: no palette literals in components).'
const transitionMessage = 'Name the transitioned properties (DESIGN.md).'

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${paletteRegex}]`, message: paletteMessage },
        { selector: `TemplateElement[value.raw=${paletteRegex}]`, message: paletteMessage },
        { selector: `Literal[value=${transitionAllRegex}]`, message: transitionMessage },
        { selector: `TemplateElement[value.raw=${transitionAllRegex}]`, message: transitionMessage },
      ],
    },
  },
  { ignores: ['.next/**', '.open-next/**', 'public/maps/maplibre-6.13.0/**', 'api-routes.generated.ts', 'next-env.d.ts'] },
]

export default config
