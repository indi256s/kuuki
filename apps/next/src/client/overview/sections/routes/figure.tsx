import { useEffect, useMemo, useRef, useState } from 'react'
import { passStack } from '../../iso/passes'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigureK } from '../../layout/figure-box'
import '../cookie.css'
import '../../iso/passes.css'

export function usePassFigure(size: FigureSize, share: number, route: string, topRepeat?: boolean) {
  return useFigure(size, `${share}|${route}|${topRepeat}`, (k) =>
    passStack(share, route, k, topRepeat),
  )
}

const SIZING_ROUTE = 'AAA ↔ BBB'

export function PassCardFigure({
  share,
  route,
  picked,
  topRepeat,
}: {
  share: number
  route: string
  picked: boolean
  topRepeat?: boolean
}) {
  const k = useFigureK(String(share), (k) => passStack(share, SIZING_ROUTE, k))
  const [seen, setSeen] = useState<{
    route: string
    repeat: boolean
    deal: number
    dealing: boolean
    leaving: { route: string; repeat: boolean } | null
  }>({ route, repeat: !!topRepeat, deal: 0, dealing: false, leaving: null })
  let deal = seen.deal
  if (seen.route !== route) {
    const dealt = picked && !matchMedia('(prefers-reduced-motion: reduce)').matches
    deal = !dealt ? 0 : seen.dealing ? seen.deal : seen.deal === 1 ? 2 : 1
    const leaving = !dealt
      ? null
      : seen.dealing
        ? seen.leaving
        : { route: seen.route, repeat: seen.repeat }
    setSeen({ route, repeat: !!topRepeat, deal, dealing: deal !== 0, leaving })
  }
  const leaving = seen.dealing ? seen.leaving : null
  const settle = () => setSeen((old) => ({ ...old, dealing: false, leaving: null }))
  const stack = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = stack.current
    const cancel = () => setSeen((old) => ({ ...old, dealing: false, leaving: null }))
    node?.addEventListener('animationcancel', cancel)
    return () => node?.removeEventListener('animationcancel', cancel)
  }, [])
  const figure = useMemo(
    () => passStack(share, route, k, topRepeat, leaving ?? undefined),
    [share, route, k, topRepeat, leaving],
  )
  return (
    <div className="ov3-passes" data-deal={deal || undefined} ref={stack} onAnimationEnd={settle}>
      <IsoFigure figure={figure} className="iso-passes" />
    </div>
  )
}
