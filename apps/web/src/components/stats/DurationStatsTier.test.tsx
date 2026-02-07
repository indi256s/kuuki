import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DurationStatsTier } from './DurationStatsTier'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdvancedStats, DeparturePatterns } from '@/hooks/useAdvancedStats'

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, optionsOrFallback?: string | Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'stats.timeGeek.hero': '{{count}} flights, averaging {{avg}}',
        'stats.timeGeek.totalTime': 'Total Flight Time',
        'stats.timeGeek.longestFlight': 'Longest Flight',
        'stats.timeGeek.shortestFlight': 'Shortest Flight',
        'stats.timeGeek.departurePattern': 'Departure Pattern',
        'stats.timeGeek.pattern.redEye': 'Night Owl',
        'stats.timeGeek.pattern.early': 'Early Bird',
        'stats.timeGeek.pattern.business': 'Business Hours',
        'stats.timeGeek.pattern.evening': 'Evening Traveler',
        'stats.locked.signature': 'Your Flight Stats AI',
        'stats.timeGeek.fact.1': '{{days}} days airborne.',
        'stats.timeGeek.fact.2': '{{percent}}% {{bucket}} departures.',
        'stats.timeGeek.fact.3': '{{total}} total, {{avg}} average.',
        'stats.timeGeek.fact.4': 'Your longest flight: {{duration}}.',
        'stats.timeGeek.fact.5': 'You have spent 100% of your recorded flights sitting.',
      }

      let template = translations[key] || key

      // Handle interpolation from options object
      if (typeof optionsOrFallback === 'object') {
        for (const [k, v] of Object.entries(optionsOrFallback)) {
          if (k !== 'defaultValue') {
            template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
          }
        }
      }

      return template
    },
  }),
}))

// Mock data
const mockDurationStats = {
  total_minutes: 20167, // ~14 days
  avg_minutes: 202, // ~3h 22m
  longest_minutes: 692, // ~11h 32m
  longest_flight_id: 123,
  shortest_minutes: 45,
  shortest_flight_id: 456,
  flight_count: 127,
}

const mockDeparturePatterns: DeparturePatterns = {
  red_eye: 5,
  early: 10,
  business: 62,
  evening: 23,
  total_with_time: 100,
}

const mockAdvancedStats: AdvancedStats = {
  userId: 'user-123',
  aviaGeekUnlocked: true,
  countryGeekUnlocked: true,
  durationUnlocked: true,
  manufacturerBreakdown: null,
  aircraftBreakdown: null,
  aircraftTypeBreakdown: null,
  continentBreakdown: null,
  regionBreakdown: null,
  durationStats: mockDurationStats,
  departurePatterns: mockDeparturePatterns,
  durationCoverage: 95,
  cardInsights: null,
  durationYearComparison: null,
  patterns: null,
  featuredFact: null,
  featuredFactIndex: 0,
  updatedAt: '2024-01-15T10:00:00Z',
}

// Mock useAdvancedStats hook
const mockUseAdvancedStats = vi.fn()
vi.mock('@/hooks/useAdvancedStats', () => ({
  useAdvancedStats: () => mockUseAdvancedStats(),
}))

// Mock FlightPopover to avoid Supabase calls
vi.mock('./FlightPopover', () => ({
  FlightPopover: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="flight-popover">{children}</span>
  ),
}))

