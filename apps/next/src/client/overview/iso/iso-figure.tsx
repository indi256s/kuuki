import { useId, type CSSProperties, type ReactNode } from 'react'
import clsx from 'clsx'
import type { IsoFigureData, IsoNode, Paint } from './scene'
import './iso.css'

const PAINT: Record<Paint, string> = {
  top: 'var(--iso-top)',
  front: 'var(--iso-front)',
  side: 'var(--iso-side)',
  line: 'var(--iso-line)',
  detail: 'var(--iso-detail)',
  glass: 'var(--iso-glass)',
  ghost: 'var(--iso-ghost)',
  accent: 'var(--accent)',
  'on-accent': 'var(--accent-foreground)',
  ink: 'var(--text)',
  muted: 'var(--text-muted)',
  none: 'none',
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
              strokeWidth={1}
              strokeLinejoin="round"
              style={{
                fill: PAINT[node.fill],
                stroke: PAINT[node.stroke],
                strokeOpacity: node.strokeOpacity,
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
              style={{ fill: PAINT[node.fill], stroke: PAINT[node.stroke] }}
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
                fill: PAINT[node.fill],
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
            x="-2000"
            y="-2000"
            width="4000"
            height="4000"
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
