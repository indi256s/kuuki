// The holder data page's printed security artwork (boards 23.1/23.4, spec .scratch/achievements-redesign). Every part is
// decorative (`aria-hidden`); the page's readable content lives in sections.tsx. Colours come from the --holder-* tokens.

/** 14 phase-shifted waves per side, growing in amplitude and fading as they go (board 23.1 "Guilloche"). */
const WAVES = [16, 20, 24, 28, 30, 34, 38, 42, 46, 50, 52, 56, 60, 64].map((amp, i) => ({
  x: -64 + Math.round(i * 4.6),
  amp,
  opacity: Math.round((1 - i * 0.065) * 100) / 100,
}))
/** Long enough to cross the widest page (the 760px tablet card) plus the leading offset. */
const REPEATS = 28
const wave = (x: number, amp: number) => `M${x} 108q16 ${amp} 32 0${'t32 0'.repeat(REPEATS)}`

/** Fine-line waves behind the photo window; a mask fades them toward the fields and the page edges. */
export function Guilloche({ className }: { className: string }) {
  return (
    <svg className={className} width="100%" height="250" aria-hidden="true" focusable="false">
      {WAVES.flatMap(({ x, amp, opacity }) => [
        <path key={`u${amp}`} d={wave(x, -amp)} opacity={opacity} />,
        <path key={`d${amp}`} d={wave(x, amp)} opacity={opacity} />,
      ])}
    </svg>
  )
}

/** 3 × 5 dot matrix digits, rows top to bottom, columns as bits (4 = left, 1 = right). */
const DIGITS: Record<string, number[]> = {
  '0': [7, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7],
  '2': [7, 1, 7, 4, 7],
  '3': [7, 1, 7, 1, 7],
  '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7],
  '6': [7, 4, 7, 5, 7],
  '7': [7, 1, 1, 1, 1],
  '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 7],
}

/** The document number as laser-perforated dots down the right edge: 4px pitch, 26px per digit. */
function perforationPath(number: string) {
  let d = ''
  Array.from(number).forEach((digit, index) => {
    ;(DIGITS[digit] ?? []).forEach((bits, row) => {
      ;[4, 2, 1].forEach((bit, column) => {
        if (bits & bit) d += `M${2 + column * 4} ${3 + index * 26 + row * 4}h0`
      })
    })
  })
  return d
}

/** Base dots plus a glint copy whose opacity follows the tilt (profile.css). */
export function Perforation({ number }: { number: string }) {
  const d = perforationPath(number)
  return (
    <svg
      className="profile-perforation"
      width="12"
      height={number.length * 26 + 2}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
      <path className="profile-perforation-glint" d={d} />
    </svg>
  )
}

const EMBLEM = 'M10 4.5v11M5 11l5-3 5 3M7.5 15.5l2.5-1.5 2.5 1.5'

/** Plane in a ring, 1px strokes: the OVI patch's emblem and, scaled up, the UV crest. */
export function Emblem({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="8.5" />
      <path d={EMBLEM} />
    </svg>
  )
}

/** ICAO e-passport chip mark: rectangle, contact circle and two lines. */
export function ChipMark() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="1.5" y="3" width="11" height="8" rx="1.5" />
      <circle cx="5.5" cy="7" r="1.6" />
      <path d="M8.7 5.8H11M8.7 8.2H11" />
    </svg>
  )
}

/** The optically variable patch over the photo window's corner: the page's one accent part. */
export function OviPatch() {
  return (
    <span className="profile-ovi" aria-hidden="true">
      <Emblem className="profile-ovi-ink" />
      <Emblem className="profile-ovi-shift" />
    </span>
  )
}

/** Fluorescent print that shows only under UV: a crest across the page and, when public data has one, a ring stamp. */
export function UvPrint({ stamp }: { stamp: string | null }) {
  return (
    <div className="profile-uv" aria-hidden="true">
      <Guilloche className="profile-guilloche profile-uv-guilloche" />
      <svg className="profile-uv-crest" viewBox="0 0 200 200" focusable="false">
        <circle cx="100" cy="100" r="96" />
        <circle cx="100" cy="100" r="90" />
        <circle cx="100" cy="100" r="62" />
        {/* Top-down airliner, nose up; the scaled ring emblem read as a peace sign at this size. */}
        <path d="M100 46C104 46 106 52 106 60V88L150 112V120L106 108L105 136L122 148V154L102 148L100 152L98 148L78 154V148L95 136L94 108L50 120V112L94 88V60C94 52 96 46 100 46Z" />
      </svg>
      {stamp && (
        <svg className="profile-uv-stamp" viewBox="0 0 80 80" focusable="false">
          <circle cx="40" cy="40" r="37" />
          <circle cx="40" cy="40" r="31" />
          <path d="M16 50H64M16 30H64" />
          <text x="40" y="45.5" textAnchor="middle">
            {stamp}
          </text>
        </svg>
      )}
    </div>
  )
}

/** Up to two initials for the ghost portrait. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? '')
    .join('')
}
