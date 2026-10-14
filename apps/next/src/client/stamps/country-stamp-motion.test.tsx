// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CountryStamp } from './country-stamp'
import { resetStampPressMemory } from '../signature/stamp'

afterEach(() => {
  cleanup()
  resetStampPressMemory()
})
it('dries only the full copy over a worn layer, leaving clean replay opaque', () => {
  const style = document.createElement('style')
  style.textContent = readFileSync('src/client/stamps/country-stamp.css', 'utf8')
  document.head.appendChild(style)
  try {
    const { container } = render(
      <>
        <CountryStamp iso2="JP" status="inked" worn={false} impressionId="clean-regression" />
        <CountryStamp iso2="TH" status="inked" impressionId="worn-regression" />
      </>,
    )
    const rules = Array.from(style.sheet!.cssRules).filter(
      (rule): rule is CSSStyleRule =>
        rule.type === 1 &&
        (rule as CSSStyleRule).style.getPropertyValue('animation').includes('cs-dry'),
    )
    const drying = rules.flatMap((rule) => [...container.querySelectorAll(rule.selectorText)])
    expect(drying).toHaveLength(1)
    expect(drying[0].closest('.country-stamp')?.hasAttribute('data-worn')).toBe(true)
  } finally {
    style.remove()
  }
})
