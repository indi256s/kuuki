import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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
          variant="secondary"
          className={cn(
            'cursor-pointer border border-dashed border-border',
            'hover:bg-secondary hover:border-primary/40',
            'transition-colors duration-150',
            'text-muted-foreground',
            'px-2.5 py-1',
            className
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('flights.addAircraft', 'Add aircraft')}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader className="mb-3">
          <PopoverTitle>{t('flights.setAircraft', 'Set Aircraft')}</PopoverTitle>
          <PopoverDescription>
            {t('flights.aircraftPickerDescription', 'Select the aircraft type for this flight.')}
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
