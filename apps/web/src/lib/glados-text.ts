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

    // Processing/loading states
    processing: {
        cleaning: [
            'Cleaning and structuring your text...',
            'Processing. Please stand by. Or sit.',
            'Tidying up your data. It needed it.',
        ],
        extracting: [
            'AI is identifying flights, dates, routes...',
            'Analyzing your upload. Science is happening.',
            'Pretending this is more complex than it actually is.',
        ],
        validating: [
            'Checking airport codes and airline data...',
            'Cross-referencing with reality. One moment.',
            'Making sure these airports actually exist. Most do.',
        ],
        reading: [
            'Reading file...',
            'Decoding your document. Interesting format choice.',
            'Reading. Comprehending. Judging slightly.',
        ],
        finding: [
            'Finding flights...',
            'Searching for flights. They can\'t hide forever.',
            'Locating your flights among the noise.',
        ],
        generic: [
            'Loading...',
            'One moment. Calibrating.',
            'Processing. This is the part where you wait.',
        ],
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
export type ProcessingStage = keyof typeof gladosText.processing

export function getProcessingMessage(stage: ProcessingStage): string {
    const variants = gladosText.processing[stage]
    return variants[Math.floor(Math.random() * variants.length)]
}
