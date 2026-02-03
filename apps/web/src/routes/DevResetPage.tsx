import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '@/components/common/AppHeader'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'

const CONFIRMATION_TEXT = 'DELETE'

export function DevResetPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletedCount, setDeletedCount] = useState<number | null>(null)

  const isConfirmed = confirmText === CONFIRMATION_TEXT

  const handleReset = useCallback(async () => {
    if (!isConfirmed || !user?.id) return

    setIsDeleting(true)
    setError(null)

    try {
      // Delete all flights for the current user
      const { data, error: deleteError } = await supabase
        .from('flights')
        .delete()
        .eq('user_id', user.id)
        .select('id')

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      const count = data?.length ?? 0
      setDeletedCount(count)

      // Invalidate all flight-related queries
      await queryClient.invalidateQueries({ queryKey: ['flights'] })
      await queryClient.invalidateQueries({ queryKey: ['recentFlights'] })
      await queryClient.invalidateQueries({ queryKey: ['upcomingFlights'] })
      await queryClient.invalidateQueries({ queryKey: ['flightStats'] })
      await queryClient.invalidateQueries({ queryKey: ['flightYears'] })
      await queryClient.invalidateQueries({ queryKey: ['flightAirlines'] })
      await queryClient.invalidateQueries({ queryKey: ['flightAircraft'] })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err) {
      console.error('Reset failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete flights')
    } finally {
      setIsDeleting(false)
    }
  }, [isConfirmed, user?.id, queryClient, navigate])

  // Show success state
  if (deletedCount !== null) {
    return (
      <div className="min-h-screen bg-gradient-soft">
        <MobileHeader />
        <AppHeader />

        <main className="max-w-md mx-auto px-6 py-16">
          <Card className="border-success/50">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-success/10 rounded-full flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Reset Complete</h2>
              <p className="text-muted-foreground">
                {deletedCount === 0
                  ? 'No flights to delete.'
                  : `Deleted ${deletedCount} flight${deletedCount === 1 ? '' : 's'}.`}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Redirecting to dashboard...
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-soft">
      <MobileHeader />
      <AppHeader />

      <main className="max-w-md mx-auto px-6 py-16">
        <Card className="border-destructive/50">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Dev Reset</CardTitle>
            <CardDescription>
              This will permanently delete all your flights. This action cannot be undone.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is a development tool for testing. All flight data for your account will be erased.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type <code className="bg-muted px-1.5 py-0.5 rounded text-destructive">{CONFIRMATION_TEXT}</code> to confirm:
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className={isConfirmed ? 'border-destructive focus-visible:ring-destructive' : ''}
                disabled={isDeleting}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                disabled={isDeleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={!isConfirmed || isDeleting}
                className="flex-1"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Flights
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
