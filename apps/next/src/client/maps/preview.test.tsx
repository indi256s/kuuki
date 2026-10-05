// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CountryPreview } from './preview'

describe('country preview evidence', () => {
  it.each(['en', 'ru'] as const)('keeps awaiting countries unpressed and separate from visited counts in %s', locale => {
    const { container } = render(<CountryPreview locale={locale} period="2026" countryIds={['US']} visits={[{ countryCode: 'US', count: 3 }, { countryCode: 'PT', count: 1, pending: true }]} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(locale === 'en' ? '1 map countries in 2026; 1 waiting for a stamp' : 'Стран на карте за 2026: 1; ждут отметки: 1')
    expect(container.querySelector('[data-country="PT"]')).toHaveAttribute('fill', 'none')
    expect(container.querySelector('[data-country="PT"]')).toHaveAttribute('stroke-dasharray', '2 2')
    expect(container.querySelector('[data-country="US"]')).not.toHaveAttribute('fill', 'none')
  })
  it('keeps independently claimed evidence pressed even with pending flights', () => {
    const { container } = render(<CountryPreview locale="en" countryIds={['PT']} visits={[{ countryCode: 'PT', count: 0, pending: true, claimed: true }]} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('1 countries visited')
    expect(container.querySelector('[data-country="PT"]')).not.toHaveAttribute('fill', 'none')
  })
})
