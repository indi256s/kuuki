import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Car, Ship, Loader2 } from 'lucide-react'
import { useClaimCountry } from '@/hooks/usePassport'
import { getCountryByCode, getAllCountries } from '@/lib/passport'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { EntryMethod } from '@kuuki/shared'

interface ClaimDialogProps {
  isOpen: boolean
  onClose: () => void
  preselectedCountry?: string | null
}

export function ClaimDialog({ isOpen, onClose, preselectedCountry }: ClaimDialogProps) {
  const { t } = useTranslation()
  const claimCountry = useClaimCountry()

  const [selectedCountry, setSelectedCountry] = useState<string | null>(preselectedCountry ?? null)
  const [countrySearchOpen, setCountrySearchOpen] = useState(false)
  const [visitYear, setVisitYear] = useState<string>('')
  const [note, setNote] = useState('')
  const [entryMethod, setEntryMethod] = useState<EntryMethod>(null)

  const countries = getAllCountries()
  const countryList = Object.entries(countries).map(([code, data]) => ({
    code,
    name: data.name,
    nativeName: data.nativeName,
  })).sort((a, b) => a.name.localeCompare(b.name))

  const selectedCountryData = selectedCountry ? getCountryByCode(selectedCountry) : null

  const handleSubmit = useCallback(async () => {
    if (!selectedCountry) return

    try {
      await claimCountry.mutateAsync({
        countryCode: selectedCountry,
        visitYear: visitYear && visitYear !== 'unknown' ? parseInt(visitYear, 10) : null,
        note: note.trim() || null,
        entryMethod,
      })

      // Reset form and close
      setSelectedCountry(null)
      setVisitYear('')
      setNote('')
      setEntryMethod(null)
      onClose()
    } catch (error) {
      console.error('Failed to claim country:', error)
    }
  }, [selectedCountry, visitYear, note, entryMethod, claimCountry, onClose])

  const handleClose = useCallback(() => {
    // Reset form on close
    setSelectedCountry(preselectedCountry ?? null)
    setVisitYear('')
    setNote('')
    setEntryMethod(null)
    onClose()
  }, [onClose, preselectedCountry])

  // Generate year options (current year back to 1950)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {t('passport.claimCountry', 'Claim a Country')}
          </DialogTitle>
          <DialogDescription>
            {t('passport.claimDescription', 'Add a country you\'ve visited by land or sea.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Country selection */}
          <div className="space-y-2">
            <Label>{t('passport.country', 'Country')}</Label>
            <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={countrySearchOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedCountryData ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedCountryData.dominantColor }}
                      />
                      {selectedCountryData.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('passport.selectCountry', 'Select a country...')}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('passport.searchCountry', 'Search country...')} />
                  <CommandList className="max-h-64">
                    <CommandEmpty>{t('common.noResults', 'No results found')}</CommandEmpty>
                    <CommandGroup>
                      {countryList.map((country) => (
                        <CommandItem
                          key={country.code}
                          value={country.name}
                          onSelect={() => {
                            setSelectedCountry(country.code)
                            setCountrySearchOpen(false)
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: countries[country.code].dominantColor }}
                            />
                            {country.name}
                            <span className="text-xs text-muted-foreground">
                              ({country.code})
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Visit year (optional) */}
          <div className="space-y-2">
            <Label>{t('passport.visitYear', 'Year Visited')} <span className="text-muted-foreground text-xs">({t('common.optional', 'optional')})</span></Label>
            <Select value={visitYear} onValueChange={setVisitYear}>
              <SelectTrigger>
                <SelectValue placeholder={t('passport.selectYear', 'Select year...')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">{t('passport.dontRemember', "I don't remember")}</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entry method (optional) */}
          <div className="space-y-2">
            <Label>{t('passport.howDidYouEnter', 'How did you enter?')} <span className="text-muted-foreground text-xs">({t('common.optional', 'optional')})</span></Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={entryMethod === 'land' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setEntryMethod(entryMethod === 'land' ? null : 'land')}
              >
                <Car className="w-4 h-4" />
                {t('passport.land', 'Land')}
              </Button>
              <Button
                type="button"
                variant={entryMethod === 'sea' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setEntryMethod(entryMethod === 'sea' ? null : 'sea')}
              >
                <Ship className="w-4 h-4" />
                {t('passport.sea', 'Sea')}
              </Button>
            </div>
          </div>

          {/* Note (optional) */}
          <div className="space-y-2">
            <Label>{t('passport.note', 'Note')} <span className="text-muted-foreground text-xs">({t('common.optional', 'optional')})</span></Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              placeholder={t('passport.notePlaceholder', 'Any memories from this trip...')}
              className="resize-none h-20"
            />
            <p className="text-xs text-muted-foreground text-right">
              {note.length}/200
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCountry || claimCountry.isPending}
          >
            {claimCountry.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('common.saving', 'Saving...')}
              </>
            ) : (
              t('passport.addStamp', 'Add Stamp')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
