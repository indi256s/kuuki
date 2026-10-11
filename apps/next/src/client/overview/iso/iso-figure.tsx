import { useId, type CSSProperties, type ReactNode } from 'react'
import clsx from 'clsx'
import type { IsoFigureData, IsoNode, Paint } from './scene'
import './iso.css'

const PAINT: Record<Exclude<Paint, `maker${string}`>, string> = {
  top: 'var(--iso-top)',
  front: 'var(--iso-front)',
  side: 'var(--iso-side)',
  line: 'var(--iso-line)',
  detail: 'var(--iso-detail)',
  glass: 'var(--iso-glass)',
  ghost: 'var(--iso-ghost)',
  accent: 'var(--accent)',
  'accent-side': 'color-mix(in oklab, var(--accent) 80%, black)',
  // Mixed toward the text colour, so it darkens in light and lightens in dark: on-accent text keeps 4.5:1 on it for every accent.
  'accent-plate': 'color-mix(in oklab, var(--accent) 80%, var(--text))',
  shadow: 'var(--iso-shadow)',
  land: 'color-mix(in oklab, var(--iso-detail) 35%, transparent)',
  'on-accent': 'var(--accent-foreground)',
  ink: 'var(--text)',
  muted: 'var(--text-muted)',
  none: 'none',
}

function paint(p: Paint): string {
  if (p.startsWith('maker-side:'))
    return `color-mix(in oklab, var(--cat-maker-${p.slice(11)}) 72%, black)`
  if (p.startsWith('maker:')) return `var(--cat-maker-${p.slice(6)})`
  return PAINT[p as keyof typeof PAINT]
}

function blurs(nodes: readonly IsoNode[], out = new Set<number>()) {
  for (const node of nodes) {
    if (node.kind === 'glow') out.add(node.blur)
    if (node.kind === 'glow' || node.kind === 'group') blurs(node.children, out)
  }
  return out
}

/** Renders a Scene's node tree. Decorative: the figure's facts are always text beside it. Named parts carry `data-part` for CSS motion. */
export function IsoFigure({
  figure,
  className,
  style,
}: {
  figure: IsoFigureData
  className?: string
  style?: CSSProperties
}) {
  // SVG ids are document-wide: each figure namespaces its filters and clips.
  const base = `iso${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  let clips = 0
  const clipDefs: ReactNode[] = []
  const render = (nodes: readonly IsoNode[]): ReactNode[] =>
    nodes.map((node, index) => {
      switch (node.kind) {
        case 'polygon':
          return (
            <polygon
              key={index}
              points={node.points}
              strokeWidth={node.width ?? 1}
              strokeLinejoin="round"
              style={{
                fill: paint(node.fill),
                stroke: paint(node.stroke),
                strokeOpacity: node.strokeOpacity,
                opacity: node.opacity,
              }}
            />
          )
        case 'path':
          return (
            <path
              key={index}
              d={node.d}
              strokeWidth={node.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={node.dash}
              style={{ fill: paint(node.fill), stroke: paint(node.stroke) }}
            />
          )
        case 'text':
          return (
            <text
              key={index}
              x={node.x}
              y={node.y}
              transform={node.transform}
              fontSize={node.size}
              fontWeight={node.weight}
              textAnchor={node.anchor}
              letterSpacing={node.mono && !node.transform ? '0.04em' : undefined}
              style={{
                fill: paint(node.fill),
                fontFamily: node.mono ? 'var(--font-mono)' : 'var(--font-sans)',
              }}
            >
              {node.text}
            </text>
          )
        case 'glow':
          return (
            <g key={index} filter={`url(#${base}-b${node.blur})`} className="iso-glow">
              {render(node.children)}
            </g>
          )
        case 'group': {
          let clipPath: string | undefined
          if (node.clip) {
            const id = `${base}-c${clips++}`
            clipDefs.push(
              <clipPath key={id} id={id} clipPathUnits="userSpaceOnUse">
                <polygon points={node.clip} />
              </clipPath>,
            )
            clipPath = `url(#${id})`
          }
          const part = (
            <g
              key={clipPath ? undefined : index}
              data-part={node.part}
              style={node.vars as CSSProperties | undefined}
            >
              {render(node.children)}
            </g>
          )
          // The clip sits on a still wrapper so it stays put while the part moves inside it.
          return clipPath ? (
            <g key={index} clipPath={clipPath}>
              {part}
            </g>
          ) : (
            part
          )
        }
      }
    })
  // A glow's region is the figure's box plus 3 sigma of blur. Builders include motion travel in the box, and a moving part carries its user space (and so the region) along, so nothing the glow reaches gets clipped.
  const [bx, by, bw, bh] = figure.viewBox.split(' ').map(Number)
  const body = render(figure.nodes)
  return (
    <svg
      className={clsx('iso', className)}
      width={figure.width}
      height={figure.height}
      viewBox={figure.viewBox}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <defs>
        {[...blurs(figure.nodes)].map((blur) => (
          <filter
            key={blur}
            id={`${base}-b${blur}`}
            filterUnits="userSpaceOnUse"
            x={bx - 3 * blur}
            y={by - 3 * blur}
            width={bw + 6 * blur}
            height={bh + 6 * blur}
          >
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        ))}
        {clipDefs}
      </defs>
      {body}
    </svg>
  )
}
