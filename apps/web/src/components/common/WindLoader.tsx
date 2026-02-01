import { useTranslation } from 'react-i18next'

interface WindLoaderProps {
  step?: 'reading' | 'extracting' | 'finding'
  size?: 'sm' | 'md' | 'lg'
}

export function WindLoader({ step = 'reading', size = 'md' }: WindLoaderProps) {
  const { t } = useTranslation()

  const sizeClasses = {
    sm: 'w-32 h-24',
    md: 'w-48 h-36',
    lg: 'w-64 h-48',
  }

  const stepMessages = {
    reading: t('import.parsing.reading', 'Reading file...'),
    extracting: t('import.parsing.extracting', 'Extracting text...'),
    finding: t('import.parsing.finding', 'Finding flights...'),
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative ${sizeClasses[size]} overflow-hidden`}>
        {/* Sky gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-sunken to-sky rounded-xl" />

        {/* Wind streaks - fast horizontal lines */}
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <div
              key={`streak-${i}`}
              className="absolute h-px bg-gradient-to-r from-transparent via-runway/30 to-transparent"
              style={{
                top: `${15 + i * 15}%`,
                left: '-100%',
                width: '50%',
                animation: `wind-streak ${1.5 + i * 0.2}s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Background clouds - smaller, faster */}
        <div className="absolute inset-0">
          <Cloud
            size="sm"
            className="absolute"
            style={{
              top: '20%',
              animation: 'cloud-drift 4s ease-in-out infinite',
              animationDelay: '0s',
            }}
          />
          <Cloud
            size="xs"
            className="absolute"
            style={{
              top: '60%',
              animation: 'cloud-drift 3.5s ease-in-out infinite',
              animationDelay: '1.5s',
            }}
          />
          <Cloud
            size="sm"
            className="absolute"
            style={{
              top: '75%',
              animation: 'cloud-drift 4.5s ease-in-out infinite',
              animationDelay: '0.8s',
            }}
          />
        </div>

        {/* Mid-ground clouds */}
        <div className="absolute inset-0">
          <Cloud
            size="md"
            className="absolute opacity-80"
            style={{
              top: '35%',
              animation: 'cloud-drift 5s ease-in-out infinite',
              animationDelay: '0.3s',
            }}
          />
          <Cloud
            size="md"
            className="absolute opacity-70"
            style={{
              top: '50%',
              animation: 'cloud-drift 5.5s ease-in-out infinite',
              animationDelay: '2s',
            }}
          />
        </div>

        {/* Foreground cloud - larger, breathing */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Cloud
            size="lg"
            className="opacity-90"
            style={{
              animation: 'cloud-breathe 3s ease-in-out infinite',
            }}
          />
        </div>

        {/* Subtle particle effects */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={`particle-${i}`}
              className="absolute w-1 h-1 rounded-full bg-runway/20"
              style={{
                top: `${Math.random() * 100}%`,
                left: '-5%',
                animation: `particle-float ${2 + Math.random() * 2}s linear infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Progress text */}
      <div className="flex items-center gap-2 text-ink-muted">
        <div className="flex gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full bg-runway animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-runway animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-runway animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-sm font-medium">{stepMessages[step]}</span>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes wind-streak {
          0% {
            left: -50%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            left: 150%;
            opacity: 0;
          }
        }

        @keyframes cloud-drift {
          0% {
            left: -30%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            left: 130%;
            opacity: 0;
          }
        }

        @keyframes cloud-breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }

        @keyframes particle-float {
          0% {
            left: -5%;
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            left: 105%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

// Cloud SVG component with different sizes
interface CloudProps {
  size: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

function Cloud({ size, className = '', style }: CloudProps) {
  const sizeMap = {
    xs: { width: 24, height: 16 },
    sm: { width: 36, height: 24 },
    md: { width: 48, height: 32 },
    lg: { width: 72, height: 48 },
  }

  const { width, height } = sizeMap[size]

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 72 48"
      fill="none"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id={`cloud-gradient-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8F4FC" />
          <stop offset="100%" stopColor="#B8DDF0" />
        </linearGradient>
      </defs>
      {/* Main cloud shape - fluffy cumulus */}
      <ellipse cx="36" cy="32" rx="28" ry="14" fill={`url(#cloud-gradient-${size})`} />
      <ellipse cx="24" cy="26" rx="16" ry="12" fill={`url(#cloud-gradient-${size})`} />
      <ellipse cx="48" cy="26" rx="14" ry="10" fill={`url(#cloud-gradient-${size})`} />
      <ellipse cx="36" cy="20" rx="18" ry="14" fill={`url(#cloud-gradient-${size})`} />
      <ellipse cx="28" cy="18" rx="12" ry="10" fill={`url(#cloud-gradient-${size})`} />
      <ellipse cx="44" cy="18" rx="10" ry="8" fill={`url(#cloud-gradient-${size})`} />
    </svg>
  )
}
