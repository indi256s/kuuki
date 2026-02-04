import { cn } from '@/lib/utils'

const FONT_FAMILY = "'Hiragino Kaku Gothic Pro', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif"

/**
 * Test component showing all Kuuki icon animation variants.
 * Access via /dev/icons route.
 */

// Method 1: Vertical Stack with Wave
export function KuukiIconWave({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-0 leading-none', className)}>
      {['く', 'う', 'き'].map((char, i) => (
        <span
          key={char}
          className="text-lg font-bold kuuki-wave"
          style={{
            fontFamily: FONT_FAMILY,
            animationDelay: `${i * 0.4}s`,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  )
}

// Method 2: Horizontal Row with Traveling Glow
export function KuukiIconGlow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5 relative', className)}>
      {['く', 'う', 'き'].map((char, i) => (
        <span
          key={char}
          className="text-lg font-bold kuuki-glow"
          style={{
            fontFamily: FONT_FAMILY,
            animationDelay: `${i * 0.5}s`,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  )
}

// Method 3: Fade Crossfade
export function KuukiIconCrossfade({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-6 h-6 flex items-center justify-center', className)}>
      {['く', 'う', 'き'].map((char, i) => (
        <span
          key={char}
          className="absolute text-xl font-bold kuuki-crossfade"
          style={{
            fontFamily: FONT_FAMILY,
            animationDelay: `${i * 2}s`,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  )
}

// Method 4: Circular Orbit
export function KuukiIconOrbit({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-10 h-10 kuuki-orbit-container', className)}>
      {['く', 'う', 'き'].map((char, i) => (
        <span
          key={char}
          className="absolute text-sm font-bold kuuki-orbit-char"
          style={{
            fontFamily: FONT_FAMILY,
            // Position in triangle formation
            top: i === 0 ? '0' : '60%',
            left: i === 0 ? '50%' : i === 1 ? '10%' : '70%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {char}
        </span>
      ))}
    </div>
  )
}

// Method 5: Staggered Reveal (Typewriter)
export function KuukiIconReveal({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {['く', 'う', 'き'].map((char, i) => (
        <span
          key={char}
          className="text-lg font-bold kuuki-reveal"
          style={{
            fontFamily: FONT_FAMILY,
            animationDelay: `${i * 0.8}s`,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  )
}

// Method 6: Split-Flap Display
export function KuukiIconSplitFlap({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-6 h-7 overflow-hidden perspective-500', className)}>
      <div className="kuuki-splitflap">
        {['く', 'う', 'き', 'く'].map((char, i) => (
          <div
            key={i}
            className="absolute inset-0 flex items-center justify-center text-xl font-bold bg-card border border-border/50 rounded"
            style={{ fontFamily: FONT_FAMILY }}
          >
            {char}
          </div>
        ))}
      </div>
    </div>
  )
}

// All variants for testing
export function KuukiIconTestGrid() {
  const variants = [
    { name: 'Wave (Vertical)', component: KuukiIconWave, description: 'Breathing wave ripples through stacked characters' },
    { name: 'Glow (Horizontal)', component: KuukiIconGlow, description: 'Traveling highlight sweeps across' },
    { name: 'Crossfade', component: KuukiIconCrossfade, description: 'Characters fade in/out in sequence' },
    { name: 'Orbit', component: KuukiIconOrbit, description: 'Characters arranged in circle, rotate together' },
    { name: 'Reveal', component: KuukiIconReveal, description: 'Typewriter appear, then fade out' },
    { name: 'Split-Flap', component: KuukiIconSplitFlap, description: 'Airport departure board style flip' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 p-8">
      {variants.map(({ name, component: Component, description }) => (
        <div key={name} className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card border border-border">
          <div className="w-16 h-16 flex items-center justify-center bg-primary/10 rounded-lg">
            <Component className="text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-sm">{name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
