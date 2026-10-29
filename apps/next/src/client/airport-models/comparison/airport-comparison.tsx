'use client'

import { useEffect, useRef, useState } from 'react'
import type { AirportFeature, AirportPlanV1, PolygonM } from '../../../lib/airport-models/model'
import { comparisonScale, planTransform, scaleBar } from './scale'
import './comparison.css'

function polygonPath(polygon: PolygonM) {
  return [polygon.outer, ...polygon.holes]
    .map((ring) => `M${ring.map((point) => `${point[0]},${point[1]}`).join('L')}Z`)
    .join('')
}

function PlanFeature({ feature }: { feature: AirportFeature }) {
  if (feature.type === 'point') return null
  if (feature.type === 'line')
    return feature.areaCovered ? null : (
      <polyline
        points={feature.points.map((point) => point.join(',')).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={feature.width.metres}
        strokeLinejoin="round"
      />
    )
  return (
    <>
      {feature.polygons.map((polygon, index) => (
        <path key={index} d={polygonPath(polygon)} fillRule="evenodd" />
      ))}
    </>
  )
}

export type AirportComparisonProps = {
  plans: readonly [AirportPlanV1, AirportPlanV1]
  locale: 'en' | 'ru'
  names?: readonly [string, string]
}

/** Flat north-up SVG plans work independently of WebGL and never load a second 3D model. */
export function AirportComparison({ plans, locale, names }: AirportComparisonProps) {
  const first = useRef<SVGSVGElement>(null),
    second = useRef<SVGSVGElement>(null)
  const [sizes, setSizes] = useState([
    { width: 0, height: 0 },
    { width: 0, height: 0 },
  ])
  useEffect(() => {
    const measure = () =>
      setSizes(
        [first, second].map((ref) => {
          const rect = ref.current?.getBoundingClientRect()
          return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
        }),
      )
    const observer = new ResizeObserver(measure)
    if (first.current) observer.observe(first.current)
    if (second.current) observer.observe(second.current)
    measure()
    return () => observer.disconnect()
  }, [])
  const panels = plans.map((plan, i) => ({ ...sizes[i]!, boundsM: plan.boundsM }))
  const ppm = comparisonScale(panels)
  const format = new Intl.NumberFormat(locale)
  return (
    <div className="airport-comparison">
      {plans.map((plan, index) => {
        const panel = panels[index]!,
          bar = scaleBar(ppm, panel.width)
        return (
          <figure className="airport-comparison-panel" key={index}>
            <figcaption>{names?.[index] ?? plan.iata}</figcaption>
            <svg
              ref={index === 0 ? first : second}
              role="img"
              aria-label={`${names?.[index] ?? plan.iata} — ${locale === 'ru' ? 'север сверху' : 'north up'}`}
              viewBox={`0 0 ${panel.width || 1} ${panel.height || 1}`}
            >
              {ppm > 0 && (
                <>
                  <g transform={planTransform(panel, ppm)}>
                    <g className="airport-plan-boundary">
                      {plan.boundary.map((polygon, i) => (
                        <path key={i} d={polygonPath(polygon)} fillRule="evenodd" />
                      ))}
                    </g>
                    {plan.features.map((feature) => (
                      <g
                        key={feature.id}
                        className={`airport-plan-${feature.type}`}
                        data-kind={feature.kind}
                      >
                        <PlanFeature feature={feature} />
                      </g>
                    ))}
                  </g>
                  <g
                    className="airport-plan-scale"
                    transform={`translate(12 ${panel.height - 14})`}
                  >
                    <path d={`M0,-4V0H${bar.pixels}V-4`} />
                    <text x={0} y={-9}>
                      {format.format(bar.metres >= 1000 ? bar.metres / 1000 : bar.metres)}{' '}
                      {bar.metres >= 1000
                        ? locale === 'ru'
                          ? 'км'
                          : 'km'
                        : locale === 'ru'
                          ? 'м'
                          : 'm'}
                    </text>
                  </g>
                </>
              )}
            </svg>
          </figure>
        )
      })}
    </div>
  )
}
