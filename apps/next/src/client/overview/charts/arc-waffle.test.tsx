import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MakerSwatch } from '../../ui/category-mark'
import { ArcWaffle } from './arc-waffle'

const cell = { key: 'u', x: 0, y: 0, fill: 'var(--cat-maker-unknown)', outline: true }

it('draws the Unknown role as a transparent outline with a «?», and a named maker as a fill', () => {
  const big = renderToString(
    <svg>
      <ArcWaffle
        cells={[cell, { ...cell, key: 'b', fill: 'var(--cat-maker-boeing)', outline: false }]}
        cellSize={20}
        gap={2}
      />
    </svg>,
  )
  // `data-kc-outline` is what the chart theme thickens on a filtered, pinned or highlighted cell.
  expect(big).toContain('fill="transparent" data-kc-outline="" stroke="var(--cat-maker-unknown)"')
  expect(big.match(/data-kc-outline/g)).toHaveLength(1)
  expect(big).toContain('>?</text>')
  expect(big).toContain('fill="var(--cat-maker-boeing)"')
  expect(big).not.toContain('fill="var(--cat-maker-unknown)"')
  // A cell too small for a legible glyph keeps the outline alone.
  expect(
    renderToString(
      <svg>
        <ArcWaffle cells={[cell]} cellSize={8} gap={1} />
      </svg>,
    ),
  ).not.toContain('>?</text>')
})

it('never fills the Unknown maker swatch', () => {
  const unknown = renderToString(<MakerSwatch maker="unknown" />)
  expect(unknown).toContain('>?<')
  expect(unknown).not.toContain('background-color')
  expect(renderToString(<MakerSwatch maker="other" />)).toContain(
    'background-color:var(--cat-maker-other)',
  )
})
