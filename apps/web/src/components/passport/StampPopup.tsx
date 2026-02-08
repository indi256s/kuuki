import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plane, Calendar, Ship, Car, Trash2 } from 'lucide-react'
import { useCountryStats, useUnclaimCountry } from '@/hooks/usePassport'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { PassportEntry, GroundVisit } from '@kuuki/shared'

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

function GroundVisitItem({ visit }: { visit: GroundVisit }) {
  const { t } = useTranslation()

  return (
    <div className="flex items-start gap-2 py-1.5">
      {visit.entryMethod && (
        <Badge variant="outline" className="text-xs gap-1 shrink-0">
          {visit.entryMethod === 'land' ? (
            <><Car className="w-3 h-3" />{t('passport.land', 'Land')}</>
          ) : (
            <><Ship className="w-3 h-3" />{t('passport.sea', 'Sea')}</>
          )}
        </Badge>
      )}
      {visit.visitYear && (
        <span className="text-xs text-muted-foreground font-mono shrink-0">{visit.visitYear}</span>
      )}
      {visit.note && (
        <span className="text-xs italic text-muted-foreground/80 line-clamp-2">"{visit.note}"</span>
      )}
      {!visit.entryMethod && !visit.visitYear && !visit.note && (
        <span className="text-xs text-muted-foreground">{t('passport.groundVisits', 'Ground visit')}</span>
      )}
    </div>
  )
}

export function StampPopup({ entry, onClose }: StampPopupProps) {
  const { t } = useTranslation()
  const { data: stats, isLoading } = useCountryStats(entry.countryCode)
  const unclaimCountry = useUnclaimCountry()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Can only delete if country is claimed (not flight-only)
  const canDelete = stats?.isClaimed && entry.source !== 'flight'

  const handleDelete = () => {
    unclaimCountry.mutate(entry.countryCode, {
      onSuccess: () => {
        onClose()
      }
    })
  }

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
                        <span className="ml-1 text-muted-foreground">x{airport.visitCount}</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Ground visits list */}
            {stats.groundVisits.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  {t('passport.groundVisits', 'Ground Visits')} ({stats.groundVisits.length})
                </p>
                <div className="space-y-0.5">
                  {stats.groundVisits.map((visit) => (
                    <GroundVisitItem key={visit.id} visit={visit} />
                  ))}
                </div>
              </div>
            )}

            {/* Delete button for claimed countries */}
            {canDelete && (
              <div className="pt-2 border-t border-border/50">
                {showDeleteConfirm ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t('passport.deleteConfirm', 'Remove this country from your passport? This will delete all ground visit records.')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-8 text-sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={unclaimCountry.isPending}
                      >
                        {t('common.cancel', 'Cancel')}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-8 text-sm"
                        onClick={handleDelete}
                        disabled={unclaimCountry.isPending}
                      >
                        {unclaimCountry.isPending ? t('common.removing', 'Removing...') : t('common.remove', 'Remove')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full h-8 text-sm text-muted-foreground hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('passport.deleteVisit', 'Remove from Passport')}
                  </Button>
                )}
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
