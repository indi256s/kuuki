'use client'

import { useMemo, useState } from 'react'
import { formatNumber } from '../../../lib/format'
import { Button } from '../../ui/button'
import { Disclosure } from '../../ui/disclosure'
import { REGION_LABELS } from '../../passport/model'
import { ArcTreemap } from '../charts/arc-treemap'
import { KuukiChart, type ChartPoint } from '../charts/kuuki-chart'
import { LazyChart } from '../charts/lazy-chart'
import { useOverview } from '../store/overview-context'
import { countryEvidence } from './country-evidence'

type Tile = { facet: 'regions' | 'countries'; code: string; value: number; name: string }

export function CountryTreemap() {
  const { payload, filter, locale, actions } = useOverview()
  const [open, setOpen] = useState(false)
  const [region, setRegion] = useState<string | null>(null)
  const evidence = useMemo(
    () => (payload ? countryEvidence(payload, filter) : []),
    [payload, filter],
  )
  const selected = evidence.find((item) => item.region === region)
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  const regionName = (code: string) =>
    REGION_LABELS[code as keyof typeof REGION_LABELS]?.[locale] ?? code
  const title =
    locale === 'ru' ? 'Страны по завершённым перелётам' : 'Countries from completed flights'
  const root = locale === 'ru' ? 'Все регионы' : 'All regions'
  const add = locale === 'ru' ? 'Добавить фильтр' : 'Add filter'
  const drill = locale === 'ru' ? 'Показать страны' : 'Show countries'
  const countLabel = locale === 'ru' ? 'Свидетельства по странам' : 'Country evidence'
  const tiles: Tile[] = selected
    ? selected.countries.map((item) => ({
        facet: 'countries',
        code: item.code,
        value: item.value,
        name: names.of(item.code) ?? item.code,
      }))
    : evidence.map((item) => ({
        facet: 'regions',
        code: item.region,
        value: item.value,
        name: regionName(item.region),
      }))
  const points: ChartPoint<Tile>[] = tiles.map((datum) => ({
    key: `${datum.facet}:${datum.code}`,
    datum,
    label: `${datum.name}: ${formatNumber(locale, datum.value)}`,
  }))
  return (
    <div className="globe-country-evidence">
      <Disclosure summary={title} open={open} onOpenChange={setOpen}>
        <p>
          {locale === 'ru'
            ? 'Каждый завершённый перелёт учитывается один раз для каждой страны вне транзита. Международный перелёт может учитываться в двух странах; сумма не равна числу перелётов.'
            : 'Each completed flight counts once for each country outside transit. An international flight can count in two countries; the total is not the number of flights.'}
        </p>
        <nav aria-label={locale === 'ru' ? 'Регионы и страны' : 'Regions and countries'}>
          <Button
            dense
            onClick={() => setRegion(null)}
            aria-current={!selected ? 'location' : undefined}
          >
            {root}
          </Button>
          {selected && (
            <>
              <span> / {regionName(selected.region)}</span>
              <Button dense onClick={() => actions.add('regions', selected.region)}>
                {add}
              </Button>
            </>
          )}
        </nav>
        {!points.length ? (
          <p>
            {locale === 'ru'
              ? 'Нет свидетельств по странам из завершённых перелётов.'
              : 'No country evidence from completed flights.'}
          </p>
        ) : (
          open && (
            <div className="country-treemap-chart">
              <LazyChart height={280} label={title}>
                {(inView) => (
                  <KuukiChart
                    points={points}
                    height={240}
                    ariaLabel={title}
                    inView={inView}
                    onPick={(point) =>
                      point.datum.facet === 'regions'
                        ? setRegion(point.datum.code)
                        : actions.add('countries', point.datum.code)
                    }
                    actions={(point) => [
                      ...(point.datum.facet === 'regions'
                        ? [{ label: drill, run: () => setRegion(point.datum.code) }]
                        : []),
                      { label: add, run: () => actions.add(point.datum.facet, point.datum.code) },
                    ]}
                    table={{
                      caption: selected ? `${title} · ${regionName(selected.region)}` : title,
                      columns: [
                        { key: 'region', label: locale === 'ru' ? 'Регион' : 'Region' },
                        { key: 'country', label: locale === 'ru' ? 'Страна' : 'Country' },
                        { key: 'value', label: countLabel, numeric: true },
                      ],
                      rows: (selected ? [selected] : evidence).flatMap((item) =>
                        item.countries.map((country) => ({
                          region: regionName(item.region),
                          country: names.of(country.code) ?? country.code,
                          value: country.value,
                        })),
                      ),
                    }}
                  >
                    {(mark, { width }) => (
                      <ArcTreemap points={points} height={240} width={width} mark={mark} />
                    )}
                  </KuukiChart>
                )}
              </LazyChart>
            </div>
          )
        )}
      </Disclosure>
    </div>
  )
}
