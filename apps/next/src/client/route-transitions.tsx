'use client'

import type { ComponentProps, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  MultiAnimation,
  Ssgoi,
  SpringIntegrator,
  WebAnimation,
  defineTransition,
  type Animation as SsgoiAnimation,
  type PrepareArgs,
  type SsgoiConfig,
  type Transition,
  type TransitionConfig,
} from '@ssgoi/react'
import { SsgoiRouteBoundary } from '@ssgoi/react/nextjs'
import { drill, hero } from '@ssgoi/react/view-transitions'
import { TAB_ROUTES, useTransitionKey, type StageKind } from './route-transition-pairs'
import {
  ROUTE_SPRINGS,
  SPRING_REST,
  TAB_FADE,
  clock,
  keepVisibleStamps,
  type Spring,
} from './route-motion'

const integrator = (spring: Spring) => new SpringIntegrator({ ...spring, ...SPRING_REST })
const override = (retune: (args: { animation: SsgoiAnimation }) => void) => ({
  override: { forward: retune, backward: retune },
})

const tuned = (spring: Spring) =>
  override(({ animation }) => {
    animation.set({ integrator: integrator(spring) })
  })

const REDUCED = Symbol('reduced-motion')
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
let markerToken = 0

// Where each page sat in its stage, read as React detaches it. ssgoi puts the outgoing copy at the stage top,
// which moves a page that sat lower down, so it goes back to this offset.
const stageOffsets = new WeakMap<HTMLElement, number>()
function trackOffset(node: HTMLDivElement | null) {
  if (node)
    return () => {
      stageOffsets.set(node, node.offsetTop)
    }
}
function StagePage(props: ComponentProps<'div'>) {
  return <div {...props} ref={trackOffset} />
}

/**
 * Fade-in only: the outgoing page hides at once, so the incoming one never waits on it. Opacity alone, so reduced
 * motion keeps it, shorter and linear.
 */
function tabFade(): Transition {
  const direction = {
    prepare({ from, to, onCleanup }: PrepareArgs) {
      let hidden: HTMLElement | undefined
      void from.then((page) => {
        hidden = page
        page.style.visibility = 'hidden'
      })
      void to.then((page) => {
        page.style.opacity = '0'
      })
      onCleanup?.(() => {
        if (hidden) hidden.style.visibility = ''
      })
      return {}
    },
    animation({ to }: { to: HTMLElement }) {
      const { ms, ease } = reducedMotion() ? TAB_FADE.reduced : TAB_FADE.motion
      return new MultiAnimation({
        in: new WebAnimation({
          element: to,
          integrator: clock(ms),
          style: (t) => ({ opacity: ease(t) }),
          onDispose: () => {
            to.style.opacity = ''
          },
        }),
      })
    },
  }
  return defineTransition({ forward: direction, backward: direction })
}

/**
 * Wraps a preset for Kuuki: reduced motion swaps instantly unless the preset keeps its own reduced form; otherwise the
 * outgoing page turns inert and `html[data-route-transition]` names the running transition until it settles.
 */
function routeTransition(
  name: string,
  preset: Transition,
  {
    beforePrepare,
    keepWhenReduced = false,
  }: { beforePrepare?: (args: PrepareArgs) => void; keepWhenReduced?: boolean } = {},
): TransitionConfig<object> {
  return {
    prepare(args) {
      if (!keepWhenReduced && reducedMotion()) {
        void args.from.then((page) => {
          page.inert = true
          page.style.visibility = 'hidden'
        })
        return { [REDUCED]: true }
      }
      const root = document.documentElement
      const token = ++markerToken
      root.dataset.routeTransition = name
      let outgoing: HTMLElement | undefined
      void args.from.then((page) => {
        outgoing = page
        page.inert = true
        page.setAttribute('aria-hidden', 'true')
        const offset = stageOffsets.get(page)
        if (offset) page.style.top = `${(parseFloat(page.style.top) || 0) + offset}px`
      })
      args.onCleanup?.(() => {
        if (outgoing) {
          outgoing.inert = false
          outgoing.removeAttribute('aria-hidden')
        }
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
  // The outgoing page is inert, so there is nothing to protect; a scroll right after a tap must land.
  scrollLock: false,
  transitions: [
    {
      from: '/import',
      to: '/passport',
      bidirectional: false,
      // Import → Passport is also a tab switch; the stamps' hero wins.
      priority: 1,
      transition: routeTransition('hero', hero({}, tuned(ROUTE_SPRINGS.hero)), {
        beforePrepare: keepVisibleStamps,
      }),
    },
    {
      from: TAB_ROUTES,
      to: TAB_ROUTES,
      transition: routeTransition('fade', tabFade(), { keepWhenReduced: true }),
    },
    {
      from: '/leaderboard',
      to: '/fly/*',
      transition: routeTransition('drill', drill({}, tuned(ROUTE_SPRINGS.page))),
    },
  ],
}

export function RouteTransitions({ children }: { children: ReactNode }) {
  return <Ssgoi config={config}>{children}</Ssgoi>
}

export function RouteStage({
  stage,
  className,
  children,
}: {
  stage: StageKind
  className?: string
  children: ReactNode
}) {
  const key = useTransitionKey(stage, usePathname())
  return (
    <div className="route-stage">
      <SsgoiRouteBoundary as={StagePage} routeKey={key} className={className}>
        {children}
      </SsgoiRouteBoundary>
    </div>
  )
}
