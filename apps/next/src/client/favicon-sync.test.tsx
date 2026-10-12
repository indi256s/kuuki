// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { FaviconSync, faviconHref } from './favicon-sync'

const root = document.documentElement
const decoded = (href: string | null) => decodeURIComponent(href!.split(',', 2)[1])
afterEach(() => {
  document.head.innerHTML = ''
  delete root.dataset.accent
  delete root.dataset.theme
})

it('renders the icon geometry with the shared table colors for each accent and mode', () => {
  const light = decoded(faviconHref('shu', 'light'))
  expect(light).toContain('fill="#fbfaf8"')
  expect(light).toContain('fill="#a55140"')
  const dark = decoded(faviconHref('sakura', 'dark'))
  expect(dark).toContain('fill="#292827"')
  expect(dark).not.toContain('#fbfaf8')
})

it('replaces the SVG icon link, keeps the other icons, and follows accent and theme changes', async () => {
  document.head.innerHTML =
    '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any">'
  root.dataset.accent = 'ai'
  root.dataset.theme = 'light'
  render(<FaviconSync />)
  const svg = document.head.querySelector('link[type="image/svg+xml"]')!
  expect(svg.getAttribute('href')).toBe(faviconHref('ai', 'light'))
  expect(document.head.querySelector('link[href="/favicon.ico"]')).not.toBeNull()
  root.dataset.accent = 'matcha'
  root.dataset.theme = 'dark'
  await waitFor(() => expect(svg.getAttribute('href')).toBe(faviconHref('matcha', 'dark')))
})

it('sets every SVG icon link, the static one Next emits included, and re-takes one inserted later', async () => {
  document.head.innerHTML =
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<link rel="icon" href="/icon.svg?x" type="image/svg+xml" sizes="any">' +
    '<link rel="icon" href="data:image/svg+xml,old" type="image/svg+xml" sizes="any">'
  root.dataset.accent = 'asagi'
  root.dataset.theme = 'light'
  render(<FaviconSync />)
  const links = () => [...document.head.querySelectorAll('link[type="image/svg+xml"]')]
  expect(links()).toHaveLength(2)
  for (const link of links()) expect(link.getAttribute('href')).toBe(faviconHref('asagi', 'light'))
  expect(document.head.querySelector('link[href="/favicon.ico"]')).not.toBeNull()
  root.dataset.accent = 'sakura'
  await waitFor(() =>
    links().forEach((link) =>
      expect(link.getAttribute('href')).toBe(faviconHref('sakura', 'light')),
    ),
  )
  const late = document.createElement('link')
  late.rel = 'icon'
  late.type = 'image/svg+xml'
  late.setAttribute('href', '/icon.svg?y')
  document.head.appendChild(late)
  await waitFor(() => expect(late.getAttribute('href')).toBe(faviconHref('sakura', 'light')))
})

it('creates the SVG icon link when the document has none', () => {
  root.dataset.accent = 'sakura'
  root.dataset.theme = 'light'
  render(<FaviconSync />)
  expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1)
  expect(document.head.querySelector('link[rel="icon"]')!.getAttribute('href')).toBe(
    faviconHref('sakura', 'light'),
  )
})
