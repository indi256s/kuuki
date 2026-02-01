import { useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'kuuki-theme'

function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored
    }
    return 'system'
}

function applyTheme(theme: ResolvedTheme) {
    const root = document.documentElement
    if (theme === 'dark') {
        root.classList.add('dark')
    } else {
        root.classList.remove('dark')
    }
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(getStoredTheme)
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
        const stored = getStoredTheme()
        return stored === 'system' ? getSystemTheme() : stored
    })

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme)
        localStorage.setItem(STORAGE_KEY, newTheme)
        const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
        setResolvedTheme(resolved)
        applyTheme(resolved)
    }, [])

    // Apply theme on mount and listen for system preference changes
    useEffect(() => {
        const resolved = theme === 'system' ? getSystemTheme() : theme
        setResolvedTheme(resolved)
        applyTheme(resolved)

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            if (theme === 'system') {
                const newResolved = getSystemTheme()
                setResolvedTheme(newResolved)
                applyTheme(newResolved)
            }
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [theme])

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    }
}
