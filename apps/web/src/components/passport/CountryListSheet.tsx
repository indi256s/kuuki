import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { usePassportCountries } from '@/hooks/usePassport'
import { getAllCountries } from '@/lib/passport'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

// Letter groups for accordion sections
const LETTER_GROUPS = [
  { id: 'A-C', letters: ['A', 'B', 'C'] },
  { id: 'D-F', letters: ['D', 'E', 'F'] },
  { id: 'G-I', letters: ['G', 'H', 'I'] },
  { id: 'J-L', letters: ['J', 'K', 'L'] },
  { id: 'M-O', letters: ['M', 'N', 'O'] },
  { id: 'P-R', letters: ['P', 'Q', 'R'] },
  { id: 'S-U', letters: ['S', 'T', 'U'] },
  { id: 'V-Z', letters: ['V', 'W', 'X', 'Y', 'Z'] },
]

// localStorage key for first-time hint
const HINT_DISMISSED_KEY = 'kuuki:countryClaimHintDismissed'

interface CountryListSheetProps {
  isOpen: boolean
  onClose: () => void
  onSelectCountry: (countryCode: string) => void
}

/**
 * CountryListSheet - Mobile-optimized country selection as a bottom sheet.
 *
 * Features:
 * - Bottom sheet with drag handle (via Sheet component)
 * - Flat alphabetical list with letter accordion (A-C, D-F, etc.)
 * - Search filters to a flat list (no accordion when searching)
 * - First-time hint that auto-dismisses after first claim
 * - Shows visited status with color indicators
 */
export function CountryListSheet({ isOpen, onClose, onSelectCountry }: CountryListSheetProps) {
  const { t } = useTranslation()
  const { data: visitedCountries } = usePassportCountries()
  const [searchQuery, setSearchQuery] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string>('A-C')

  // Check if hint should be shown on mount
  useEffect(() => {
    if (isOpen) {
      const dismissed = localStorage.getItem(HINT_DISMISSED_KEY)
      setShowHint(dismissed !== 'true')
    }
  }, [isOpen])

  // Reset search when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setExpandedGroup('A-C')
    }
  }, [isOpen])

  const countries = getAllCountries()

  // Build sorted country list
  const countryList = useMemo(() =>
    Object.entries(countries)
      .map(([code, data]) => ({
        code,
        name: data.name,
        nativeName: data.nativeName,
        dominantColor: data.dominantColor,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
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

  // Group countries by first letter for accordion
  const groupedCountries = useMemo(() => {
    const groups: Record<string, typeof countryList> = {}

    for (const group of LETTER_GROUPS) {
      groups[group.id] = countryList.filter((c) =>
        group.letters.includes(c.name[0].toUpperCase())
      )
    }

    return groups
  }, [countryList])

  // Set of visited country codes
  const visitedCountryCodes = useMemo(
    () => new Set(visitedCountries?.map((c) => c.countryCode) ?? []),
    [visitedCountries]
  )

  // Get source info for a country
  const getCountrySource = useCallback((code: string) => {
    const entry = visitedCountries?.find((c) => c.countryCode === code)
    return entry?.source
  }, [visitedCountries])

  const handleCountrySelect = useCallback((countryCode: string) => {
    // Dismiss hint after first selection
    if (showHint) {
      localStorage.setItem(HINT_DISMISSED_KEY, 'true')
      setShowHint(false)
    }
    onSelectCountry(countryCode)
  }, [showHint, onSelectCountry])

  const dismissHint = useCallback(() => {
    localStorage.setItem(HINT_DISMISSED_KEY, 'true')
    setShowHint(false)
  }, [])

  const isSearching = searchQuery.trim().length > 0

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] flex flex-col"
        showCloseButton={false}
      >
        <SheetHeader className="px-4 pt-2 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            {t('passport.selectCountry', 'Select a Country')}
          </SheetTitle>
        </SheetHeader>

        {/* Search input */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('passport.searchCountry', 'Search country...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* First-time hint */}
        {showHint && !isSearching && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('passport.claimHint', 'Tap a country to claim it')}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={dismissHint}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Country list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isSearching ? (
            // Flat search results
            <div className="space-y-1">
              {filteredCountries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('common.noResults', 'No results found')}
                </p>
              ) : (
                filteredCountries.map((country) => (
                  <CountryItem
                    key={country.code}
                    country={country}
                    isVisited={visitedCountryCodes.has(country.code)}
                    source={getCountrySource(country.code)}
                    onSelect={handleCountrySelect}
                  />
                ))
              )}
            </div>
          ) : (
            // Letter accordion
            <Accordion
              type="single"
              collapsible
              value={expandedGroup}
              onValueChange={(value) => setExpandedGroup(value || '')}
              className="space-y-1"
            >
              {LETTER_GROUPS.map((group) => {
                const groupCountries = groupedCountries[group.id]
                const visitedCount = groupCountries.filter((c) =>
                  visitedCountryCodes.has(c.code)
                ).length

                return (
                  <AccordionItem
                    key={group.id}
                    value={group.id}
                    className="border border-border/50 rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-base">{group.id}</span>
                        <span className="text-sm text-muted-foreground">
                          {visitedCount > 0 && (
                            <span className="text-primary">{visitedCount}/</span>
                          )}
                          {groupCountries.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="border-t border-border/50">
                        {groupCountries.map((country) => (
                          <CountryItem
                            key={country.code}
                            country={country}
                            isVisited={visitedCountryCodes.has(country.code)}
                            source={getCountrySource(country.code)}
                            onSelect={handleCountrySelect}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-background">
          <p className="text-sm text-muted-foreground">
            {t('passport.visitedCountries', '{{count}} countries visited', {
              count: visitedCountryCodes.size,
            })}
          </p>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface CountryItemProps {
  country: {
    code: string
    name: string
    dominantColor: string
  }
  isVisited: boolean
  source?: 'flight' | 'claim' | 'both'
  onSelect: (code: string) => void
}

function CountryItem({ country, isVisited, source, onSelect }: CountryItemProps) {
  const isFromFlight = source === 'flight' || source === 'both'
  const isClaimed = source === 'claim' || source === 'both'

  return (
    <button
      onClick={() => onSelect(country.code)}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3',
        'hover:bg-secondary/50 transition-colors',
        'focus-visible:outline-none focus-visible:bg-secondary/50',
        'border-b border-border/30 last:border-b-0'
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className="w-4 h-4 rounded-full border flex-shrink-0"
          style={{
            backgroundColor: isVisited ? country.dominantColor : 'transparent',
            borderColor: country.dominantColor,
          }}
        />
        <span className={cn(
          'text-sm',
          isVisited ? 'font-medium text-foreground' : 'text-foreground/80'
        )}>
          {country.name}
        </span>
        <span className="text-xs text-muted-foreground">
          ({country.code})
        </span>
      </span>

      <span className="flex items-center gap-1">
        {isFromFlight && (
          <Badge variant="outline" className="text-xs h-5 px-1.5">
            ✈️
          </Badge>
        )}
        {isClaimed && (
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            ✓
          </Badge>
        )}
      </span>
    </button>
  )
}
