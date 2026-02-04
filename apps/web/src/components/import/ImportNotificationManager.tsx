import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useImportStore } from '@/stores/importStore'
import { useEnrichmentPolling, type ExtractedFlight } from '@/hooks/useImport'
import { useToast } from '@/hooks/useToast'

/**
 * Background component that monitors active import jobs and shows
 * toast notifications when enrichment completes.
 *
 * Add this to App.tsx to enable background import notifications.
 */
export function ImportNotificationManager() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showSuccess } = useToast()
  const { getActiveJobs, removeBackgroundJob, clearExpiredJobs } = useImportStore()

  // Clear expired jobs on mount
  useEffect(() => {
    clearExpiredJobs()
  }, [clearExpiredJobs])

  // Get active jobs
  const activeJobs = getActiveJobs()
  const firstJob = activeJobs[0]

  // Handle enrichment complete
  const handleEnrichmentComplete = useCallback(
    (flights: ExtractedFlight[]) => {
      if (!firstJob) return

      // Show toast with action to navigate to review
      showSuccess(
        t('import.background.ready', '{{count}} flights ready to review', {
          count: flights.length,
        }),
        {
          action: {
            label: t('import.background.review', 'Review'),
            onClick: () => {
              // Navigate to import page with enriched flights
              navigate('/import', {
                state: {
                  enrichedFlights: flights,
                  fromBackground: true,
                  jobId: firstJob.jobId,
                },
              })
            },
          },
          duration: 10000, // Keep visible longer for background notifications
        }
      )

      // Remove the completed job
      removeBackgroundJob(firstJob.jobId)
    },
    [firstJob, navigate, removeBackgroundJob, showSuccess, t]
  )

  // Handle enrichment error
  const handleEnrichmentError = useCallback(
    (error: string) => {
      if (!firstJob) return

      console.warn('Background enrichment failed:', error)

      // Show toast with option to review basic flights
      showSuccess(
        t('import.background.ready', '{{count}} flights ready to review', {
          count: firstJob.basicFlights.length,
        }),
        {
          action: {
            label: t('import.background.review', 'Review'),
            onClick: () => {
              // Navigate with basic flights (enrichment failed)
              navigate('/import', {
                state: {
                  basicFlights: firstJob.basicFlights,
                  fromBackground: true,
                  enrichmentFailed: true,
                  jobId: firstJob.jobId,
                },
              })
            },
          },
          duration: 10000,
        }
      )

      removeBackgroundJob(firstJob.jobId)
    },
    [firstJob, navigate, removeBackgroundJob, showSuccess, t]
  )

  // Poll the first active job (process one at a time)
  useEnrichmentPolling(
    firstJob?.jobId,
    handleEnrichmentComplete,
    handleEnrichmentError,
    !!firstJob // Only poll if there's an active job
  )

  // This component doesn't render anything
  return null
}
