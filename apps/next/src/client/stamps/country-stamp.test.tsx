// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { markPressed, resetStampPressMemory } from '../signature/stamp'
import { CountryStamp } from './country-stamp'

afterEach(() => {
  cleanup()
  resetStampPressMemory()
})

it('treats a press ID the legacy Stamp already marked as seen', () => {
  markPressed('x')
  const { container } = render(
    <CountryStamp iso2="JP" locale="en" status="inked" impressionId="x" />,
  )
  expect(container.querySelector('[data-impress]')).toBeNull()
})

it('plays an ID nobody has marked', () => {
  const { container } = render(
    <CountryStamp iso2="JP" locale="en" status="inked" impressionId="y" />,
  )
  expect(container.querySelector('[data-impress]')).not.toBeNull()
})
