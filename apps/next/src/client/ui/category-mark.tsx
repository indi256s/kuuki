import type { MakerKey } from '@kuuki/data/aircraft-makers'
import type { Alliance } from '@kuuki/data/alliance-membership'
import type { RegionKey } from '@kuuki/shared/theme/palette'
import './ui.css'

const allianceMarks = {
  star: { symbol: '★', name: 'Star Alliance' },
  oneworld: { symbol: '○', name: 'oneworld' },
  skyteam: { symbol: '△', name: 'SkyTeam' },
} satisfies Record<Alliance, { symbol: string; name: string }>

/** Unknown is an outline with a «?», never a fill: it must not pass for a manufacturer colour. Other stays a filled neutral. */
export function MakerSwatch({ maker, size = 12 }: { maker: MakerKey; size?: number }) {
  if (maker === 'unknown')
    return (
      <span
        className="ui-maker-swatch"
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          boxSizing: 'border-box',
          border: '1.5px solid var(--cat-maker-unknown)',
          color: 'var(--text-muted)',
          fontSize: size - 3,
          fontWeight: 600,
          lineHeight: `${size - 3}px`,
          textAlign: 'center',
        }}
      >
        {size >= 12 ? '?' : null}
      </span>
    )
  return (
    <span
      className="ui-maker-swatch"
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: `var(--cat-maker-${maker})` }}
    />
  )
}

/** A region's fixed colour; `unknown` (a region the data does not name) is an outline with a «?», like the Unknown maker. */
export function RegionSwatch({
  region,
  size = 12,
}: {
  region: RegionKey | 'unknown'
  size?: number
}) {
  return region === 'unknown' ? (
    <MakerSwatch maker="unknown" size={size} />
  ) : (
    <span
      className="ui-maker-swatch"
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: `var(--cat-region-${region})` }}
    />
  )
}

/** `decorative` when the alliance's name is already written beside the mark, so it is not announced twice. */
export function AllianceMark({
  alliance,
  size = 12,
  decorative = false,
}: {
  alliance: Alliance
  size?: number
  decorative?: boolean
}) {
  const { symbol, name } = allianceMarks[alliance]
  return (
    <span
      className="ui-alliance-mark"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
      style={{
        width: size,
        height: size,
        fontSize: size,
        color: `var(--cat-alliance-${alliance})`,
      }}
    >
      {symbol}
    </span>
  )
}
