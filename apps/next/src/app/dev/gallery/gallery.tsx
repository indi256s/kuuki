'use client'

import './gallery.css'
import { Archive, Plane, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MAKER_SLOTS } from '@kuuki/data/aircraft-makers'
import { ALLIANCES } from '@kuuki/data/alliance-membership'
import { setTheme } from '../../../client/appearance'
import { AllianceMark, MakerSwatch } from '../../../client/ui/category-mark'
import { Chip } from '../../../client/ui/chip'
import { MonthRange, type MonthRangeValue } from '../../../client/ui/month-range'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../../../client/ui/popover'
import { Skeleton } from '../../../client/ui/skeleton'
import { Button } from '../../../client/ui/button'
import { DestructiveConfirm } from '../../../client/ui/destructive-confirm'
import { Dialog } from '../../../client/ui/dialog'
import { Disclosure } from '../../../client/ui/disclosure'
import { Field } from '../../../client/ui/field'
import { FloatingActionBar } from '../../../client/ui/floating-action-bar'
import { Menu, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from '../../../client/ui/menu'
import { SegmentedControl } from '../../../client/ui/segmented-control'
import { Sheet } from '../../../client/ui/sheet'
import { SwatchPicker } from '../../../client/ui/swatch-picker'
import { SwitchRow } from '../../../client/ui/switch-row'
import { ToastProvider, useToast } from '../../../client/ui/toast'
import { Stamp } from '../../../client/signature/stamp'
import { Ticket } from '../../../client/signature/ticket'
import type { Locale } from '../../../lib/format'

type Theme = 'light' | 'dark'

export function Gallery({ initialTheme, initialLocale }: { initialTheme: Theme; initialLocale: Locale }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  useEffect(() => { setTheme(theme) }, [theme])
  const ru = locale === 'ru'
  const t = (en: string, rus: string) => (ru ? rus : en)
  return (
    <ToastProvider dismissLabel={t('Dismiss', 'Закрыть')} kindLabels={{ info: t('Notice', 'Уведомление'), success: t('Success', 'Успех'), error: t('Error', 'Ошибка') }}>
      <div className="gallery" lang={locale}>
        <h1>{t('UI gallery (development only)', 'Галерея интерфейса (только для разработки)')}</h1>
        <div className="gallery-controls">
          <SegmentedControl label={t('Theme', 'Тема')} value={theme} onChange={setThemeState} options={[{ value: 'light', label: t('Light', 'Светлая') }, { value: 'dark', label: t('Dark', 'Тёмная') }]} />
          <SegmentedControl label={t('Language', 'Язык')} value={locale} onChange={setLocale} options={[{ value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }]} />
        </div>
        <section><h2>{t('Accent', 'Акцент')}</h2><SwatchPicker locale={locale} /></section>
        <Sections locale={locale} theme={theme} t={t} />
      </div>
    </ToastProvider>
  )
}

function Sections({ locale, theme, t }: { locale: Locale; theme: Theme; t: (en: string, ru: string) => string }) {
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
  const origin = { iata: 'JFK', city: 'New York' }, destination = { iata: 'BOS', city: 'Boston' }
  const ru = locale === 'ru'
  const ticket = { locale, origin, destination, date: '2026-10-12', flightNumber: 'B6 618', airline: 'JetBlue', distanceKm: 300 } as const
  // eslint-disable-next-line no-restricted-syntax -- sample stamp ink is data (a country flag colour), not a UI colour
  const stamp = { theme, locale, color: '#bc002d' } as const

  return (
    <>
      <section><h2>Button</h2>
        <div className="gallery-row"><Button variant="primary">{t('Save flight', 'Сохранить перелёт')}</Button><Button>{t('Cancel', 'Отмена')}</Button><Button variant="ghost">{t('Skip', 'Пропустить')}</Button><Button variant="danger">{t('Delete flight', 'Удалить перелёт')}</Button></div>
        <div className="gallery-row ui-button-group"><Button dense variant="primary">{t('Dense', 'Компактная')}</Button><Button dense>{t('Dense', 'Компактная')}</Button><Button dense static>{t('Static', 'Без нажатия')}</Button></div>
        <div className="gallery-row"><Button variant="primary" loading loadingLabel={t('Saving…', 'Сохраняем…')}>{t('Save flight', 'Сохранить перелёт')}</Button><Button variant="primary" disabledReason={t('Add a destination to save.', 'Добавьте пункт назначения, чтобы сохранить.')}>{t('Save flight', 'Сохранить перелёт')}</Button></div>
      </section>
      <section><h2>{t('Filter controls', 'Фильтры')}</h2>
        <div className="gallery-row">
          {chip ? <Chip label={`${t('Period', 'Период')} · ${range?.from ?? '…'} — ${range?.to ?? '…'}`} onOpen={() => setFilterOpen(true)} onRemove={() => { setChip(false); setRange(null) }} removeLabel={t('Remove period filter', 'Убрать фильтр периода')} /> : <Button dense onClick={() => setChip(true)}>{t('Restore chip', 'Вернуть фильтр')}</Button>}
          <PopoverRoot open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild><Button dense>{t('Edit filter', 'Изменить фильтр')}</Button></PopoverTrigger>
            <PopoverContent aria-label={t('Period filter', 'Фильтр периода')}>
              <MonthRange from={range?.from ?? ''} to={range?.to ?? ''} min="2000-01" max="2026-12" locale={locale} onChange={setRange} onClear={() => setFilterOpen(false)} />
            </PopoverContent>
          </PopoverRoot>
        </div>
        <MonthRange from={range?.from ?? ''} to={range?.to ?? ''} min="2000-01" max="2026-12" locale={locale} onChange={setRange} onClear={() => {}} />
      </section>
      <section><h2>{t('Loading placeholder', 'Заглушка загрузки')}</h2><Skeleton height={180} label={t('Loading chart', 'Загрузка диаграммы')} /></section>
      <section><h2>{t('Manufacturers', 'Производители')}</h2>
        <div className="gallery-row">{MAKER_SLOTS.map(maker => <span key={maker} className="ui-category-label"><MakerSwatch maker={maker} />{{ airbus: 'Airbus', boeing: 'Boeing', embraer: 'Embraer', atr: 'ATR', other: t('Other', 'Другие'), unknown: t('Unknown', 'Неизвестно') }[maker]}</span>)}</div>
      </section>
      <section><h2>{t('Alliances', 'Альянсы')}</h2>
        <div className="gallery-row">{ALLIANCES.map(alliance => <span key={alliance} className="ui-category-label"><AllianceMark alliance={alliance} />{{ star: 'Star Alliance', oneworld: 'oneworld', skyteam: 'SkyTeam' }[alliance]}</span>)}</div>
      </section>
      <section><h2>Field</h2>
        <div className="gallery-fields">
          <Field label={t('Flight number', 'Номер рейса')} optionalLabel={t('optional', 'необязательно')} hint={t('For example B6 618', 'Например, B6 618')} placeholder="B6 618" />
          <Field label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} error={email && !email.includes('@') ? t('Enter an email like name@example.com.', 'Введите адрес вида name@example.com.') : undefined} hint={t('Type something without @ to see the error.', 'Введите текст без @, чтобы увидеть ошибку.')} />
        </div>
      </section>
      <section><h2>Dialog, Sheet, Confirm</h2>
        <div className="gallery-row">
          <Button onClick={() => setDialog(true)}>{t('Open dialog', 'Открыть диалог')}</Button>
          <Button onClick={() => setSheetB(true)}>{t('Bottom sheet', 'Нижняя панель')}</Button>
          <Button onClick={() => setSheetR(true)}>{t('Side sheet', 'Боковая панель')}</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>{t('Delete flight…', 'Удалить перелёт…')}</Button>
        </div>
        <Dialog open={dialog} onOpenChange={setDialog} title={t('Edit flight', 'Изменить перелёт')} description={t('Changes apply to this flight only.', 'Изменения коснутся только этого перелёта.')} closeLabel={t('Close', 'Закрыть')} footer={<><Button onClick={() => setDialog(false)}>{t('Cancel', 'Отмена')}</Button><Button variant="primary" onClick={() => setDialog(false)}>{t('Save', 'Сохранить')}</Button></>}>
          {Array.from({ length: 6 }, (_, i) => <Field key={i} label={`${t('Field', 'Поле')} ${i + 1}`} />)}
        </Dialog>
        <Sheet open={sheetB} onOpenChange={setSheetB} side="bottom" title={t('Japan', 'Япония')} closeLabel={t('Close', 'Закрыть')} footer={<Button variant="primary" onClick={() => setSheetB(false)}>{t('Done', 'Готово')}</Button>}>
          <p>{t('Drag the handle down to dismiss. This text scrolls and selects normally.', 'Потяните за ручку вниз, чтобы закрыть. Этот текст прокручивается и выделяется как обычно.')}</p>
          <Field label={t('Note', 'Заметка')} />
          {Array.from({ length: 12 }, (_, i) => <p key={i}>{t('Visit', 'Визит')} {i + 1}</p>)}
        </Sheet>
        <Sheet open={sheetR} onOpenChange={setSheetR} side="right" title={t('Flight detail', 'Детали перелёта')} closeLabel={t('Close', 'Закрыть')} footer={<Button onClick={() => setSheetR(false)}>{t('Close', 'Закрыть')}</Button>}>
          <Ticket {...ticket} state="logged" />
        </Sheet>
        <DestructiveConfirm open={confirm} onOpenChange={setConfirm} title={t('Delete flight JFK → BOS, 3 Jan 2026?', 'Удалить рейс JFK → BOS, 3 янв 2026?')} consequence={t('The flight leaves your journal and the stats update. You can undo for a few seconds.', 'Рейс исчезнет из журнала, статистика пересчитается. Отменить можно в течение нескольких секунд.')} confirmLabel={t('Delete flight', 'Удалить рейс')} cancelLabel={t('Cancel', 'Отмена')} pendingLabel={t('Deleting…', 'Удаляем…')} closeLabel={t('Close', 'Закрыть')} onConfirm={() => new Promise<void>(resolve => setTimeout(resolve, 1200)).then(() => { setConfirm(false); toast.show({ message: t('Flight deleted', 'Рейс удалён'), actionLabel: t('Undo', 'Вернуть') }) })} />
      </section>
      <section><h2>Menu</h2>
        <Menu trigger={<Button>{t('Sort', 'Сортировка')}</Button>}>
          <MenuLabel>{t('Sort by', 'Сортировать')}</MenuLabel>
          <MenuRadioGroup value={sort} onValueChange={setSort}>
            <MenuRadioItem value="recent">{t('Recent', 'Недавние')}</MenuRadioItem>
            <MenuRadioItem value="visits">{t('Most visits', 'По числу визитов')}</MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem><Archive size={16} strokeWidth={1.5} aria-hidden="true" />{t('Archive', 'В архив')}</MenuItem>
          <MenuItem danger><Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />{t('Delete visit', 'Удалить визит')}</MenuItem>
        </Menu>
      </section>
      <section><h2>SegmentedControl</h2>
        <SegmentedControl label={t('Period', 'Период')} value={period} onChange={setPeriod} options={[{ value: 'week', label: t('Week', 'Неделя') }, { value: 'month', label: t('Month', 'Месяц') }, { value: 'year', label: t('Year', 'Год') }, { value: 'all', label: t('All time', 'Всё время') }]} />
      </section>
      <section><h2>SwitchRow</h2>
        <SwitchRow label={t('Public profile', 'Публичный профиль')} description={t('Show your passport at /fly/you.', 'Показывать паспорт по адресу /fly/you.')} consequence={switchA ? t('Anyone with the link can see it.', 'Любой по ссылке увидит его.') : t('Only you can see it.', 'Видите только вы.')} checked={switchA} onCheckedChange={setSwitchA} />
        <SwitchRow label={t('Leaderboard', 'Рейтинг')} description={t('Appear in the rankings.', 'Участвовать в рейтинге.')} checked={switchB} onCheckedChange={setSwitchB} disabledReason={t('Needs a public profile and at least 5 flights.', 'Нужен публичный профиль и не меньше 5 перелётов.')} disabled />
      </section>
      <section><h2>Disclosure</h2>
        <Disclosure summary={t('More details', 'Подробнее')}><div className="gallery-fields" style={{ paddingBlock: 8 }}><Field label={t('Seat', 'Место')} /><Field label={t('Aircraft', 'Самолёт')} /></div></Disclosure>
      </section>
      <section><h2>Toast</h2>
        <div className="gallery-row">
          <Button onClick={() => toast.show({ message: t('Link copied', 'Ссылка скопирована') })}>{t('Info toast', 'Уведомление')}</Button>
          <Button onClick={() => toast.show({ message: t('Passport updated', 'Паспорт обновлён'), kind: 'success' })}>{t('Success toast', 'Успех')}</Button>
          <Button onClick={() => toast.show({ message: t('Could not save the flight. Check your connection.', 'Не удалось сохранить перелёт. Проверьте соединение.'), kind: 'error' })}>{t('Error toast', 'Ошибка')}</Button>
        </div>
      </section>
      <section><h2>Ticket</h2>
        <div className="gallery-tickets">
          <Ticket {...ticket} state="upcoming" statusLabel={t('In 12 days', 'Через 12 дней')} actions={<Button dense>{t('Details', 'Подробнее')}</Button>} />
          <Ticket {...ticket} state="today" />
          <Ticket {...ticket} state="awaiting" prompt={t('Did you land in Boston?', 'Вы долетели до Бостона?')} actions={<><Button variant="primary">{t('Confirm', 'Отметить')}</Button><Button>{t('Changed', 'Изменилось')}</Button><Button variant="ghost">{t('Did not fly', 'Перелёта не было')}</Button></>} />
          <Ticket {...ticket} state="logged" stub={<Stamp {...stamp} countryCode="US" nativeName="USA" name={t('United States', 'Соединённые Штаты')} kind="air" visits={2} firstYear={2019} static />} />
        </div>
      </section>
      <section><h2>Stamp</h2>
        <div className="gallery-stamps">
          <Stamp {...stamp} countryCode="JP" nativeName="日本" name={t('Japan', 'Япония')} kind="air" visits={1} firstYear={2019} caption={t('×1 · 2 mo ago', '×1 · 2 мес. назад')} pressEventId="gallery-jp" />
          {/* eslint-disable no-restricted-syntax -- sample stamp ink is data (country flag colours), not UI colours */}
          <Stamp {...stamp} color="#006aa7" countryCode="SE" nativeName="Sverige" name={t('Sweden', 'Швеция')} kind="air" visits={3} firstYear={2021} caption={t('×3 · 1 y ago', '×3 · 1 г. назад')} />
          <Stamp {...stamp} color="#009246" countryCode="IT" nativeName="Italia" name={t('Italy', 'Италия')} kind="air" visits={12} firstYear={2015} caption={t('×12 · 3 w ago', '×12 · 3 нед. назад')} />
          <Stamp {...stamp} color="#ffffff" countryCode="CH" nativeName="Schweiz" name={t('Switzerland', 'Швейцария')} kind="land" visits={2} firstYear={2022} caption={t('×2 · 8 mo ago', '×2 · 8 мес. назад')} />
          <Stamp {...stamp} color="#ce1126" countryCode="GR" nativeName="Ελλάδα" name={t('Greece', 'Греция')} kind="sea" visits={1} firstYear={2023} caption={t('×1 · 1 y ago', '×1 · 1 г. назад')} />
          <Stamp {...stamp} color="#0000cd" countryCode="NO" nativeName="Norge" name={t('Norway', 'Норвегия')} kind="claim" firstYear={2018} caption={t('Added by hand', 'Добавлена вручную')} />
          {/* eslint-enable no-restricted-syntax */}
          <Stamp {...stamp} countryCode="US" nativeName="United States" name={t('United States', 'Соединённые Штаты')} kind="air" status="pending" caption={t('Waiting for you', 'Ждёт вашей отметки')} />
        </div>
      </section>
      <section><h2>FloatingActionBar</h2>
        <p>{t('Sticks to the bottom of the viewport while this page scrolls.', 'Прилипает к низу окна при прокрутке страницы.')}</p>
        <FloatingActionBar label={t('Selection actions', 'Действия с выбранным')} countLabel={ru ? `Выбрано: ${selected}` : `${selected} selected`}>
          <Button dense onClick={() => setSelected(0)}>{t('Cancel', 'Отмена')}</Button>
          <Button dense variant="primary"><Plane size={16} strokeWidth={2} aria-hidden="true" style={{ marginInlineEnd: 6, display: 'inline' }} />{t('Confirm all', 'Отметить все')}</Button>
        </FloatingActionBar>
      </section>
    </>
  )
}
