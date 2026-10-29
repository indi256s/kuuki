import { NavigationLink as Link } from './navigation-link'

export function Wordmark({ label = 'Kuuki home' }: { label?: string }) {
  return (
    <Link href="/" className="wordmark" aria-label={label}>
      <span className="mark" aria-hidden>
        {['く', 'う', 'き'].map((glyph) => (
          <span className="mark-glyph" key={glyph}>
            {glyph}
          </span>
        ))}
      </span>
      <span>kuuki</span>
    </Link>
  )
}
