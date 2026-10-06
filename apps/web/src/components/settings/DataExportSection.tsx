import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileSpreadsheet, MapPin, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useFlightStats } from '@/hooks/useStats'
import { usePassportStats, usePassportClaims } from '@/hooks/usePassport'
import { useExportRateLimit } from '@/hooks/useExportRateLimit'
import { useAuthStore } from '@/stores/authStore'
import { getAllFlights } from '@kuuki/client/flights'
import { exportFlights, exportClaims } from '@kuuki/client/export'
import { useToast } from '@/hooks/useToast'

export function DataExportSection() {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.user?.id)
  const { data: stats } = useFlightStats()
  const { data: passportStats } = usePassportStats()
  const { data: claims } = usePassportClaims()
  const { canExport, remaining, recordExport } = useExportRateLimit()
  const { showSuccess, showError } = useToast()

  const [enriched, setEnriched] = useState(false)
  const [exportingFlights, setExportingFlights] = useState(false)
  const [exportingClaims, setExportingClaims] = useState(false)

  const flightCount = stats?.totalFlights ?? 0
  const claimsCount = passportStats?.countriesCount ?? 0

  const handleExportFlights = async () => {
    if (!userId || !canExport) return

    setExportingFlights(true)
    try {
      const flights = await getAllFlights(userId)
      if (flights.length === 0) throw new Error('No flights were returned for export. Please refresh and try again.')
      exportFlights(flights, { enriched })
      recordExport()
      showSuccess(t('settings.export.flights'))
    } catch (error) {
      showError(error)
    } finally {
      setExportingFlights(false)
    }
  }

  const handleExportClaims = async () => {
    if (!claims || claims.length === 0 || !canExport) return

    setExportingClaims(true)
    try {
      exportClaims(claims)
      recordExport()
      showSuccess(t('settings.export.claims'))
    } catch (error) {
      showError(error)
    } finally {
      setExportingClaims(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          {t('settings.export.title')}
        </CardTitle>
        <CardDescription>{t('settings.export.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enriched data toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="enriched"
            checked={enriched}
            onCheckedChange={(checked) => setEnriched(checked === true)}
          />
          <Label
            htmlFor="enriched"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {t('settings.export.formatToggle')}
          </Label>
        </div>

        {/* Export buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Flights export */}
          <Button
            variant="outline"
            onClick={handleExportFlights}
            disabled={flightCount === 0 || !canExport || exportingFlights}
            className="flex-1 justify-start gap-2"
            title={!canExport ? t('settings.export.rateLimitReached') : undefined}
          >
            {exportingFlights ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span className="flex-1 text-left">
              {flightCount > 0
                ? t('settings.export.flightsDesc', { count: flightCount })
                : t('settings.export.noFlights')
              }
            </span>
          </Button>

          {/* Claims export */}
          <Button
            variant="outline"
            onClick={handleExportClaims}
            disabled={claimsCount === 0 || !canExport || exportingClaims}
            className="flex-1 justify-start gap-2"
            title={!canExport ? t('settings.export.rateLimitReached') : undefined}
          >
            {exportingClaims ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            <span className="flex-1 text-left">
              {claimsCount > 0
                ? t('settings.export.claimsDesc', { count: claimsCount })
                : t('settings.export.noClaims')
              }
            </span>
          </Button>
        </div>

        {/* Rate limit info */}
        <p className={`text-sm ${canExport ? 'text-muted-foreground' : 'text-destructive'}`}>
          {canExport
            ? t('settings.export.rateLimitRemaining', { count: remaining })
            : t('settings.export.rateLimitReached')
          }
        </p>
      </CardContent>
    </Card>
  )
}
