'use client'

import { useState } from 'react'
import { Button } from '../../../client/ui/button'
import { SegmentedControl } from '../../../client/ui/segmented-control'
import { PassportPreview } from '../../../client/welcome/passport/passport-preview'
import type { PassportPreview as Preview } from '../../../client/welcome/types'
import type { Locale } from '../../../lib/format'

// The welcome passport from fixtures: the live one needs an account and an import. The phone layout follows the
// viewport, so view this page at 390px to see the bench on a phone; the frame only fixes the passport's width.
const COUNTRIES = ['GB', 'FR', 'DE', 'JP', 'US', 'IT', 'ES', 'NL', 'TR', 'AE']

const SCENES = {
  name: { step: 'name', reading: false },
  idle: { step: 'flights', reading: false },
  reading: { step: 'flights', reading: true },
  review: { step: 'review', reading: false },
  ready: { step: 'ready', reading: false },
} as const
type Scene = keyof typeof SCENES

export function WelcomePassportGallery({ locale }: { locale: Locale }) {
  const ru = locale === 'ru'
  const [scene, setScene] = useState<Scene>('reading')
  const [added, setAdded] = useState(2)
  const preview: Preview = {
    ...SCENES[scene],
    name: 'Alex Mor',
    open: scene !== 'name',
    found: { flights: added * 3, countries: COUNTRIES.slice(0, added) },
  }
  const options = [
    { value: 'name', label: ru ? 'Имя' : 'Name' },
    { value: 'idle', label: ru ? 'Полёты' : 'Flights idle' },
    { value: 'reading', label: ru ? 'Чтение' : 'Flights reading' },
    { value: 'review', label: ru ? 'Проверка' : 'Review' },
    { value: 'ready', label: ru ? 'Готово' : 'Ready' },
  ] as const
  return (
    <section>
      <h2>{ru ? 'Паспорт приветствия' : 'Welcome passport'}</h2>
      <div className="gallery-row">
        <SegmentedControl
          dense
          label={ru ? 'Шаг' : 'Step'}
          value={scene}
          onChange={setScene}
          options={options}
        />
        <Button
          dense
          disabled={added >= COUNTRIES.length}
          onClick={() => setAdded((value) => Math.min(value + 1, COUNTRIES.length))}
        >
          {ru ? 'Добавить страну' : 'Add country'}
        </Button>
        <Button dense onClick={() => setAdded(0)}>
          {ru ? 'Сброс' : 'Reset'}
        </Button>
      </div>
      <div className="gallery-wp-frame">
        <PassportPreview preview={preview} locale={locale} />
      </div>
    </section>
  )
}
