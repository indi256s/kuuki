import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { allowedLegacyReturn } from '@/lib/legacyBridge'
import { AppPageShell } from '@/components/layout/AppPageShell'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { AppHeader } from '@/components/common/AppHeader'
import { PlaneAnimation } from '@/components/common/PlaneAnimation'
import {
  AppearanceSection,
  LanguageSection,
  ProfileSection,
  DataExportSection,
  DeleteAccountSection,
} from '@/components/settings'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const returnTo = allowedLegacyReturn(new URLSearchParams(location.search).get('returnTo'))

  return (
    <AppPageShell
      shellClassName="min-h-screen bg-gradient-soft relative overflow-hidden"
      maxWidth="settings"
      className="mx-auto px-6 py-8 pb-safe sm:pb-8 relative z-10"
      beforeMain={<PlaneAnimation className="z-0" variant="subtle" count={20} />}
      mobileHeader={<MobileHeader />}
      appHeader={<AppHeader />}
      mobileTabBar={<MobileTabBar />}
    >
        {/* Page title */}
        {returnTo && <a href={returnTo}>{i18n.language.startsWith('ru') ? 'Вернуться в Kuuki' : 'Return to Kuuki'}</a>}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {t('settings.title')}
            <span className="ml-3 text-sm font-normal text-muted-foreground hidden sm:inline">
              {t('settings.subtitle')}
            </span>
          </h1>
        </div>

        {/* Settings sections */}
        <div className="space-y-6">
          {/* Appearance selector */}
          <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
            <AppearanceSection />
          </div>

          {/* Language selector */}
          <div className="animate-fade-up" style={{ animationDelay: '75ms' }}>
            <LanguageSection />
          </div>

          {/* Profile & Privacy */}
          <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
            <ProfileSection />
          </div>

          {/* Data export */}
          <div className="animate-fade-up" style={{ animationDelay: '225ms' }}>
            <DataExportSection />
          </div>

          {/* Delete account (Danger Zone) */}
          <div className="animate-fade-up" style={{ animationDelay: '300ms' }}>
            <DeleteAccountSection />
          </div>
        </div>
    </AppPageShell>
  )
}
