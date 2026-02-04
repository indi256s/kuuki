import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { KuukiIconTestGrid } from '@/components/common/KuukiIconVariants'
import { KuukiIcon } from '@/components/common/KuukiIcon'

/**
 * Dev page for testing Kuuki icon animation variants.
 * Access via /dev/icons
 */
export function DevIconsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="font-semibold">Icon Animation Lab</h1>
        </div>
      </header>

      {/* Current Implementation */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold mb-4">Current Implementation</h2>
        <div className="flex items-center gap-4 p-6 rounded-xl bg-card border border-border">
          <div className="w-16 h-16 flex items-center justify-center bg-primary/10 rounded-lg">
            <KuukiIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Breathing Single く</h3>
            <p className="text-sm text-muted-foreground">
              Gentle scale + float animation
            </p>
          </div>
        </div>
      </section>

      {/* All Variants */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <h2 className="text-lg font-semibold mb-4">Animation Variants (showing all くうき)</h2>
        <KuukiIconTestGrid />
      </section>

      {/* Usage in Header Context */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <h2 className="text-lg font-semibold mb-4">In Header Context</h2>
        <div className="space-y-4">
          {[
            { name: 'Current (Breathing)', icon: <KuukiIcon className="w-5 h-5 text-primary" /> },
          ].map(({ name, icon }) => (
            <div
              key={name}
              className="flex items-center gap-8 p-4 rounded-xl bg-card border border-border"
            >
              {/* Simulated header */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  {icon}
                </div>
                <span className="text-lg font-semibold tracking-tight">Kuuki</span>
              </div>
              <span className="text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
