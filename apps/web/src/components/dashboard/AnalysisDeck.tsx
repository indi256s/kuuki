import {
  DashboardGrid,
  AircraftTypesCard,
  ManufacturerCard,
  ContinentProgressCard,
  DeparturePatternCard,
  DurationStatsCard,
} from '@/components/dashboard'

export default function AnalysisDeck() {
  return (
    <DashboardGrid>
      <AircraftTypesCard />
      <ManufacturerCard />
      <ContinentProgressCard />
      <DeparturePatternCard />
      <DurationStatsCard />
    </DashboardGrid>
  )
}
