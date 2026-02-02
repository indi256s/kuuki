import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'
import { Languages } from 'lucide-react'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SignInForm, FlyingPlanes, RotatingTagline } from '@/components/auth'
import { AccentPicker, type AccentColor } from '@/components/common/AccentPicker'

type AuthMode = 'register' | 'signin'

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toggleLanguage } = useLanguage()
  const [mode, setMode] = useState<AuthMode>('register')
  const [accentColor, setAccentColor] = useState<AccentColor>('coral')

  // Set coral as default accent color on mount
  useEffect(() => {
    document.documentElement.style.setProperty('--primary', '#F76B6E')
    document.documentElement.style.setProperty('--ring', '#F76B6E')
  }, [])

  const handleSuccess = () => {
    navigate('/dashboard')
  }

  // Get taglines array from i18n
  const taglines = t('auth.taglines', { returnObjects: true }) as string[]

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#08090A] flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-300">

      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-60 dark:opacity-40" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 dark:bg-primary/10 blur-[120px] rounded-full pointer-events-none opacity-50 dark:opacity-30" />

      {/* Mobile: Atmospheric background elements */}
      <div className="lg:hidden absolute inset-0 pointer-events-none overflow-hidden">
        {/* Horizontal katakana for mobile */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-0">
          <span className="text-4xl font-bold text-neutral-900/[0.06] dark:text-white/[0.05] font-display tracking-[0.3em] select-none">
            クウキ
          </span>
        </div>
        {/* Planes behind form on mobile */}
        <div className="opacity-50">
          <FlyingPlanes />
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-[1100px] min-h-[600px] lg:h-[700px] rounded-[32px] grid lg:grid-cols-[40%_60%] overflow-hidden shadow-xl dark:shadow-2xl relative z-10 transition-all duration-500 bg-white/90 dark:bg-white/[0.03] lg:bg-white/80 backdrop-blur-xl border border-neutral-200/50 dark:border-white/[0.06]">

        {/* Left Side: Visual / Brand (Desktop only) */}
        <div className="relative hidden lg:flex flex-col justify-start p-12 overflow-hidden group bg-neutral-100/50 dark:bg-transparent">
          {/* Dynamic Background for Left Panel */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 dark:from-primary/10 to-transparent opacity-80 dark:opacity-50 z-0" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] dark:opacity-20 z-0 mix-blend-overlay" />

          {/* Planes animation */}
          <FlyingPlanes />

          {/* Top Branding with Rotating Tagline */}
          <div className="relative z-10">
            <h1 className="text-4xl font-bold tracking-tighter text-neutral-800 dark:text-white/90 mb-3">
              <span className="text-primary">Ku</span>uki
            </h1>
            <RotatingTagline
              items={taglines}
              interval={6000}
              className="text-neutral-500 dark:text-white/50 text-sm font-medium tracking-wide"
            />
          </div>

          {/* Center Visual Feature - Japanese Typography (Hero opacity) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none select-none">
            <span className="text-[12rem] font-bold leading-none text-neutral-900/[0.10] dark:text-white/[0.08] writing-vertical select-none font-display tracking-widest">
              クウキ
            </span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="relative flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-12 bg-white/50 dark:bg-black/20 backdrop-blur-xl">
          {/* Top Right Controls */}
          <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
            <AccentPicker value={accentColor} onChange={setAccentColor} />
            <div className="w-px h-5 bg-neutral-300 dark:bg-white/10" />
            <Button
              variant="ghost"
              onClick={toggleLanguage}
              className="text-neutral-500 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white h-9 w-9 p-0 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5"
            >
              <Languages className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile: Brand header inside form area */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tighter text-neutral-800 dark:text-white/90 mb-3">
              <span className="text-primary">Ku</span>uki
            </h1>
            <RotatingTagline
              items={taglines}
              interval={6000}
              className="text-neutral-500 dark:text-white/50 text-sm font-medium tracking-wide justify-center"
            />
          </div>

          <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
            {mode === 'register' ? (
              <RegisterForm
                onSuccess={handleSuccess}
                onSignInClick={() => setMode('signin')}
              />
            ) : (
              <SignInForm
                onSuccess={handleSuccess}
                onSignUpClick={() => setMode('register')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
