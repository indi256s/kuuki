import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { useFlightStats } from '@/hooks/useStats'
import { usePassportStats, usePassportClaims } from '@/hooks/usePassport'
import { verifyPassword } from '@/lib/auth'
import { getAllFlights } from '@/lib/flights'
import { exportFlights, exportClaims } from '@/lib/export'
import { useToast } from '@/hooks/useToast'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DialogStep = 'preview' | 'export-prompt' | 'password' | 'deleting' | 'error'

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const { showError, showSuccess } = useToast()

  const { data: stats } = useFlightStats()
  const { data: passportStats } = usePassportStats()
  const { data: claims } = usePassportClaims()

  const [step, setStep] = useState<DialogStep>('preview')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const flightCount = stats?.totalFlights ?? 0
  const countriesCount = passportStats?.countriesCount ?? 0

  const resetDialog = () => {
    setStep('preview')
    setPassword('')
    setError(null)
    setIsExporting(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog()
    }
    onOpenChange(newOpen)
  }

  const handleExportData = async () => {
    if (!user) return

    setIsExporting(true)
    try {
      // Export flights
      if (flightCount > 0) {
        const flights = await getAllFlights(user.id)
        if (flights.length === 0) throw new Error('No flights were returned for export. Please refresh and try again.')
        exportFlights(flights, { enriched: true })
      }

      // Export claims
      if (claims && claims.length > 0) {
        exportClaims(claims)
      }

      // Move to password step after export
      setStep('password')
    } catch (err) {
      showError(err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleSkipExport = () => {
    setStep('password')
  }

  const handleDeleteAccount = async () => {
    if (!user || !password) return

    setError(null)
    setStep('deleting')

    // Verify password first
    const isValid = await verifyPassword(password)
    if (!isValid) {
      setError(t('settings.delete.wrongPassword'))
      setStep('error')
      return
    }

    // Delete the account (password re-verified server-side as part of the delete)
    const result = await deleteAccount(password)
    if (!result.success) {
      setError(result.error ?? t('common.error'))
      setStep('error')
      return
    }

    // Show success message and redirect
    showSuccess(t('settings.delete.success'))
    handleOpenChange(false)
    navigate('/')
  }

  const renderContent = () => {
    switch (step) {
      case 'preview':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t('settings.delete.dialogTitle')}
              </DialogTitle>
              <DialogDescription className="text-base">
                {t('settings.delete.dialogDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Data preview */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  {t('settings.delete.dataPreview', {
                    flights: flightCount,
                    countries: countriesCount,
                  })}
                </p>
              </div>

              {/* Warning */}
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">
                  {t('settings.delete.warning')}
                </p>
              </div>

              {/* GLaDOS farewell */}
              <p className="text-sm italic text-muted-foreground text-center">
                "{t('settings.delete.farewell')}"
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => setStep('export-prompt')}>
                {t('common.next')}
              </Button>
            </DialogFooter>
          </>
        )

      case 'export-prompt':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                {t('settings.delete.exportPrompt')}
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                {t('settings.delete.dataPreview', {
                  flights: flightCount,
                  countries: countriesCount,
                })}
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleSkipExport}
                disabled={isExporting}
              >
                {t('settings.delete.skipExport')}
              </Button>
              <Button
                onClick={handleExportData}
                disabled={isExporting || (flightCount === 0 && (!claims || claims.length === 0))}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('settings.export.exporting')}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {t('settings.delete.exportButton')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )

      case 'password':
      case 'error':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t('settings.delete.dialogTitle')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="delete-password">
                  {t('settings.delete.passwordLabel')}
                </Label>
                <Input
                  id="delete-password"
                  type="password"
                  placeholder={t('settings.delete.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!password}
              >
                {t('settings.delete.confirm')}
              </Button>
            </DialogFooter>
          </>
        )

      case 'deleting':
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t('settings.delete.deleting')}</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="sm"
        showCloseButton={step !== 'deleting'}
        onPointerDownOutside={(e) => {
          // Prevent closing while deleting
          if (step === 'deleting') {
            e.preventDefault()
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing while deleting
          if (step === 'deleting') {
            e.preventDefault()
          }
        }}
      >
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
