import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DashboardState {
    // Year filter state
    selectedYear: number | 'all'
    setSelectedYear: (year: number | 'all') => void

    // Available years (dynamically populated from flight data)
    availableYears: number[]
    setAvailableYears: (years: number[]) => void
}

export const useDashboardStore = create<DashboardState>()(
    persist(
        (set) => ({
            selectedYear: 'all',
            setSelectedYear: (year) => set({ selectedYear: year }),

            availableYears: [],
            setAvailableYears: (years) => set({ availableYears: years }),
        }),
        {
            name: 'kuuki-dashboard-storage',
            partialize: (state) => ({
                selectedYear: state.selectedYear,
            }),
        }
    )
)
