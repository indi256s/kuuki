'use client'

import './gallery.css'
import { Archive, CircleCheck, Plane, Bin2 as Trash2 } from '@keyline-icons/react'
import { useEffect, useState } from 'react'
import { MAKER_NAMES, MAKER_SLOTS } from '@kuuki/data/aircraft-makers'
import { ALLIANCES } from '@kuuki/data/alliance-membership'
import { setTheme } from '../../../client/appearance'
import { AllianceMark, MakerSwatch } from '../../../client/ui/category-mark'
import { Alert } from '../../../client/ui/alert'
import { Checkbox } from '../../../client/ui/checkbox'
import { ChipGroup, FacetChip } from '../../../client/ui/chip-group'
import { Chip } from '../../../client/ui/chip'
import { DateRangePicker, type DateRangeValue } from '../../../client/ui/date-range-picker'
import { FilterToolbar } from '../../../client/ui/filter-toolbar'
import { EmptyState } from '../../../client/ui/empty-state'
import { Kbd } from '../../../client/ui/kbd'
import { SlotText } from '../../../client/ui/slot-text'
import { Tooltip } from '../../../client/ui/tooltip'
import { MonthRange, type MonthRangeValue } from '../../../client/ui/month-range'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../../../client/ui/popover'
import { Skeleton } from '../../../client/ui/skeleton'
import { Button } from '../../../client/ui/button'
import { DestructiveConfirm } from '../../../client/ui/destructive-confirm'
import { Dialog } from '../../../client/ui/dialog'
import { Disclosure } from '../../../client/ui/disclosure'
import { Field } from '../../../client/ui/field'
import { FloatingActionBar } from '../../../client/ui/floating-action-bar'
import {
  Menu,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from '../../../client/ui/menu'
import { MultiSelect } from '../../../client/ui/multi-select'
import { SegmentedControl } from '../../../client/ui/segmented-control'
import { Sheet } from '../../../client/ui/sheet'
import { SwatchPicker } from '../../../client/ui/swatch-picker'
import { SwipeActions, SwipeActionsRow } from '../../../client/ui/swipe-actions'
import { SwitchRow } from '../../../client/ui/switch-row'
import { ToastProvider, useToast } from '../../../client/ui/toast'
import { ImportDockGallery } from './import-dock-gallery'
import { WelcomePassportGallery } from './welcome-passport-gallery'
import { Stamp } from '../../../client/signature/stamp'
import { Ticket } from '../../../client/signature/ticket'
import type { Locale } from '../../../lib/format'

type Theme = 'light' | 'dark'

const AIRLINE_OPTIONS = [
  { value: 'TK', label: 'Turkish Airlines', detail: 'TK', count: 14 },
  { value: 'PC', label: 'Pegasus', detail: 'PC', count: 6 },
  { value: 'LH', label: 'Lufthansa', detail: 'LH', count: 3 },
  { value: 'A3', label: 'Aegean Airlines', detail: 'A3' },
]
const YEAR_PRESETS = [2023, 2024, 2025, 2026].map((year) => ({
  label: String(year),
  from: `${year}-01-01`,
  to: `${year}-12-31`,
}))

export function Gallery({
  initialTheme,
  initialLocale,
}: {
  initialTheme: Theme
  initialLocale: Locale
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  useEffect(() => {
    setTheme(theme)
  }, [theme])
  const ru = locale === 'ru'
  const t = (en: string, rus: string) => (ru ? rus : en)
  return (
    <ToastProvider
      dismissLabel={t('Dismiss', 'Закрыть')}
      kindLabels={{
        info: t('Notice', 'Уведомление'),
        success: t('Success', 'Успех'),
        error: t('Error', 'Ошибка'),
      }}
    >
      <div className="gallery" lang={locale}>
        <h1>{t('UI gallery (development only)', 'Галерея интерфейса (только для разработки)')}</h1>
        <div className="gallery-controls">
          <SegmentedControl
            label={t('Theme', 'Тема')}
            value={theme}
            onChange={setThemeState}
            options={[
              { value: 'light', label: t('Light', 'Светлая') },
              { value: 'dark', label: t('Dark', 'Тёмная') },
            ]}
          />
          <SegmentedControl
            label={t('Language', 'Язык')}
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ru', label: 'Русский' },
            ]}
          />
        </div>
        <section>
          <h2>{t('Accent', 'Акцент')}</h2>
          <SwatchPicker locale={locale} />
        </section>
        <Sections locale={locale} theme={theme} t={t} />
      </div>
    </ToastProvider>
  )
}

