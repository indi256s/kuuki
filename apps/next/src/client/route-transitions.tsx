'use client'

import type { ComponentProps, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { MultiAnimation, Ssgoi, SpringIntegrator, type Animation as SsgoiAnimation, type PrepareArgs, type SsgoiConfig, type Transition, type TransitionConfig } from '@ssgoi/react'
import { SsgoiRouteBoundary } from '@ssgoi/react/nextjs'
import { axis, drill, hero } from '@ssgoi/react/view-transitions'
import { AUTH_SWAP_PATHS, useTransitionKey, type StageKind } from './route-transition-pairs'
import { FADE_IN_AT, ROUTE_SPRINGS, SPRING_REST, keepVisibleStamps, type Spring } from './route-motion'

const integrator = (spring: Spring) => new SpringIntegrator({ ...spring, ...SPRING_REST })
const override = (retune: (args: { animation: SsgoiAnimation }) => void) => ({ override: { forward: retune, backward: retune } })

const tuned = (spring: Spring) => override(({ animation }) => { animation.set({ integrator: integrator(spring) }) })

// The axis preset cross-fades both forms at once, which reads as two forms on top of each other. The incoming form
// waits until the outgoing one is mostly gone instead.
const fadeThrough = override(({ animation }) => {
  const pair = animation as MultiAnimation<'out' | 'in'>
  for (const track of ['out', 'in'] as const) pair.select(track).set({ integrator: integrator(ROUTE_SPRINGS.fade) })
  pair.startAt = [0, FADE_IN_AT]
})

const REDUCED = Symbol('reduced-motion')
let markerToken = 0

// Where each page sat in its stage, read as React detaches it. ssgoi puts the outgoing copy at the stage top,
// which moves a vertically centred auth panel, so it goes back to this offset.
const stageOffsets = new WeakMap<HTMLElement, number>()
function trackOffset(node: HTMLDivElement | null) {
  if (node) return () => { stageOffsets.set(node, node.offsetTop) }
}
function StagePage(props: ComponentProps<'div'>) {
  return <div {...props} ref={trackOffset} />
}

/**
 * Wraps a preset for Kuuki: reduced motion swaps instantly; otherwise the outgoing page turns inert and
 * `html[data-route-transition]` names the running transition until it settles.
 */
function routeTransition(name: string, preset: Transition, beforePrepare?: (args: PrepareArgs) => void): TransitionConfig<object> {
  return {
    prepare(args) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void args.from.then(page => { page.inert = true; page.style.visibility = 'hidden' })
        return { [REDUCED]: true }
      }
      const root = document.documentElement
      const token = ++markerToken
      root.dataset.routeTransition = name
      let outgoing: HTMLElement | undefined
      void args.from.then(page => {
        outgoing = page
        page.inert = true
        page.setAttribute('aria-hidden', 'true')
        const offset = stageOffsets.get(page)
        if (offset) page.style.top = `${(parseFloat(page.style.top) || 0) + offset}px`
      })
      args.onCleanup?.(() => {
        if (outgoing) { outgoing.inert = false; outgoing.removeAttribute('aria-hidden') }
        if (markerToken === token) delete root.dataset.routeTransition
      })
      beforePrepare?.(args)
      return preset.prepare!(args)
    },
    animation(args) {
      return REDUCED in args ? new MultiAnimation([]) : preset.animation(args)
    },
  }
}

const config: SsgoiConfig = {
  transitions: [
    { from: '/import', to: '/passport', bidirectional: false, transition: routeTransition('hero', hero({}, tuned(ROUTE_SPRINGS.hero)), keepVisibleStamps) },
    { from: '/leaderboard', to: '/fly/*', transition: routeTransition('drill', drill({}, tuned(ROUTE_SPRINGS.page))) },
    { ordered: AUTH_SWAP_PATHS, transition: routeTransition('axis', axis({ type: 'x', variant: 'snappy' }, fadeThrough)) },
  ],
}

export function RouteTransitions({ children }: { children: ReactNode }) {
  return <Ssgoi config={config}>{children}</Ssgoi>
}

export function RouteStage({ stage, className, children }: { stage: StageKind; className?: string; children: ReactNode }) {
  const key = useTransitionKey(stage, usePathname())
  return <div className="route-stage"><SsgoiRouteBoundary as={StagePage} routeKey={key} className={className}>{children}</SsgoiRouteBoundary></div>
}
