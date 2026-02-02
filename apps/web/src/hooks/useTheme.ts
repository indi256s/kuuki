import { useEffect } from 'react'

/**
 * Simplified theme hook — dark mode only.
 * Light and system themes removed for now.
 */
export function useTheme() {
    // Apply dark mode on mount
    useEffect(() => {
        document.documentElement.classList.add('dark')
    }, [])

    return {
        theme: 'dark' as const,
        resolvedTheme: 'dark' as const,
    }
}
