import { useMemo } from 'react'
import { aircraft } from '@kuuki/data'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { Aircraft } from '@kuuki/shared/types'

interface AircraftPickerProps {
  value: string
  onChange: (icao: string, aircraft?: Aircraft) => void
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  id?: string
}

/**
 * Grouped aircraft picker - groups aircraft by manufacturer for easier browsing.
 * Similar to airline alliance grouping pattern.
 */
export function AircraftPicker({ value, onChange, placeholder, label, required, disabled, id }: AircraftPickerProps) {
  // Group aircraft by manufacturer (similar to airline alliance grouping)
  const groupedAircraft = useMemo(() => {
    // Major manufacturers first
    const majorManufacturers = ['Airbus', 'Boeing', 'Embraer', 'Bombardier', 'ATR']
    const groups: Record<string, typeof aircraft> = {}

    // Initialize groups
    majorManufacturers.forEach(mfr => { groups[mfr] = [] })
    groups['Other'] = []

    // Group aircraft by manufacturer
    aircraft.forEach(ac => {
      if (majorManufacturers.includes(ac.manufacturer)) {
        groups[ac.manufacturer].push(ac)
      } else {
        groups['Other'].push(ac)
      }
    })

    // Sort within groups by ICAO code
    Object.values(groups).forEach(group => {
      group.sort((a, b) => a.icao.localeCompare(b.icao))
    })

    return groups
  }, [])

  const handleValueChange = (icao: string) => {
    const selectedAircraft = aircraft.find(ac => ac.icao === icao)
    onChange(icao, selectedAircraft)
  }

  return (
    <div className="space-y-1">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder || "Select aircraft..."} />
        </SelectTrigger>
        <SelectContent position="popper" align="center" className="max-h-80 min-w-[280px] overflow-y-auto">
          {Object.entries(groupedAircraft).map(([manufacturer, aircraftList], index) =>
            aircraftList.length > 0 ? (
              <div key={manufacturer}>
                <SelectGroup>
                  <SelectLabel>{manufacturer}</SelectLabel>
                  {aircraftList.map(ac => (
                    <SelectItem key={ac.icao} value={ac.icao}>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-medium">{ac.icao}</span>
                        <span className="text-muted-foreground">• {ac.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
                {/* Add separator between groups (except after last group) */}
                {index < Object.keys(groupedAircraft).length - 1 && aircraftList.length > 0 && (
                  <SelectSeparator />
                )}
              </div>
            ) : null
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
