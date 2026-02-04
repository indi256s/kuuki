import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Globe2, Plane, MapPin, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyPassportProps {
  onAddCountry: () => void
}

export function EmptyPassport({ onAddCountry }: EmptyPassportProps) {
  const { t } = useTranslation()

  return (
    <Card className="border-dashed border-2 border-border/50 bg-card/50 overflow-hidden">
      <CardContent className="py-16 px-8 relative">
        {/* Background globe - subtle, inspiring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Globe2
            className="w-[400px] h-[400px] text-muted-foreground/[0.03] motion-reduce:opacity-100"
            strokeWidth={0.5}
            aria-hidden="true"
          />
        </div>

        <div className="max-w-md mx-auto text-center space-y-6 relative z-10">
          {/* Compass icon with subtle animation */}
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse motion-reduce:animate-none" />
            <div className="absolute inset-2 rounded-full bg-primary/10" />
            <Compass
              className="absolute inset-0 w-full h-full p-5 text-primary/60"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>

          {/* Inspirational title */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary/80 tracking-wide uppercase">
              {t('passport.emptyTagline', '246 countries await')}
            </p>
            <h3 className="text-2xl font-semibold tracking-tight">
              {t('passport.emptyTitle', 'Your Journey Begins Here')}
            </h3>
            <p className="text-muted-foreground">
              {t('passport.emptyDescription', 'Every stamp tells a story. Start collecting memories from every corner of the world.')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button onClick={onAddCountry} size="lg" className="gap-2">
              <MapPin className="w-4 h-4" />
              {t('passport.addFirstCountry', 'Add Your First Country')}
            </Button>
            <Button variant="outline" size="lg" asChild className="gap-2">
              <Link to="/import">
                <Plane className="w-4 h-4" />
                {t('passport.importFlights', 'Import Flights')}
              </Link>
            </Button>
          </div>

          {/* Hint */}
          <p className="text-xs text-muted-foreground/70 pt-2">
            {t('passport.hint', 'Flights automatically add countries to your passport')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
