import type { MakerKey } from '@kuuki/data/aircraft-makers'
import type { Alliance } from '@kuuki/data/alliance-membership'
import './ui.css'

const allianceMarks = {
  star: { symbol: '★', name: 'Star Alliance' },
  oneworld: { symbol: '○', name: 'oneworld' },
  skyteam: { symbol: '△', name: 'SkyTeam' },
} satisfies Record<Alliance, { symbol: string; name: string }>

export function MakerSwatch({ maker, size = 12 }: { maker: MakerKey; size?: number }) {
  return (
    <span
      className="ui-maker-swatch"
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: `var(--cat-maker-${maker})` }}
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
