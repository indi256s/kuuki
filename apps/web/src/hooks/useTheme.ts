/**
 * Theme hook — dark mode only.
 * The 'dark' class is set in index.html.
 * This hook exists for compatibility if any code still imports it.
 */
export function useTheme() {
    return {
        theme: 'dark' as const,
        resolvedTheme: 'dark' as const,
    }
}
