import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IsoFigure } from '../apps/next/src/client/overview/iso/iso-figure'
import { spike } from '../apps/next/src/client/overview/iso/spike'
import { clock } from '../apps/next/src/client/overview/iso/clock'
import { hangars } from '../apps/next/src/client/overview/iso/hangars'
import { gateSign } from '../apps/next/src/client/overview/iso/gate-sign'
import { Ticket } from '../apps/next/src/client/signature/ticket'
import { Stamp } from '../apps/next/src/client/signature/stamp'
import { Button } from '../apps/next/src/client/ui/button'
const render = (node: React.ReactNode, name: string) =>
  renderToStaticMarkup(node, { identifierPrefix: `catalog-${name}-` })
const figures = {
  flights: spike(0.82, { stubs: 8 }),
  hours: clock('08:45', 1),
  aircraft: hangars(0.85, {
    sheds: [
      { key: 'airbus', name: 'AIRBUS', share: 0.6 },
      { key: 'boeing', name: 'BOEING', share: 0.3 },
      { key: 'other', name: 'OTHER', share: 0.1 },
    ],
    lit: 'airbus',
    shareLabel: (s) => Math.round(s * 100) + '%',
  }),
  ranking: gateSign(1.05, { code: 'TBS–LIS', note: '#1 ×24' }),
}
const specimens: Record<string, string> = {}
for (const [name, figure] of Object.entries(figures))
  specimens[name] = render(<IsoFigure figure={figure} />, name)
specimens.ticket = render(
  <Ticket
    state="logged"
    locale="ru"
    origin={{ iata: 'TBS', city: 'Тбилиси' }}
    destination={{ iata: 'LIS', city: 'Лиссабон' }}
    date="2026-10-12"
    flightNumber="DEMO 101"
    distanceKm={4200}
  />,
  'ticket',
)
for (const [name, variant, label] of [
  ['primary', 'primary', 'Добавить перелёт'],
  ['secondary', 'secondary', 'Отменить'],
  ['ghost', 'ghost', 'Подробнее'],
  ['danger', 'danger', 'Удалить перелёт'],
] as const)
  specimens[name] = render(
    <Button variant={variant} static>
      {label}
    </Button>,
    name,
  )
specimens.loading = render(
  <Button variant="secondary" loading loadingLabel="Сохраняем…" static>
    Сохранить
  </Button>,
  'loading',
)
for (const [code, native, name] of [
  ['JP', '日本', 'Япония'],
  ['PT', 'Portugal', 'Португалия'],
  ['GE', 'საქართველო', 'Грузия'],
])
  specimens['stamp' + code] = render(
    <Stamp
      countryCode={code}
      nativeName={native}
      name={name}
      kind="air"
      visits={3}
      firstYear={2025}
      locale="ru"
      static
      caption="3 посещения · 2025"
    />,
    'stamp' + code,
  )
console.log(JSON.stringify(specimens))
