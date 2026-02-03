import { useTranslation } from 'react-i18next'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { AppHeader } from '@/components/common/AppHeader'
import { PlaneAnimation } from '@/components/common/PlaneAnimation'
import {
  LanguageSection,
  DataExportSection,
  DeleteAccountSection,
} from '@/components/settings'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
      {/* Background plane animation */}
      <PlaneAnimation className="z-0" variant="subtle" count={20} />

      {/* Mobile header */}
      <MobileHeader />

      {/* Desktop header */}
      <AppHeader />

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-6 py-8 pb-safe sm:pb-8 relative z-10">
        {/* Page title */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {t('settings.title')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Settings sections */}
        <div className="space-y-6">
          {/* Language selector */}
          <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
            <LanguageSection />
          </div>

          {/* Data export */}
          <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
            <DataExportSection />
          </div>

          {/* Delete account (Danger Zone) */}
          <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
            <DeleteAccountSection />
          </div>
        </div>
      </main>

      {/* Mobile tab bar */}
      <MobileTabBar />
    </div>
  )
}