function Sections({
  locale,
  theme,
  t,
}: {
  locale: Locale
  theme: Theme
  t: (en: string, ru: string) => string
}) {
  const toast = useToast()
  const [range, setRange] = useState<MonthRangeValue | null>({ from: '2025-01', to: '2025-12' })
  const [chip, setChip] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [sheetB, setSheetB] = useState(false)
  const [sheetR, setSheetR] = useState(false)
  const [period, setPeriod] = useState<'year' | 'all' | 'month' | 'week'>('year')
  const [switchA, setSwitchA] = useState(true)
  const [switchB, setSwitchB] = useState(false)
  const [sort, setSort] = useState('recent')
  const [selected, setSelected] = useState(3)
  const [email, setEmail] = useState('')
  const [flights, setFlights] = useState(74)
  const [aircraftOnly, setAircraftOnly] = useState(true)
  const [airlines, setAirlines] = useState<string[]>(['TK'])
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [applied, setApplied] = useState('')
  const [swiped, setSwiped] = useState('')
  const [checkedRows, setCheckedRows] = useState([true, false, false])
  const allRows = checkedRows.every(Boolean),
    someRows = checkedRows.some(Boolean)
  const origin = { iata: 'JFK', city: 'New York' },
    destination = { iata: 'BOS', city: 'Boston' }
  const ru = locale === 'ru'
  const ticket = {
    locale,
    origin,
    destination,
    date: '2026-10-12',
    flightNumber: 'B6 618',
    airline: 'JetBlue',
    distanceKm: 300,
  } as const
  // oxlint-disable-next-line kuuki/design-tokens -- sample stamp ink is data (a country flag colour), not a UI colour
  const stamp = { theme, locale, color: '#bc002d' } as const

  return (
    <>
      <section>
        <h2>Button</h2>
        <div className="gallery-row">
          <Button variant="primary">{t('Save flight', 'Сохранить перелёт')}</Button>
          <Button>{t('Cancel', 'Отмена')}</Button>
          <Button variant="ghost">{t('Skip', 'Пропустить')}</Button>
          <Button variant="danger">{t('Delete flight', 'Удалить перелёт')}</Button>
        </div>
        <div className="gallery-row ui-button-group">
          <Button dense variant="primary">
            {t('Dense', 'Компактная')}
          </Button>
          <Button dense>{t('Dense', 'Компактная')}</Button>
          <Button dense static>
            {t('Static', 'Без нажатия')}
          </Button>
        </div>
        <div className="gallery-row">
          <Button variant="primary" loading loadingLabel={t('Saving…', 'Сохраняем…')}>
            {t('Save flight', 'Сохранить перелёт')}
          </Button>
          <Button
            variant="primary"
            disabledReason={t(
              'Add a destination to save.',
              'Добавьте пункт назначения, чтобы сохранить.',
            )}
          >
            {t('Save flight', 'Сохранить перелёт')}
          </Button>
        </div>
      </section>
      <section>
        <h2>{t('Filter controls', 'Фильтры')}</h2>
        <div className="gallery-row">
          {chip ? (
            <Chip
              label={`${t('Period', 'Период')} · ${range?.from ?? '…'} — ${range?.to ?? '…'}`}
              onOpen={() => setFilterOpen(true)}
              onRemove={() => {
                setChip(false)
                setRange(null)
              }}
              removeLabel={t('Remove period filter', 'Убрать фильтр периода')}
            />
          ) : (
            <Button dense onClick={() => setChip(true)}>
              {t('Restore chip', 'Вернуть фильтр')}
            </Button>
          )}
          <PopoverRoot open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button dense>{t('Edit filter', 'Изменить фильтр')}</Button>
            </PopoverTrigger>
            <PopoverContent aria-label={t('Period filter', 'Фильтр периода')}>
              <MonthRange
                from={range?.from ?? ''}
                to={range?.to ?? ''}
                min="2000-01"
                max="2026-12"
                locale={locale}
                onChange={setRange}
                onClear={() => setFilterOpen(false)}
              />
            </PopoverContent>
          </PopoverRoot>
        </div>
        <MonthRange
          from={range?.from ?? ''}
          to={range?.to ?? ''}
          min="2000-01"
          max="2026-12"
          locale={locale}
          onChange={setRange}
          onClear={() => {}}
        />
      </section>
      <section>
        <h2>FilterToolbar, ChipGroup, FacetChip</h2>
        <div style={{ width: '100%' }}>
          <FilterToolbar
            label={t('Example filters', 'Пример фильтров')}
            search={
              <input
                className="ui-field-input"
                type="search"
                aria-label={t('Search flights', 'Поиск по перелётам')}
                placeholder={t(
                  'Search places, flights, airlines, dates',
                  'Города, рейсы, авиакомпании, даты',
                )}
              />
            }
            actions={
              <Button dense variant="ghost" onClick={() => setAirlines([])}>
                {t('Clear all', 'Сбросить всё')}
              </Button>
            }
          >
            <ChipGroup label={t('Filters', 'Фильтры')}>
              {airlines.length ? (
                <FacetChip
                  facet={t('Airline', 'Авиакомпания')}
                  values={airlines.map(
                    (code) =>
                      AIRLINE_OPTIONS.find((option) => option.value === code)?.label ?? code,
                  )}
                  locale={locale}
                  onRemove={() => setAirlines([])}
                  removeLabel={t('Remove Airline filter', 'Убрать фильтр «Авиакомпания»')}
                >
                  {(body) => (
                    <MultiSelect
                      label={t('Airline', 'Авиакомпания')}
                      options={AIRLINE_OPTIONS}
                      value={airlines}
                      onValueChange={setAirlines}
                      locale={locale}
                      trigger={body}
                    />
                  )}
                </FacetChip>
              ) : (
                <MultiSelect
                  label={t('Airline', 'Авиакомпания')}
                  options={AIRLINE_OPTIONS}
                  value={airlines}
                  onValueChange={setAirlines}
                  locale={locale}
                  trigger={<Button dense>{t('Airline', 'Авиакомпания')}</Button>}
                />
              )}
              <FacetChip
                facet={t('Place', 'Место')}
                values={['Istanbul', 'Tbilisi', 'Berlin']}
                locale={locale}
                onOpen={() => {}}
                onRemove={() => {}}
                removeLabel={t('Remove Place filter', 'Убрать фильтр «Место»')}
              />
            </ChipGroup>
          </FilterToolbar>
        </div>
      </section>
      <section>
        <h2>MultiSelect</h2>
        <MultiSelect
          label={t('Airline', 'Авиакомпания')}
          options={AIRLINE_OPTIONS}
          value={airlines}
          onValueChange={setAirlines}
          locale={locale}
        />
      </section>
      <section>
        <h2>SwipeActionsRow</h2>
        <p>
          {t(
            'Drag a row sideways with touch. Every action also needs a menu path; this demo has none.',
            'Потяните строку вбок пальцем. У каждого действия должен быть путь через меню; в этом примере его нет.',
          )}
        </p>
        <div style={{ width: 'min(100%, 420px)' }}>
          <SwipeActions>
            <SwipeActionsRow
              leading={[
                {
                  label: t('I flew', 'Я летел'),
                  icon: <CircleCheck size={20} strokeWidth={2} aria-hidden="true" />,
                  tone: 'accent',
                  onSelect: () => setSwiped(t('I flew', 'Я летел')),
                },
              ]}
              trailing={[
                {
                  label: t('Delete flight', 'Удалить перелёт'),
                  icon: <Trash2 size={20} strokeWidth={2} aria-hidden="true" />,
                  tone: 'danger',
                  onSelect: () => setSwiped(t('Delete flight', 'Удалить перелёт')),
                },
              ]}
            >
              <p style={{ margin: 0, padding: 'var(--space-4)' }}>IST to TBS, 12 Mar 2024</p>
            </SwipeActionsRow>
            <SwipeActionsRow
              trailing={[
                {
                  label: t('Delete flight', 'Удалить перелёт'),
                  icon: <Trash2 size={20} strokeWidth={2} aria-hidden="true" />,
                  tone: 'danger',
                  onSelect: () => setSwiped(t('Delete flight', 'Удалить перелёт')),
                },
              ]}
            >
              <p style={{ margin: 0, padding: 'var(--space-4)' }}>TBS to IST, 3 Apr 2024</p>
            </SwipeActionsRow>
          </SwipeActions>
        </div>
        <p role="status">
          {swiped ? t(`Last action: ${swiped}`, `Последнее действие: ${swiped}`) : ''}
        </p>
      </section>
      <section>
        <h2>DateRangePicker</h2>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          locale={locale}
          presets={YEAR_PRESETS}
          onApply={() => setApplied(`${dateRange.from} / ${dateRange.to}`)}
          onClear={() => {
            setDateRange({ from: '', to: '' })
            setApplied('')
          }}
        />
        <p role="status">{applied ? t(`Applied: ${applied}`, `Применено: ${applied}`) : ''}</p>
      </section>
      <section>
        <h2>{t('Loading placeholder', 'Заглушка загрузки')}</h2>
        <Skeleton height={180} label={t('Loading chart', 'Загрузка диаграммы')} />
      </section>
      <section>
        <h2>{t('Manufacturers', 'Производители')}</h2>
        <div className="gallery-row">
          {MAKER_SLOTS.map((maker) => (
            <span key={maker} className="ui-category-label">
              <MakerSwatch maker={maker} />
              {maker === 'other'
                ? t('Other', 'Другие')
                : maker === 'unknown'
                  ? t('Unknown', 'Неизвестно')
                  : MAKER_NAMES[maker]}
            </span>
          ))}
        </div>
      </section>
      <section>
        <h2>{t('Alliances', 'Альянсы')}</h2>
        <div className="gallery-row">
          {ALLIANCES.map((alliance) => (
            <span key={alliance} className="ui-category-label">
              <AllianceMark alliance={alliance} />
              {{ star: 'Star Alliance', oneworld: 'oneworld', skyteam: 'SkyTeam' }[alliance]}
            </span>
          ))}
        </div>
      </section>
      <section>
        <h2>Field</h2>
        <div className="gallery-fields">
          <Field
            label={t('Flight number', 'Номер рейса')}
            optionalLabel={t('optional', 'необязательно')}
            hint={t('For example B6 618', 'Например, B6 618')}
            placeholder="B6 618"
          />
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={
              email && !email.includes('@')
                ? t('Enter an email like name@example.com.', 'Введите адрес вида name@example.com.')
                : undefined
            }
            hint={t(
              'Type something without @ to see the error.',
              'Введите текст без @, чтобы увидеть ошибку.',
            )}
          />
        </div>
      </section>
      <section>
        <h2>Dialog, Sheet, Confirm</h2>
        <div className="gallery-row">
          <Button onClick={() => setDialog(true)}>{t('Open dialog', 'Открыть диалог')}</Button>
          <Button onClick={() => setSheetB(true)}>{t('Bottom sheet', 'Нижняя панель')}</Button>
          <Button onClick={() => setSheetR(true)}>{t('Side sheet', 'Боковая панель')}</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {t('Delete flight…', 'Удалить перелёт…')}
          </Button>
        </div>
        <Dialog
          open={dialog}
          onOpenChange={setDialog}
          title={t('Edit flight', 'Изменить перелёт')}
          description={t(
            'Changes apply to this flight only.',
            'Изменения коснутся только этого перелёта.',
          )}
          closeLabel={t('Close', 'Закрыть')}
          footer={
            <>
              <Button onClick={() => setDialog(false)}>{t('Cancel', 'Отмена')}</Button>
              <Button variant="primary" onClick={() => setDialog(false)}>
                {t('Save', 'Сохранить')}
              </Button>
            </>
          }
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Field key={i} label={`${t('Field', 'Поле')} ${i + 1}`} />
          ))}
        </Dialog>
        <Sheet
          open={sheetB}
          onOpenChange={setSheetB}
          side="bottom"
          title={t('Japan', 'Япония')}
          closeLabel={t('Close', 'Закрыть')}
          footer={
            <Button variant="primary" onClick={() => setSheetB(false)}>
              {t('Done', 'Готово')}
            </Button>
          }
        >
          <p>
            {t(
              'Drag the handle down to dismiss. This text scrolls and selects normally.',
              'Потяните за ручку вниз, чтобы закрыть. Этот текст прокручивается и выделяется как обычно.',
            )}
          </p>
          <Field label={t('Note', 'Заметка')} />
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i}>
              {t('Visit', 'Визит')} {i + 1}
            </p>
          ))}
        </Sheet>
        <Sheet
          open={sheetR}
          onOpenChange={setSheetR}
          side="right"
          title={t('Flight detail', 'Детали перелёта')}
          closeLabel={t('Close', 'Закрыть')}
          footer={<Button onClick={() => setSheetR(false)}>{t('Close', 'Закрыть')}</Button>}
        >
          <Ticket {...ticket} state="logged" />
        </Sheet>
        <DestructiveConfirm
          open={confirm}
          onOpenChange={setConfirm}
          title={t('Delete flight JFK → BOS, 3 Jan 2026?', 'Удалить рейс JFK → BOS, 3 янв 2026?')}
          consequence={t(
            'The flight leaves your journal and the stats update. You can undo for a few seconds.',
            'Рейс исчезнет из журнала, статистика пересчитается. Отменить можно в течение нескольких секунд.',
          )}
          confirmLabel={t('Delete flight', 'Удалить рейс')}
          cancelLabel={t('Cancel', 'Отмена')}
          pendingLabel={t('Deleting…', 'Удаляем…')}
          closeLabel={t('Close', 'Закрыть')}
          onConfirm={() =>
            new Promise<void>((resolve) => setTimeout(resolve, 1200)).then(() => {
              setConfirm(false)
              toast.show({
                message: t('Flight deleted', 'Рейс удалён'),
                actionLabel: t('Undo', 'Вернуть'),
              })
            })
          }
        />
      </section>
      <section>
        <h2>Menu</h2>
        <Menu trigger={<Button>{t('Sort', 'Сортировка')}</Button>}>
          <MenuLabel>{t('Sort by', 'Сортировать')}</MenuLabel>
          <MenuRadioGroup value={sort} onValueChange={setSort}>
            <MenuRadioItem value="recent">{t('Recent', 'Недавние')}</MenuRadioItem>
            <MenuRadioItem value="visits">{t('Most visits', 'По числу визитов')}</MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem>
            <Archive size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('Archive', 'В архив')}
          </MenuItem>
          <MenuItem danger>
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('Delete visit', 'Удалить визит')}
          </MenuItem>
        </Menu>
      </section>
      <section>
        <h2>SegmentedControl</h2>
        <SegmentedControl
          label={t('Period', 'Период')}
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: t('Week', 'Неделя') },
            { value: 'month', label: t('Month', 'Месяц') },
            { value: 'year', label: t('Year', 'Год') },
            { value: 'all', label: t('All time', 'Всё время') },
          ]}
        />
      </section>
      <section>
        <h2>SwitchRow</h2>
        <SwitchRow
          label={t('Public profile', 'Публичный профиль')}
          description={t(
            'Show your passport at /fly/you.',
            'Показывать паспорт по адресу /fly/you.',
          )}
          consequence={
            switchA
              ? t('Anyone with the link can see it.', 'Любой по ссылке увидит его.')
              : t('Only you can see it.', 'Видите только вы.')
          }
          checked={switchA}
          onCheckedChange={setSwitchA}
        />
        <SwitchRow
          label={t('Leaderboard', 'Рейтинг')}
          description={t('Appear in the rankings.', 'Участвовать в рейтинге.')}
          checked={switchB}
          onCheckedChange={setSwitchB}
          disabledReason={t(
            'Needs a public profile and at least 5 flights.',
            'Нужен публичный профиль и не меньше 5 перелётов.',
          )}
          disabled
        />
      </section>
      <section>
        <h2>Disclosure</h2>
        <Disclosure summary={t('More details', 'Подробнее')}>
          <div className="gallery-fields" style={{ paddingBlock: 8 }}>
            <Field label={t('Seat', 'Место')} />
            <Field label={t('Aircraft', 'Самолёт')} />
          </div>
        </Disclosure>
      </section>
      <section>
        <h2>Tooltip</h2>
        <div className="gallery-row">
          <Tooltip
            content={t(
              'First visit to Japan (pending confirmation)',
              'Первый визит в Японию (ждёт подтверждения)',
            )}
          >
            <Button dense>{t('Hover or focus me', 'Наведите или сфокусируйтесь')}</Button>
          </Tooltip>
          <Tooltip
            content={t(
              'Opens below when there is no room above.',
              'Откроется снизу, если сверху нет места.',
            )}
            side="bottom"
          >
            <Button dense>{t('Below', 'Снизу')}</Button>
          </Tooltip>
        </div>
        <p>
          {t(
            'Opens on keyboard focus and on hover with a mouse, closes on Escape. Never the only place for essential information.',
            'Открывается при фокусе с клавиатуры и при наведении мыши, закрывается по Escape. Никогда не единственное место для важного.',
          )}
        </p>
      </section>
      <section>
        <h2>SlotText</h2>
        <div className="gallery-row">
          <span style={{ fontSize: 22, lineHeight: '28px' }}>
            <SlotText
              value={flights}
              format={(value) => value.toLocaleString(ru ? 'ru-RU' : 'en-US')}
            />{' '}
            {t('flights', 'перелётов')}
          </span>
          <Button dense onClick={() => setFlights((value) => value + 1)}>
            +1
          </Button>
          <Button dense onClick={() => setFlights((value) => value + 130)}>
            +130
          </Button>
          <Button dense onClick={() => setFlights((value) => Math.max(0, value - 7))}>
            −7
          </Button>
        </div>
      </section>
      <section>
        <h2>Checkbox</h2>
        <div className="gallery-fields">
          <Checkbox
            label={t('Only flights without aircraft', 'Только перелёты без самолёта')}
            description={t(
              'Flights that already have one keep it.',
              'У перелётов с самолётом он сохранится.',
            )}
            checked={aircraftOnly}
            onChange={(event) => setAircraftOnly(event.target.checked)}
          />
          <Checkbox
            label={t('Select all', 'Выбрать все')}
            checked={allRows}
            indeterminate={someRows && !allRows}
            onChange={(event) => setCheckedRows(checkedRows.map(() => event.target.checked))}
          />
          <div className="gallery-row">
            {checkedRows.map((checked, index) => (
              <Checkbox
                key={index}
                aria-label={`${t('Flight', 'Перелёт')} ${index + 1}`}
                checked={checked}
                onChange={(event) =>
                  setCheckedRows(
                    checkedRows.map((value, i) => (i === index ? event.target.checked : value)),
                  )
                }
              />
            ))}
          </div>
          <Checkbox label={t('Not available offline', 'Недоступно без сети')} disabled />
        </div>
      </section>
      <section>
        <h2>Alert</h2>
        <div className="gallery-fields">
          <Alert
            variant="info"
            title={t('Next flight in 12 days', 'Следующий перелёт через 12 дней')}
          >
            {t('TBS to IST on 21 October.', 'TBS в IST 21 октября.')}
          </Alert>
          <Alert variant="success" title={t('3 flights confirmed', 'Подтверждено 3 перелёта')} />
          <Alert
            variant="warning"
            title={t('Could not refresh the journal', 'Не удалось обновить журнал')}
            action={<Button dense>{t('Try again', 'Повторить')}</Button>}
          >
            {t('Showing the flights from earlier.', 'Показаны перелёты, загруженные ранее.')}
          </Alert>
          <Alert
            variant="danger"
            urgent
            title={t('Could not save the flight', 'Не удалось сохранить перелёт')}
          >
            {t('Check your connection and try again.', 'Проверьте соединение и повторите.')}
          </Alert>
        </div>
      </section>
      <section>
        <h2>EmptyState</h2>
        <EmptyState
          title={t('No flights match', 'Нет подходящих перелётов')}
          description={t(
            'Clear the filters to see all 74 flights.',
            'Сбросьте фильтры, чтобы увидеть все 74 перелёта.',
          )}
          action={<Button dense>{t('Clear filters', 'Сбросить фильтры')}</Button>}
        />
      </section>
      <section>
        <h2>Kbd</h2>
        <div className="gallery-row">
          <span>
            <Kbd>/</Kbd> {t('search', 'поиск')}
          </span>
          <span>
            <Kbd>j</Kbd> <Kbd>k</Kbd> {t('move', 'перемещение')}
          </span>
          <span>
            <Kbd>Esc</Kbd> {t('close', 'закрыть')}
          </span>
        </div>
      </section>
      <section>
        <h2>Toast</h2>
        <div className="gallery-row">
          <Button onClick={() => toast.show({ message: t('Link copied', 'Ссылка скопирована') })}>
            {t('Info toast', 'Уведомление')}
          </Button>
          <Button
            onClick={() =>
              toast.show({ message: t('Passport updated', 'Паспорт обновлён'), kind: 'success' })
            }
          >
            {t('Success toast', 'Успех')}
          </Button>
          <Button
            onClick={() =>
              toast.show({
                message: t(
                  'Could not save the flight. Check your connection.',
                  'Не удалось сохранить перелёт. Проверьте соединение.',
                ),
                kind: 'error',
              })
            }
          >
            {t('Error toast', 'Ошибка')}
          </Button>
        </div>
      </section>
      <ImportDockGallery locale={locale} />
      <WelcomePassportGallery locale={locale} />
      <section>
        <h2>Ticket</h2>
        <div className="gallery-tickets">
          <Ticket
            {...ticket}
            state="upcoming"
            statusLabel={t('In 12 days', 'Через 12 дней')}
            actions={<Button dense>{t('Details', 'Подробнее')}</Button>}
          />
          <Ticket {...ticket} state="today" />
          <Ticket
            {...ticket}
            state="awaiting"
            prompt={t('Did you land in Boston?', 'Вы долетели до Бостона?')}
            actions={
              <>
                <Button variant="primary">{t('Confirm', 'Отметить')}</Button>
                <Button>{t('Changed', 'Изменилось')}</Button>
                <Button variant="ghost">{t('Did not fly', 'Перелёта не было')}</Button>
              </>
            }
          />
          <Ticket
            {...ticket}
            state="logged"
            stub={
              <Stamp
                {...stamp}
                countryCode="US"
                nativeName="USA"
                name={t('United States', 'Соединённые Штаты')}
                kind="air"
                visits={2}
                firstYear={2019}
                static
              />
            }
          />
        </div>
      </section>
      <section>
        <h2>Stamp</h2>
        <div className="gallery-stamps">
          <Stamp
            {...stamp}
            countryCode="JP"
            nativeName="日本"
            name={t('Japan', 'Япония')}
            kind="air"
            visits={1}
            firstYear={2019}
            caption={t('×1 · 2 mo ago', '×1 · 2 мес. назад')}
            pressEventId="gallery-jp"
          />
          {/* oxlint-disable kuuki/design-tokens -- sample stamp ink is data (country flag colours), not UI colours */}
          <Stamp
            {...stamp}
            color="#006aa7"
            countryCode="SE"
            nativeName="Sverige"
            name={t('Sweden', 'Швеция')}
            kind="air"
            visits={3}
            firstYear={2021}
            caption={t('×3 · 1 y ago', '×3 · 1 г. назад')}
          />
          <Stamp
            {...stamp}
            color="#009246"
            countryCode="IT"
            nativeName="Italia"
            name={t('Italy', 'Италия')}
            kind="air"
            visits={12}
            firstYear={2015}
            caption={t('×12 · 3 w ago', '×12 · 3 нед. назад')}
          />
          <Stamp
            {...stamp}
            color="#ffffff"
            countryCode="CH"
            nativeName="Schweiz"
            name={t('Switzerland', 'Швейцария')}
            kind="land"
            visits={2}
            firstYear={2022}
            caption={t('×2 · 8 mo ago', '×2 · 8 мес. назад')}
          />
          <Stamp
            {...stamp}
            color="#ce1126"
            countryCode="GR"
            nativeName="Ελλάδα"
            name={t('Greece', 'Греция')}
            kind="sea"
            visits={1}
            firstYear={2023}
            caption={t('×1 · 1 y ago', '×1 · 1 г. назад')}
          />
          <Stamp
            {...stamp}
            color="#0000cd"
            countryCode="NO"
            nativeName="Norge"
            name={t('Norway', 'Норвегия')}
            kind="claim"
            firstYear={2018}
            caption={t('Added by hand', 'Добавлена вручную')}
          />
          {/* oxlint-enable kuuki/design-tokens */}
          <Stamp
            {...stamp}
            countryCode="US"
            nativeName="United States"
            name={t('United States', 'Соединённые Штаты')}
            kind="air"
            status="pending"
            caption={t('Waiting for you', 'Ждёт вашей отметки')}
          />
        </div>
      </section>
      <section>
        <h2>FloatingActionBar</h2>
        <p>
          {t(
            'Sticks to the bottom of the viewport while this page scrolls.',
            'Прилипает к низу окна при прокрутке страницы.',
          )}
        </p>
        <FloatingActionBar
          label={t('Selection actions', 'Действия с выбранным')}
          countLabel={ru ? `Выбрано: ${selected}` : `${selected} selected`}
        >
          <Button dense onClick={() => setSelected(0)}>
            {t('Cancel', 'Отмена')}
          </Button>
          <Button dense variant="primary">
            <Plane
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              style={{ marginInlineEnd: 6, display: 'inline' }}
            />
            {t('Confirm all', 'Отметить все')}
          </Button>
        </FloatingActionBar>
      </section>
    </>
  )
}
