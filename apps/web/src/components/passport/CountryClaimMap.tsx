import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Info, X } from 'lucide-react'
import { usePassportCountries } from '@/hooks/usePassport'
import { getAllCountries } from '@/lib/passport'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

interface CountryClaimMapProps {
  isOpen: boolean
  onClose: () => void
  onSelectCountry: (countryCode: string) => void
  showInstructions?: boolean
}

export function CountryClaimMap({ isOpen, onClose, onSelectCountry, showInstructions = true }: CountryClaimMapProps) {
  const { t } = useTranslation()
  const { data: visitedCountries } = usePassportCountries()
  const [searchQuery, setSearchQuery] = useState('')
  const [showFirstTimeMessage, setShowFirstTimeMessage] = useState(showInstructions)

  const countries = getAllCountries()
  const countryList = useMemo(() =>
    Object.entries(countries).map(([code, data]) => ({
      code,
      name: data.name,
      nativeName: data.nativeName,
      continent: data.continent,
      dominantColor: data.dominantColor,
    })).sort((a, b) => a.name.localeCompare(b.name)),
    [countries]
  )

  // Filter countries by search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countryList
    const query = searchQuery.toLowerCase()
    return countryList.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        c.nativeName.toLowerCase().includes(query)
    )
  }, [countryList, searchQuery])

  // Set of visited country codes for quick lookup
  const visitedCountryCodes = useMemo(
    () => new Set(visitedCountries?.map((c) => c.countryCode) ?? []),
    [visitedCountries]
  )

  const handleCountrySelect = useCallback((countryCode: string) => {
    // Check if already visited (via flights)
    const country = visitedCountries?.find((c) => c.countryCode === countryCode)
    if (country?.source === 'flight' || country?.source === 'both') {
      // Already have this from flights, can still add a claim if not already claimed
      // For now, just select it
    }
    onSelectCountry(countryCode)
  }, [visitedCountries, onSelectCountry])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            {t('passport.selectCountry', 'Select a Country')}
          </DialogTitle>
        </DialogHeader>

        {/* First-time instructions */}
        {showFirstTimeMessage && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4 relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => setShowFirstTimeMessage(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {t('passport.mapInstructions', 'Check in countries you\'ve visited')}
                </p>
                <p className="text-muted-foreground mt-1">
                  {t('passport.mapInstructionsDetail', 'Search below or browse the list to add countries you\'ve reached by land or sea. Countries from your flights are already tracked automatically.')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search and country list */}
        <div className="flex-1 overflow-hidden">
          <Command className="border rounded-lg">
            <CommandInput
              placeholder={t('passport.searchCountry', 'Search country...')}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>{t('common.noResults', 'No results found')}</CommandEmpty>

              {/* Group by continent */}
              {['europe', 'asia', 'americas', 'africa', 'oceania'].map((continent) => {
                const continentCountries = filteredCountries.filter(
                  (c) => c.continent === continent
                )
                if (continentCountries.length === 0) return null

                const continentNames: Record<string, string> = {
                  europe: 'Europe',
                  asia: 'Asia',
                  americas: 'Americas',
                  africa: 'Africa',
                  oceania: 'Oceania',
                }

                return (
                  <CommandGroup key={continent} heading={continentNames[continent]}>
                    {continentCountries.map((country) => {
                      const isVisited = visitedCountryCodes.has(country.code)
                      const visitedEntry = visitedCountries?.find(
                        (c) => c.countryCode === country.code
                      )
                      const isFromFlight = visitedEntry?.source === 'flight' || visitedEntry?.source === 'both'
                      const isClaimed = visitedEntry?.source === 'claim' || visitedEntry?.source === 'both'

                      return (
                        <CommandItem
                          key={country.code}
                          value={country.name}
                          onSelect={() => handleCountrySelect(country.code)}
                          className={cn(
                            'flex items-center justify-between cursor-pointer',
                            isVisited && 'bg-primary/5'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full border"
                              style={{
                                backgroundColor: isVisited
                                  ? country.dominantColor
                                  : 'transparent',
                                borderColor: country.dominantColor,
                              }}
                            />
                            <span>{country.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({country.code})
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            {isFromFlight && (
                              <Badge variant="outline" className="text-xs">
                                ✈️
                              </Badge>
                            )}
                            {isClaimed && (
                              <Badge variant="secondary" className="text-xs">
                                ✓
                              </Badge>
                            )}
                          </span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {t('passport.visitedCountries', '{{count}} countries visited', {
              count: visitedCountryCodes.size,
            })}
          </p>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Simplified map view component (can be enhanced with SVG map later)
export function CountryClaimMapSimple({
  onSelectCountry,
}: {
  onSelectCountry: (countryCode: string) => void
}) {
  const { data: visitedCountries } = usePassportCountries()
  const countries = getAllCountries()

  const visitedCountryCodes = useMemo(
    () => new Set(visitedCountries?.map((c) => c.countryCode) ?? []),
    [visitedCountries]
  )

  // Simple grid of country badges
  return (
    <div className="space-y-6">
      {['europe', 'asia', 'americas', 'africa', 'oceania'].map((continent) => {
        const continentCountries = Object.entries(countries)
          .filter(([_, data]) => data.continent === continent)
          .sort(([, a], [, b]) => a.name.localeCompare(b.name))

        const continentNames: Record<string, string> = {
          europe: 'Europe',
          asia: 'Asia',
          americas: 'Americas',
          africa: 'Africa',
          oceania: 'Oceania',
        }

        return (
          <div key={continent}>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {continentNames[continent]}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {continentCountries.map(([code, data]) => {
                const isVisited = visitedCountryCodes.has(code)
                return (
                  <button
                    key={code}
                    onClick={() => onSelectCountry(code)}
                    className={cn(
                      'px-2 py-1 text-xs rounded-full border transition-all',
                      isVisited
                        ? 'text-white border-transparent'
                        : 'text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    )}
                    style={
                      isVisited
                        ? { backgroundColor: data.dominantColor }
                        : undefined
                    }
                    title={data.name}
                  >
                    {code}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
