import './auth-card.css'

/**
 * The text wordmark: "Ku" in the accent text color, "uki" in the text color, so it follows the accent and the theme.
 * One element named "Kuuki"; the two spans are visual only. The size comes from `--wordmark-size` on a parent.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Kuuki"
      className={className ? `kuuki-wordmark ${className}` : 'kuuki-wordmark'}
    >
      <span className="kuuki-wordmark-ku">Ku</span>
      <span className="kuuki-wordmark-uki">uki</span>
    </span>
  )
}
