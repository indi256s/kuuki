'use client'

import { EditJourney } from '../edit-journey'
import { JourneyForm } from '../journey-form'
import type { RailOcrSlotApi } from '../rail-editor'
import { RailOcrPanel } from './rail-ocr-panel'

type NewProps = Parameters<typeof JourneyForm>[0]
type EditProps = Parameters<typeof EditJourney>[0]

export function JourneyFormWithOcr(props: Omit<NewProps, 'ocrSlot'>) {
  return (
    <JourneyForm
      {...props}
      ocrSlot={(api: RailOcrSlotApi) => <RailOcrPanel api={api} locale={props.locale} />}
    />
  )
}

export function EditJourneyWithOcr(props: Omit<EditProps, 'ocrSlot'>) {
  return (
    <EditJourney
      {...props}
      ocrSlot={(api: RailOcrSlotApi) => <RailOcrPanel api={api} locale={props.locale} />}
    />
  )
}
