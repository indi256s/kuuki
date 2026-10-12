'use client'

import { Button } from '../ui/button'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../ui/popover'
import type { Locale } from '../../lib/format'
import './founding-crew.css'

export function PaperWing() {
  return (
    <svg className="founding-crew-wing" viewBox="0 0 216 160" aria-hidden="true" focusable="false">
      <path className="founding-crew-wing-keel" d="m78 90 118-52-104 87Z" />
      <path className="founding-crew-wing-keel-edge" d="m92 125 104-87-90 68Z" />
      <g className="founding-crew-wing-back">
        <path className="founding-crew-wing-paper" d="m23 46 173-8-118 52Z" />
        <path className="founding-crew-wing-underfold" d="m23 46 17 5 156-13Z" />
        <path className="founding-crew-wing-edge" d="m23 46 55 44v2L23 48Z" />
        <path className="founding-crew-wing-crease" d="m40 51 156-13" />
      </g>
      <path className="founding-crew-wing-front" d="m106 106 90-68-35 88Z" />
      <path className="founding-crew-wing-underfold" d="m153 110 43-72-35 88Z" />
      <path className="founding-crew-wing-edge" d="m106 106 55 20v2l-55-20Z" />
      <path className="founding-crew-wing-fold" d="m92 125 104-87-90 68" />
      <path className="founding-crew-wing-crease" d="m153 110 43-72" />
    </svg>
  )
}

// Plane punch from the FC-9 paper stub (.scratch/founding-crew/fragments/paper_stub.py).
function PlanePunch() {
  return (
    <span className="founding-crew-punch" aria-hidden="true">
      <svg viewBox="0 0 12 12" focusable="false">
        <path d="M6 .9C6.5.9 6.75 1.5 6.75 2.2V4.6L10.8 6.9V8.1L6.75 7V9.1L8.1 10.1V10.9L6 10.4L3.9 10.9V10.1L5.25 9.1V7L1.2 8.1V6.9L5.25 4.6V2.2C5.25 1.5 5.5.9 6 .9Z" />
      </svg>
    </span>
  )
}

/** The torn-off stub for the Achievements row: perforation along the right edge, no text. */
export function FoundingStub() {
  return (
    <span className="founding-crew-stub founding-crew-stub-torn" aria-hidden="true">
      <PlanePunch />
    </span>
  )
}

export function FoundingCrew({ locale }: { locale: Locale }) {
  const ru = locale === 'ru'
  // The badge name stays English in both locales.
  const name = 'Founding crew'
  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <Button variant="ghost" dense className="founding-crew-trigger founding-crew-stub">
          <PlanePunch />
          {name}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="founding-crew-card" aria-label={name} sideOffset={12}>
        <div className="founding-crew-emblem">
          <PaperWing />
        </div>
        <h2>{name}</h2>
        <p className="founding-crew-dedication">
          {ru ? 'С вами всё началось.' : 'It started with you.'}
        </p>
        <p className="founding-crew-thanks">
          {ru
            ? 'Спасибо, что были с нами с самого начала.'
            : 'Thank you for being here from the start.'}
        </p>
        <div className="founding-crew-signature">
          <span className="founding-crew-wordmark">
            <span>Ku</span>uki
          </span>
          <span>{ru ? 'Альфа-экипаж' : 'Alpha crew'}</span>
        </div>
      </PopoverContent>
    </PopoverRoot>
  )
}
