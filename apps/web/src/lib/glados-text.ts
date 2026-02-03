/**
 * GLaDOS Personality Text
 * Contextual humor for empty states, errors, and achievements
 */

export const gladosText = {
    // Empty states
    emptyStates: {
        noFlights: 'No flights detected. This is fine. Everything is fine.',
        noUpcomingFlights: 'No upcoming flights detected. This is fine. Everything is fine.',
        noBadges: 'No badges earned. Yet.',
        noFavorites: 'No clear favorites yet. Fly more to establish patterns.',
        insufficientLeaderboardData: 'Insufficient data. Please add more flights.',
    },

    // Error messages
    errors: {
        failedToLoadStats: 'Flight data corrupted. Please don\'t panic.',
        failedToSave: 'Unable to save changes. This was not your fault.',
        networkError: 'Connection lost. The internet is a series of tubes. One of them is broken.',
    },

    // Achievement unlocks
    achievements: {
        tierUnlocked: 'Congratulations. You have unlocked... statistics.',
        badgeEarned: 'Achievement unlocked. You should feel proud. Or something.',
        milestoneReached: 'Milestone achieved. This is a triumph.',
    },

    // Contextual humor
    contextual: {
        firstFlight: 'Your first flight. How exciting. Really.',
        hundredthFlight: 'One hundred flights. That\'s... a lot of flights.',
        allContinents: 'You\'ve been everywhere. Literally everywhere. Well done.',
    },
} as const

export type GladosTextKey = keyof typeof gladosText
export type GladosTextSubKey<K extends GladosTextKey> = keyof typeof gladosText[K]
