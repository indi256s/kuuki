import { useTranslation } from 'react-i18next'
import { X, Plane, Calendar, Ship, Car } from 'lucide-react'
import { useCountryStats } from '@/hooks/usePassport'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { PassportEntry } from '@kuuki/shared'

interface StampPopupProps {
  entry: PassportEntry
  onClose: () => void
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function StampPopup({ entry, onClose }: StampPopupProps) {
  const { t } = useTranslation()
  const { data: stats, isLoading } = useCountryStats(entry.countryCode)

  return (
    <Card className="w-80 shadow-lg border-border/50 animate-in fade-in-0 zoom-in-95 duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.dominantColor }}
              />
              {entry.countryName}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-medium">
              {entry.nativeName}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2 -mt-1"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t('common.close')}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : stats ? (
          <>
            {/* Visit stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('passport.firstVisit', 'First Visit')}</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(stats.firstVisit)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('passport.lastVisit', 'Last Visit')}</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(stats.lastVisit)}
                </p>
              </div>
            </div>

            {/* Total visits */}
            <div className="flex items-center justify-between py-2 border-t border-border/50">
              <span className="text-sm text-muted-foreground">
                {t('passport.totalVisits', 'Total Visits')}
              </span>
              <Badge variant="secondary" className="font-mono">
                {stats.totalVisits}
              </Badge>
            </div>

            {/* Airports visited */}
            {stats.airports.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Plane className="w-3.5 h-3.5" />
                  {t('passport.airportsVisited', 'Airports Visited')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {stats.airports.map((airport) => (
                    <Badge
                      key={airport.iata}
                      variant="outline"
                      className="text-xs font-mono"
                      title={`${airport.city} - ${airport.visitCount} visit(s)`}
                    >
                      {airport.iata}
                      {airport.visitCount > 1 && (
                        <span className="ml-1 text-muted-foreground">×{airport.visitCount}</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Entry method (for claims) */}
            {stats.entryMethod && (
              <div className="flex items-center gap-2 py-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {t('passport.entryMethod', 'Entry Method')}
                </span>
                <Badge variant="outline" className="text-xs gap-1">
                  {stats.entryMethod === 'land' ? (
                    <>
                      <Car className="w-3 h-3" />
                      {t('passport.land', 'Land')}
                    </>
                  ) : (
                    <>
                      <Ship className="w-3 h-3" />
                      {t('passport.sea', 'Sea')}
                    </>
                  )}
                </Badge>
              </div>
            )}

            {/* Note */}
            {stats.note && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('passport.note', 'Note')}
                </p>
                <p className="text-sm italic text-muted-foreground/80">
                  "{stats.note}"
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('errors.loadingStats', 'Failed to load stats')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
