import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { AircraftPicker } from './AircraftPicker'
import { useUpdateFlight } from '@/hooks/useFlights'
import type { Aircraft } from '@kuuki/shared/types'

interface AircraftPendingBadgeProps {
  flightId: number
  className?: string
}

export function AircraftPendingBadge({ flightId, className }: AircraftPendingBadgeProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedAircraft, setSelectedAircraft] = useState('')
  const updateFlight = useUpdateFlight()

  const handleAircraftChange = (icao: string, _aircraft?: Aircraft) => {
    setSelectedAircraft(icao)
  }

  const handleSave = async () => {
    if (selectedAircraft) {
      await updateFlight.mutateAsync({
        flightId,
        updates: { aircraft_icao: selectedAircraft },
      })
      setIsOpen(false)
      setSelectedAircraft('')
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    setSelectedAircraft('')
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={`cursor-pointer hover:bg-muted gap-1 text-muted-foreground ${className}`}
        >
          <Clock className="w-3 h-3" />
          {t('flights.pending', 'Pending')}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader className="mb-3">
          <PopoverTitle>{t('flights.setAircraft', 'Set Aircraft')}</PopoverTitle>
          <PopoverDescription>
            {t('flights.pendingDescription', "We couldn't identify the aircraft. You can set it manually.")}
          </PopoverDescription>
        </PopoverHeader>

        <div className="space-y-3">
          <AircraftPicker
            value={selectedAircraft}
            onChange={handleAircraftChange}
            placeholder={t('flights.selectAircraft', 'Select aircraft...')}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedAircraft || updateFlight.isPending}
            >
              {updateFlight.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
