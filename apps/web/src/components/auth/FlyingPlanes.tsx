import { Plane } from 'lucide-react'

/**
 * Matrix-style ascending planes animation for auth page.
 * Creates a "departures board" ambience with small plane icons
 * drifting upward at varying speeds and opacities.
 */

const planes = [
  { left: '15%', duration: 20, delay: 0, opacity: 0.04 },
  { left: '35%', duration: 24, delay: 4, opacity: 0.03 },
  { left: '55%', duration: 18, delay: 8, opacity: 0.05 },
  { left: '75%', duration: 22, delay: 2, opacity: 0.035 },
  { left: '25%', duration: 26, delay: 12, opacity: 0.04 },
  { left: '65%', duration: 19, delay: 6, opacity: 0.03 },
  { left: '45%', duration: 23, delay: 10, opacity: 0.045 },
  { left: '85%', duration: 21, delay: 14, opacity: 0.035 },
]

export function FlyingPlanes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {planes.map((plane, i) => (
        <div
          key={i}
          className="absolute animate-plane-ascend"
          style={{
            left: plane.left,
            bottom: '-10%',
            ['--plane-duration' as string]: `${plane.duration}s`,
            ['--plane-delay' as string]: `${plane.delay}s`,
            ['--plane-opacity' as string]: plane.opacity,
          }}
        >
          <Plane
            className="w-5 h-5 text-neutral-900 dark:text-white"
            style={{ opacity: plane.opacity }}
            strokeWidth={1.5}
          />
        </div>
      ))}
    </div>
  )
}
