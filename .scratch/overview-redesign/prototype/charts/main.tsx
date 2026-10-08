import { createRoot } from 'react-dom/client'
import { RecordsScatter, RecordsProgress, CrossingsShift, CrossingsJetlag, FleetWaffle, ClockRadial, RhythmOdometer, RankingsBump } from './charts'

createRoot(document.getElementById('root')!).render(
  <div className="stack">
    <RecordsScatter mobile={false} />
    <CrossingsJetlag mobile={false} />
    <FleetWaffle mobile={false} />
    <ClockRadial mobile={false} />
    <RhythmOdometer mobile={false} />
    <RankingsBump mobile={false} />
    <RecordsScatter mobile />
    <CrossingsJetlag mobile />
    <FleetWaffle mobile />
    <ClockRadial mobile />
    <RhythmOdometer mobile />
    <RankingsBump mobile />
    <RecordsScatter mobile={false} size="bento" />
    <RecordsProgress />
    <CrossingsShift />
    <CrossingsJetlag mobile={false} size="bento" />
    <FleetWaffle mobile={false} size="bento" />
    <ClockRadial mobile={false} size="bento" />
    <RhythmOdometer mobile={false} size="bento" />
    <RankingsBump mobile={false} size="bento" />
  </div>,
)
