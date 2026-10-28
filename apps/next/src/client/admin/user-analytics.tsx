'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { UserAnalyticsData } from '../../../../../functions/api/_services/userAnalytics'
import { NavigationLink } from '../navigation-link'
import { useLocale } from '../preferences'
import { Button } from '../ui/button'
import './user-analytics.css'

export function UserAnalytics({
  data,
  locale: initialLocale,
}: {
  data: UserAnalyticsData
  locale: 'en' | 'ru'
}) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru'
  const text = (en: string, russian: string) => (ru ? russian : en)
  const number = new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US')
  const date = new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const timestamp = new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const { totals, period, daily } = data
  const difference = period.newUsers - period.previousNewUsers
  const max = Math.max(1, ...daily.map((day) => day.users))
  const percent = (value: number) =>
    new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US', {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(totals.users ? value / totals.users : 0)
  const stages = [
    { label: text('Finished welcome', 'Завершили знакомство'), value: totals.onboarded },
    { label: text('Have journal entries', 'С записями в журнале'), value: totals.withEntries },
    { label: text('Public passports', 'Открытый паспорт'), value: totals.publicProfiles },
    { label: text('Imported flights', 'Импортировали перелёты'), value: totals.importUsers },
  ]
  const records = [
    { label: text('Flights', 'Перелёты'), value: totals.flights },
    { label: text('Rail journeys', 'Поездки на поезде'), value: totals.railJourneys },
    { label: text('Road trips', 'Автопоездки'), value: totals.roadTrips },
  ]

  return (
    <div className="ua-page" lang={locale}>
      <header className="ua-header">
        <div>
          <h1>{text('Users', 'Пользователи')}</h1>
          <p className="ua-updated">
            <time dateTime={data.asOf}>{timestamp.format(new Date(data.asOf))} UTC</time>
          </p>
        </div>
        <Button
          variant="ghost"
          loading={refreshing}
          loadingLabel={text('Refreshing…', 'Обновляем…')}
          onClick={() => startRefresh(() => router.refresh())}
        >
          {text('Refresh', 'Обновить')}
        </Button>
      </header>

      <div className="ua-period-row">
        <nav className="ua-period" aria-label={text('Statistics period', 'Период статистики')}>
          {([7, 30, 90] as const).map((days) => (
            <NavigationLink
              key={days}
              href={`/admin/users?days=${days}`}
              prefetch={false}
              aria-current={data.days === days ? 'page' : undefined}
              scroll={false}
            >
              {days} {text('days', 'дней')}
            </NavigationLink>
          ))}
        </nav>
        <p className="ua-date-range">
          {date.format(new Date(data.startDate))} — {date.format(new Date(data.asOf))}
        </p>
      </div>

      <dl className="ua-metrics">
        <div className="ua-metric">
          <dt>{text('Total users', 'Всего пользователей')}</dt>
          <dd>{number.format(totals.users)}</dd>
        </div>
        <div className="ua-metric">
          <dt>{text('New users', 'Новые пользователи')}</dt>
          <dd>
            {number.format(period.newUsers)}
            <span className="ua-comparison">
              {difference > 0 ? '+' : ''}
              {number.format(difference)} {text('vs. previous period', 'к прошлому периоду')}
            </span>
          </dd>
        </div>
        <div className="ua-metric">
          <dt>{text('Added flights or journeys', 'Добавляли перелёты или поездки')}</dt>
          <dd>{number.format(period.contributors)}</dd>
        </div>
        <div className="ua-metric">
          <dt>{text('Entries added', 'Добавлено записей')}</dt>
          <dd>{number.format(period.flightsAdded + period.groundAdded)}</dd>
        </div>
      </dl>

      <section className="ua-panel" aria-labelledby="ua-activity-title">
        <div className="ua-panel-heading">
          <h2 id="ua-activity-title">{text('Active users', 'Активные пользователи')}</h2>
          <span className="ua-updated">
            {data.activity.since
              ? text('Collecting since ', 'Сбор с ') + date.format(new Date(data.activity.since))
              : text('Waiting for first visits', 'Ждём первых посещений')}
          </span>
        </div>
        <dl className="ua-activity-metrics">
          {[
            { label: text('Today · DAU', 'Сегодня · DAU'), value: data.activity.daily },
            { label: text('7 days · WAU', '7 дней · WAU'), value: data.activity.weekly },
            { label: text('30 days · MAU', '30 дней · MAU'), value: data.activity.monthly },
          ].map((metric) => (
            <div className="ua-metric" key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{data.activity.since ? number.format(metric.value) : '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="ua-panel ua-signups" aria-labelledby="ua-signups-title">
        <div className="ua-panel-heading">
          <h2 id="ua-signups-title">{text('Registrations', 'Регистрации')}</h2>
          <span className="ua-number">{number.format(period.newUsers)}</span>
        </div>
        {period.newUsers === 0 ? (
          <p className="ua-empty">
            {text('No new users in this period.', 'За этот период новых пользователей нет.')}
          </p>
        ) : (
          <>
            <svg
              className="ua-chart"
              viewBox="0 0 900 180"
              role="img"
              aria-label={text(
                `${period.newUsers} registrations over ${data.days} days. Daily values are in the table below.`,
                `Регистрации за ${data.days} дней: ${period.newUsers}. Значения по дням — в таблице ниже.`,
              )}
            >
              {daily.map((day, index) => {
                const width = 900 / daily.length
                const height = day.users ? (day.users / max) * 160 : 2
                return (
                  <rect
                    key={day.date}
                    x={index * width + 1}
                    y={180 - height}
                    width={Math.max(1, width - 3)}
                    height={height}
                    rx="2"
                    fill={day.users ? 'var(--mark-rest)' : 'var(--zero)'}
                  >
                    <title>
                      {date.format(new Date(day.date))}: {number.format(day.users)}
                    </title>
                  </rect>
                )
              })}
            </svg>
            <div className="ua-chart-axis" aria-hidden="true">
              <span>{date.format(new Date(data.startDate))}</span>
              <span>{date.format(new Date(data.asOf))}</span>
            </div>
          </>
        )}
        <details className="ua-details">
          <summary>{text('Daily data', 'Данные по дням')}</summary>
          <div
            className="ua-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={text('Daily statistics', 'Статистика по дням')}
          >
            <table>
              <caption className="sr-only">
                {text('Daily statistics, UTC', 'Статистика по дням, UTC')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{text('Date', 'Дата')}</th>
                  <th scope="col">{text('Users', 'Пользователи')}</th>
                  <th scope="col">{text('Flights', 'Перелёты')}</th>
                  <th scope="col">{text('Journeys', 'Поездки')}</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">
                      <time dateTime={day.date}>{date.format(new Date(day.date))}</time>
                    </th>
                    <td>{number.format(day.users)}</td>
                    <td>{number.format(day.flights)}</td>
                    <td>{number.format(day.ground)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="ua-bottom-grid">
        <section className="ua-panel" aria-labelledby="ua-journals-title">
          <h2 id="ua-journals-title">{text('Users and journals', 'Пользователи и журналы')}</h2>
          <dl className="ua-stages">
            {stages.map((stage) => (
              <div key={stage.label}>
                <dt>{stage.label}</dt>
                <dd>
                  <strong>{number.format(stage.value)}</strong>
                  <span>{percent(stage.value)}</span>
                  <meter
                    min={0}
                    max={Math.max(1, totals.users)}
                    value={stage.value}
                    aria-label={stage.label}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="ua-panel" aria-labelledby="ua-records-title">
          <h2 id="ua-records-title">{text('Journal entries', 'Записи в журналах')}</h2>
          <dl className="ua-records">
            {records.map((record) => (
              <div key={record.label}>
                <dt>{record.label}</dt>
                <dd>{number.format(record.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <details className="ua-details ua-definitions">
        <summary>{text('Metric definitions', 'Как считаем')}</summary>
        <ul>
          <li>
            {text(
              'Active users opened Kuuki while signed in, with the tab visible. DAU is today; WAU and MAU are unique users over 7 and 30 UTC calendar days including today. Counts cover only the collection period shown above.',
              'Активные пользователи открывали Kuuki под своим аккаунтом в видимой вкладке. DAU — сегодня; WAU и MAU — уникальные пользователи за 7 и 30 календарных дней по UTC, включая сегодня. Данные есть только с указанной даты начала сбора.',
            )}
          </li>
          <li>
            {text(
              'Only accounts and entries still present in Kuuki are counted. Deletions also change historical totals.',
              'Учитываются сохранившиеся аккаунты и записи. Удаление меняет в том числе исторические значения.',
            )}
          </li>
          <li>
            {text(
              'Periods include today and use UTC. The current day is incomplete; the comparison uses the preceding equally long period.',
              'Периоды включают сегодняшний день и считаются по UTC. Сегодняшний день неполный; сравнение — с предыдущим периодом той же длины.',
            )}
          </li>
          <li>
            {text(
              'Entries added and contributors count saved flights and undeleted rail or road journeys by the date they were added, including planned travel.',
              'Добавленные записи и их авторы — сохранённые перелёты и неудалённые поездки по дате добавления, включая запланированные.',
            )}
          </li>
          <li>
            {text(
              'A journal has entries if it contains a flight, a journey or a manually recorded country. Public passports require a public profile and a username.',
              'Журнал с записями содержит перелёт, поездку или страну, отмеченную вручную. Открытый паспорт — публичный профиль с именем пользователя.',
            )}
          </li>
          <li>
            {text(
              'Welcome completion includes choosing to add entries later. Imported flights count users with at least one retained imported flight. These metrics do not measure retention.',
              'Знакомство считается завершённым и при выборе добавить записи позже. Импорт учитывает пользователей хотя бы с одним сохранившимся импортированным перелётом. Эти метрики не измеряют удержание.',
            )}
          </li>
        </ul>
      </details>
    </div>
  )
}
