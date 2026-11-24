import { heatIsWeak } from '../../charts/arc-activity-heatmap'
import { HEAT_MISSING, type HeatBucket } from './helpers'

export type HeatKeyEntry = { level: HeatBucket | typeof HEAT_MISSING; label: string }

export function HeatKey({ entries }: { entries: readonly HeatKeyEntry[] }) {
  return (
    <div className="ov3-heat-legend">
      {entries.map(({ level, label }) => (
        <span key={level}>
          {level === HEAT_MISSING ? (
            <i aria-hidden="true" data-missing />
          ) : (
            <i
              aria-hidden="true"
              data-weak={heatIsWeak(level) ? '' : undefined}
              style={{ background: `var(--heat-${level})` }}
            />
          )}
          {label}
        </span>
      ))}
    </div>
  )
}