// Helper to render with providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('DurationStatsTier', () => {
  beforeEach(() => {
    mockUseAdvancedStats.mockReset()
  })

  it('renders loading skeleton when data is not available', () => {
    mockUseAdvancedStats.mockReturnValue({ data: null })

    renderWithProviders(<DurationStatsTier />)

    // Should show skeleton (animate-pulse elements)
    const container = document.querySelector('.animate-pulse')
    expect(container).toBeInTheDocument()
  })

  it('renders hero stat section', () => {
    mockUseAdvancedStats.mockReturnValue({ data: mockAdvancedStats })

    renderWithProviders(<DurationStatsTier />)

    // Hero section should have the Clock icon and contain flight info
    // The actual text depends on i18n interpolation, but we can verify the structure
    const heroSection = document.querySelector('.bg-chart-4\\/5')
    expect(heroSection).toBeInTheDocument()

    // Should have the clock icon
    const clockIcon = heroSection?.querySelector('svg')
    expect(clockIcon).toBeInTheDocument()
  })

  it('renders total flight time', () => {
    mockUseAdvancedStats.mockReturnValue({ data: mockAdvancedStats })

    renderWithProviders(<DurationStatsTier />)

    expect(screen.getByText('Total Flight Time')).toBeInTheDocument()
    // 20167 minutes = 14d 0h 7m -> should display "14d"
    expect(screen.getByText('14d')).toBeInTheDocument()
  })

  it('renders longest and shortest flight sections', () => {
    mockUseAdvancedStats.mockReturnValue({ data: mockAdvancedStats })

    renderWithProviders(<DurationStatsTier />)

    expect(screen.getByText('Longest Flight')).toBeInTheDocument()
    expect(screen.getByText('Shortest Flight')).toBeInTheDocument()

    // Longest: 692 minutes = 11h 32m
    expect(screen.getByText('11h 32m')).toBeInTheDocument()

    // Shortest: 45 minutes
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('renders departure pattern with dominant pattern highlighted', () => {
    mockUseAdvancedStats.mockReturnValue({ data: mockAdvancedStats })

    renderWithProviders(<DurationStatsTier />)

    expect(screen.getByText('Departure Pattern')).toBeInTheDocument()
    // Business hours should be dominant (62 out of 100)
    expect(screen.getByText('Business Hours')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('renders GLaDOS fact with AI signature', () => {
    mockUseAdvancedStats.mockReturnValue({ data: mockAdvancedStats })

    renderWithProviders(<DurationStatsTier />)

    // Should show the AI signature
    expect(screen.getByText(/Your Flight Stats AI/)).toBeInTheDocument()
  })

  it('renders FlightPopover for longest and shortest flights', () => {
    mockUseAdvancedStats.mockReturnValue({ data: mockAdvancedStats })

    renderWithProviders(<DurationStatsTier />)

    // Should have 2 FlightPopovers (longest and shortest)
    const popovers = screen.getAllByTestId('flight-popover')
    expect(popovers).toHaveLength(2)
  })

  it('handles missing duration stats gracefully', () => {
    const statsWithoutDuration = {
      ...mockAdvancedStats,
      durationStats: null,
    }
    mockUseAdvancedStats.mockReturnValue({ data: statsWithoutDuration })

    renderWithProviders(<DurationStatsTier />)

    // Should still render without crashing
    expect(screen.getByText('Total Flight Time')).toBeInTheDocument()
    // Should show "—" for missing values
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('handles missing departure patterns gracefully', () => {
    const statsWithoutPatterns = {
      ...mockAdvancedStats,
      departurePatterns: null,
    }
    mockUseAdvancedStats.mockReturnValue({ data: statsWithoutPatterns })

    renderWithProviders(<DurationStatsTier />)

    // Should still render the tier
    expect(screen.getByText('Total Flight Time')).toBeInTheDocument()
    // Departure pattern section should not be visible
    expect(screen.queryByText('Departure Pattern')).not.toBeInTheDocument()
  })

  it('handles zero flight count', () => {
    const statsWithZeroFlights = {
      ...mockAdvancedStats,
      durationStats: {
        ...mockDurationStats,
        flight_count: 0,
        total_minutes: 0,
        avg_minutes: 0,
      },
    }
    mockUseAdvancedStats.mockReturnValue({ data: statsWithZeroFlights })

    renderWithProviders(<DurationStatsTier />)

    // Hero section should still render
    const heroSection = document.querySelector('.bg-chart-4\\/5')
    expect(heroSection).toBeInTheDocument()

    // Total time should show "0m"
    expect(screen.getByText('0m')).toBeInTheDocument()
  })

  it('displays correct pattern icons for different dominant patterns', () => {
    // Test with red_eye dominant
    const redEyePatterns: DeparturePatterns = {
      red_eye: 50,
      early: 10,
      business: 20,
      evening: 20,
      total_with_time: 100,
    }
    const statsWithRedEye = {
      ...mockAdvancedStats,
      departurePatterns: redEyePatterns,
    }
    mockUseAdvancedStats.mockReturnValue({ data: statsWithRedEye })

    renderWithProviders(<DurationStatsTier />)

    expect(screen.getByText('Night Owl')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})
