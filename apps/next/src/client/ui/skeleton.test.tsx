// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Skeleton } from './skeleton'

it('announces a named busy region while reserving its height', () => {
  render(<Skeleton height={240} label="Loading fleet" />)
  expect(screen.getByRole('region', { name: 'Loading fleet' })).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('region', { name: 'Loading fleet' })).toHaveStyle({ height: '240px' })
})
