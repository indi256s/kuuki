import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserBadges } from '@/hooks/useBadges'
import { useAuthStore } from '@/stores/authStore'
import { BadgeNotificationToast } from './BadgeNotificationToast'

const SEEN_BADGES_KEY = 'kuuki-seen-badges'
const FOUNDING_CREW_SHOWN_KEY = 'kuuki-founding-crew-toast-shown'

interface BadgeToShow {
    code: string
    name: string
}

/**
 * Manages badge notification toasts.
 * - Detects newly earned badges by comparing to localStorage
 * - Shows celebratory toast for each unseen badge
 * - Special handling for Founding Crew badge (one-time retroactive toast)
 */
export function BadgeNotificationManager() {
    const { t } = useTranslation()
    const { data: badges, isLoading } = useUserBadges()
    const user = useAuthStore((state) => state.user)
    const [badgeToShow, setBadgeToShow] = useState<BadgeToShow | null>(null)
    const [queue, setQueue] = useState<BadgeToShow[]>([])

    // Process badges and detect new ones
    useEffect(() => {
        if (isLoading || !badges || !user) return

        const seenBadges = JSON.parse(localStorage.getItem(SEEN_BADGES_KEY) || '[]') as string[]
        const foundingCrewShown = localStorage.getItem(FOUNDING_CREW_SHOWN_KEY) === 'true'

        const newBadges: BadgeToShow[] = []

        for (const userBadge of badges) {
            const code = userBadge.badge.code

            // Special case: Founding Crew badge - show once even if already seen
            if (code === 'founding-user' && !foundingCrewShown) {
                newBadges.push({
                    code,
                    name: t('profile.foundingUser', 'Founding Crew'),
                })
                localStorage.setItem(FOUNDING_CREW_SHOWN_KEY, 'true')
                continue
            }

            // Regular badges - show if not seen
            if (!seenBadges.includes(code)) {
                const badgeName = t(`badges.${code}`, userBadge.badge.name) || userBadge.badge.name
                newBadges.push({ code, name: badgeName })
            }
        }

        // Update seen badges in localStorage
        if (newBadges.length > 0) {
            const allSeen = [...seenBadges, ...newBadges.map(b => b.code)]
            localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify([...new Set(allSeen)]))
            setQueue(newBadges)
        }
    }, [badges, isLoading, user, t])

    // Show badges one at a time from queue
    useEffect(() => {
        if (queue.length > 0 && !badgeToShow) {
            setBadgeToShow(queue[0])
            setQueue((prev) => prev.slice(1))
        }
    }, [queue, badgeToShow])

    const handleDismiss = useCallback(() => {
        setBadgeToShow(null)
    }, [])

    return (
        <BadgeNotificationToast
            badgeCode={badgeToShow?.code ?? null}
            badgeName={badgeToShow?.name ?? ''}
            onDismiss={handleDismiss}
        />
    )
}
