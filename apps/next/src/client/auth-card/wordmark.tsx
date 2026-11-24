import './auth-card.css'

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
