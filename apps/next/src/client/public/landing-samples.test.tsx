// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LandingSamples } from './landing-samples'
it.each(['en', 'ru'] as const)('shows labelled fictional Ticket, Stamp and profile proof (%s)', locale => {
  render(<LandingSamples locale={locale} />)
  expect(screen.getByRole('region', { name: locale === 'ru' ? 'Пример журнала · вымышленные данные' : 'Sample journal · fictional data' })).toBeVisible()
  expect(screen.getByRole('article', { name: locale === 'ru' ? 'TBS — NRT' : 'TBS to NRT' })).toHaveAttribute('data-state', 'logged')
  expect(screen.getByText('日本')).toBeVisible()
  expect(screen.getByText('@sample_traveler')).toBeVisible()
  expect(document.querySelector('.stamp')).toHaveAttribute('data-press', 'idle')
})
