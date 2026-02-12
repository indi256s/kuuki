import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { searchAirports, findAirport } from '@kuuki/data'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'
import type { Airport } from '@kuuki/shared/types'

interface AirportAutocompleteProps {
  value: string
  onChange: (iata: string, airport?: Airport) => void
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  id?: string
  error?: string
}

export function AirportAutocomplete({
  value,
  onChange,
  placeholder,
  label,
  required,
  disabled,
  id,
  error,
}: AirportAutocompleteProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<Airport[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Sync input with external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSearch = useCallback((query: string) => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const matches = searchAirports(query)

    // Sort by relevance: exact code match first, then by name
    matches.sort((a: Airport, b: Airport) => {
      const q = query.toUpperCase()
      if (a.iata === q) return -1
      if (b.iata === q) return 1
      if (a.iata.startsWith(q) && !b.iata.startsWith(q)) return -1
      if (!a.iata.startsWith(q) && b.iata.startsWith(q)) return 1
      return a.name.localeCompare(b.name)
    })

    setResults(matches.slice(0, 10))
    setSelectedIndex(-1)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase()
    setInputValue(newValue)
    handleSearch(newValue)
    setIsOpen(true)
  }

  const handleSelect = (airport: Airport) => {
    setInputValue(airport.iata)
    onChange(airport.iata, airport)
    setIsOpen(false)
    setResults([])
  }

  const handleBlur = () => {
    // Delay close to allow click on dropdown
    setTimeout(() => {
      setIsOpen(false)
      // Validate on blur
      if (inputValue.length === 3) {
        const airport = findAirport(inputValue)
        if (airport) {
          onChange(airport.iata, airport)
        } else {
          // Allow unknown airport codes
          onChange(inputValue)
        }
      } else if (inputValue.length > 0) {
        // Clear invalid input
        setInputValue(value)
      }
    }, 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  const selectedAirport = value ? findAirport(value) : null

  return (
    <div className="relative">
      {label && (
        <Label htmlFor={id} className="mb-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => inputValue.length >= 2 && setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t('flights.airportPlaceholder', 'Search by code or city...')}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className={`font-mono text-sm uppercase ${error ? 'border-destructive' : ''}`}
      />

      {/* Selected airport display */}
      {selectedAirport && inputValue === value && (
        <div className="mt-1 text-xs text-muted-foreground">
          {selectedAirport.name}, {selectedAirport.city}
        </div>
      )}

      {/* Unknown airport warning */}
      {value && value.length === 3 && !selectedAirport && inputValue === value && (
        <p className="mt-1 flex items-center gap-1 text-xs text-warning">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {t('flights.unknownAirport', 'Unknown airport — distance and stats may be incomplete')}
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {results.map((airport, index) => (
            <li
              key={airport.iata}
              onClick={() => handleSelect(airport)}
              className={`px-3 py-2 cursor-pointer ${index === selectedIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium">{airport.iata}</span>
                <span className="text-xs opacity-75">{airport.countryCode}</span>
              </div>
              <div className="text-sm opacity-75 truncate">
                {airport.name}
              </div>
              <div className="text-xs opacity-60">
                {airport.city}, {airport.country}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
