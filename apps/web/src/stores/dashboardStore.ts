import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FlightFilters } from '@/lib/flights'

interface DashboardState {
    // Full flight filters
    filters: FlightFilters
    setFilters: (filters: FlightFilters) => void

    // Available years (dynamically populated from flight data)
    availableYears: number[]
    setAvailableYears: (years: number[]) => void
}

export const useDashboardStore = create<DashboardState>()(
    persist(
        (set) => ({
            filters: {},
            setFilters: (filters) => set({ filters }),

            availableYears: [],
            setAvailableYears: (years) => set({ availableYears: years }),
        }),
        {
            name: 'kuuki-dashboard-storage',
            partialize: (state) => ({
                filters: state.filters,
            }),
        }
    )
)
