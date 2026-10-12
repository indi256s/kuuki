import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MakerSwatch } from './category-mark'

it('never fills the Unknown maker swatch', () => {
  const unknown = renderToString(<MakerSwatch maker="unknown" />)
  expect(unknown).toContain('>?<')
  expect(unknown).not.toContain('background-color')
  expect(renderToString(<MakerSwatch maker="other" />)).toContain(
    'background-color:var(--cat-maker-other)',
  )
})
