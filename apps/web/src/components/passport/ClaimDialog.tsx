import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Car, Ship, Loader2 } from 'lucide-react'
import { useClaimCountry, useAddGroundVisit } from '@/hooks/usePassport'
import { getCountryByCode } from '@/lib/passport'
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
import type { EntryMethod } from '@kuuki/shared'

interface ClaimDialogProps {
  isOpen: boolean
  onClose: () => void
  preselectedCountry?: string | null
  isAlreadyClaimed?: boolean
}

export function ClaimDialog({ isOpen, onClose, preselectedCountry, isAlreadyClaimed = false }: ClaimDialogProps) {
  const { t } = useTranslation()
  const claimCountry = useClaimCountry()
  const addGroundVisit = useAddGroundVisit()

  const [visitYear, setVisitYear] = useState<string>('')
  const [note, setNote] = useState('')
  const [entryMethod, setEntryMethod] = useState<EntryMethod>(null)

  // Sync state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setVisitYear('')
      setNote('')
      setEntryMethod(null)
    }
  }, [isOpen, preselectedCountry])

  const countryData = preselectedCountry ? getCountryByCode(preselectedCountry) : null
  const mutation = isAlreadyClaimed ? addGroundVisit : claimCountry

  const handleSubmit = useCallback(async () => {
    if (!preselectedCountry) return

    try {
      await mutation.mutateAsync({
        countryCode: preselectedCountry,
        visitYear: visitYear && visitYear !== 'unknown' ? parseInt(visitYear, 10) : null,
        note: note.trim() || null,
        entryMethod,
      })

      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
    }
  }, [preselectedCountry, visitYear, note, entryMethod, mutation, onClose])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Generate year options (current year back to 1950)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {isAlreadyClaimed
              ? t('passport.addVisit', 'Add Visit')
              : t('passport.claimCountry', 'Claim a Country')
            }
          </DialogTitle>
          <DialogDescription>
            {isAlreadyClaimed
              ? t('passport.addVisitDescription', 'Add another visit to this country.')
              : t('passport.claimDescription', 'Add a country you\'ve visited by land or sea.')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Country header (non-editable) */}
          {countryData && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: countryData.dominantColor }}
              />
              <div>
                <p className="font-medium">{countryData.name}</p>
                <p className="text-xs text-muted-foreground">{countryData.nativeName}</p>
              </div>
            </div>
          )}

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
            disabled={!preselectedCountry || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('common.saving', 'Saving...')}
              </>
            ) : isAlreadyClaimed ? (
              t('passport.addVisitButton', 'Add Visit')
            ) : (
              t('passport.addStamp', 'Add Stamp')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
