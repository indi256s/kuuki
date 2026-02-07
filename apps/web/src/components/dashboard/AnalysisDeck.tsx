import {
  DashboardGrid,
  AircraftTypesCard,
  ManufacturerCard,
  ContinentProgressCard,
  DurationStatsCard,
} from '@/components/dashboard'

export default function AnalysisDeck() {
  return (
    <DashboardGrid>
      <AircraftTypesCard />
      <ManufacturerCard />
      <ContinentProgressCard />
      <DurationStatsCard />
    </DashboardGrid>
  )
}
