// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'

vi.mock('../server/gates', () => ({ getGateProfile: vi.fn() }))
vi.mock('./preferences', () => ({ Preferences: () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/overview', useRouter: () => ({}) }))
import { BrandShell } from './shell'

it('wordmark renders three decorative kana and kuuki with a home link', () => {
  render(<BrandShell locale="en"><h1>Page</h1></BrandShell>)
  const link = screen.getByRole('link', { name: 'Kuuki home' })
  expect(link).toHaveAttribute('href', '/')
  expect(link).toHaveTextContent('kuuki')
  const tile = link.querySelector('[aria-hidden]')!
  expect([...tile.children].map(glyph => glyph.textContent)).toEqual(['く', 'う', 'き'])
  expect(screen.getByRole('main')).toHaveTextContent('Page')
})

// CSS is the independently specified motion/geometry contract; jsdom does not run animations.
it('keeps the kana cycle scoped and provides a static reduced-motion glyph', () => {
  const css = readFileSync(join(__dirname, '../app/styles.css'), 'utf8')
  expect(css).toMatch(/\.wordmark \.mark\{[^}]*width:32px;[^}]*height:32px;[^}]*border-radius:8px/)
  expect(css).toMatch(/\.wordmark \.mark-glyph\{[^}]*animation:kuuki-crossfade 7\.5s ease-in-out infinite/)
  expect(css).toMatch(/\.mark-glyph:nth-child\(2\)\{animation-delay:2\.5s\}/)
  expect(css).toMatch(/\.mark-glyph:nth-child\(3\)\{animation-delay:5s\}/)
  expect(css).toMatch(/@keyframes kuuki-crossfade\{0%,8%\{opacity:0\}20%,30%\{opacity:1\}42%,100%\{opacity:0\}\}/)
  expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.wordmark \.mark-glyph\{animation:none;opacity:0\}\.wordmark \.mark-glyph:first-child\{opacity:1\}/)
  expect(css).toMatch(/\.wordmark\{[^}]*min-height:44px/)
  expect(css).toMatch(/:focus-visible[^}]*outline:2px solid var\(--focus\);outline-offset:2px/)
  expect(css).toMatch(/\.site-header\{background:var\(--background\)\}/)
  expect(css).toMatch(/:root \.tab-bar\{border-block-start:0\}/)
})
