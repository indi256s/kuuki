import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Stamp, Plane, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyPassportProps {
  onAddCountry: () => void
}

export function EmptyPassport({ onAddCountry }: EmptyPassportProps) {
  const { t } = useTranslation()

  return (
    <Card className="border-dashed border-2 border-border/50 bg-card/50">
      <CardContent className="py-16 px-8">
        <div className="max-w-md mx-auto text-center space-y-6">
          {/* Decorative passport pages */}
          <div className="relative w-32 h-40 mx-auto mb-8">
            {/* Background pages */}
            <div className="absolute inset-0 bg-secondary/30 rounded-lg transform rotate-3" />
            <div className="absolute inset-0 bg-secondary/50 rounded-lg transform -rotate-2" />

            {/* Main page */}
            <div className="absolute inset-0 bg-card rounded-lg border border-border/50 shadow-sm flex flex-col items-center justify-center gap-3">
              {/* Stamp outlines (empty) */}
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
                <div className="w-10 h-7 rounded border-2 border-dashed border-muted-foreground/30" />
              </div>
              <div className="flex gap-2">
                <div className="w-10 h-7 rounded border-2 border-dashed border-muted-foreground/30" />
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
              </div>

              {/* Stamp icon overlay */}
              <Stamp className="absolute w-12 h-12 text-muted-foreground/20" />
            </div>
          </div>

          {/* Title & description */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">
              {t('passport.emptyTitle', 'Your Passport Awaits')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('passport.emptyDescription', 'Start collecting stamps from every country you visit. Flights are automatically tracked, or add countries you\'ve reached by land or sea.')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button onClick={onAddCountry} className="gap-2">
              <MapPin className="w-4 h-4" />
              {t('passport.addCountry', 'Add a Country')}
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link to="/import">
                <Plane className="w-4 h-4" />
                {t('passport.importFlights', 'Import Flights')}
              </Link>
            </Button>
          </div>

          {/* Hint */}
          <p className="text-xs text-muted-foreground/70 pt-2">
            {t('passport.hint', 'Countries from your flights will appear automatically')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
