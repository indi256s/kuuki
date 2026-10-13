'use client'

import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { isEmptyFilter } from '@kuuki/shared/overview/filter'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { OverviewFlightSheet } from '../store/open-flight'
import { HeroPanel } from '../hero/hero-panel'
import { NextStrip } from '../hero/next-strip'
import { OverviewGlobe } from '../globe/globe'
import { referenceLabels } from '../labels'
import { S, t } from '../copy'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { FilterBar } from '../filters/filter-bar'
import { useMobile } from '../../ui/use-mobile'
import { formatNumber } from '../../../lib/format'
import { packTiles } from '../mobile/tiles'
import { SectionTile } from '../mobile/section-tile'
import { SectionSheet } from '../mobile/section-sheet'
import { moveSection } from '../layout/reorder'
import { useReorder } from '../layout/use-reorder'
import { useLanes } from '../layout/use-lanes'
import { CountryList } from '../globe/country-list'
import { SectionFrame } from '../layout/section-frame'
import { HiddenFooter } from '../layout/hidden-footer'
import { Narrator } from '../narrator/narrator'
import { NextUp } from '../next-up/next-up'
import { SECTIONS } from '../sections/registry'
import { scopeTitle } from './scope-title'
import { FirstRun, ZeroResult } from './page-states'
import './page.css'

type Props = Omit<ComponentProps<typeof OverviewProvider>, 'children'> & { name: string }
export function OverviewPage({ name, ...provider }: Props) {
  return (
    <OverviewProvider {...provider}>
      <PageContent name={name} />
      <OverviewFlightSheet />
    </OverviewProvider>
  )
}
function PageContent({ name }: { name: string }) {
  const { scope, all, payload, filter, layout, locale, setLayout, isCurrent, actions, revalidate } =
    useOverview()
  const mobile = useMobile()
  const labels = useMemo(() => referenceLabels(locale), [locale])
  const firstRun =
    scope?.figures.flights === 0 &&
    isEmptyFilter(filter) &&
    payload?.derivedReady === true &&
    payload.passport.countries === 0 &&
    payload.passport.countryCodes.length === 0 &&
    payload.passport.regions === 0
  const zero = scope?.figures.flights === 0 && !isEmptyFilter(filter)
  // A section below its gate with no filter leaves the grid and the tiles; it stays in the saved order and hidden lists.
  // The gate reads the unfiltered scope: a filter that drops a chapter below it leaves the chapter in place, and the chapter says so itself.
  const locked = all
    ? layout.order.filter(
        (id) => id !== 'rankings' && SECTION_GATES[id].gate(all).status === 'below',
      )
    : []
  const shown = ({ order, hidden }: typeof layout) =>
    order.filter((id) => !hidden.includes(id) && !locked.includes(id))
  const visible = shown(layout)
  const [openId, setOpenId] = useState<SectionId | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  if (openId && (mobile !== true || !scope || firstRun || zero || !visible.includes(openId)))
    setOpenId(null)
  const [announcement, setAnnouncement] = useState('')
  const page = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<{
    target: SectionId | undefined
    menu: Element
    trigger: Element | null
  } | null>(null)
  const restoreMenuFocus = (target: SectionId | undefined) => {
    const menu = document.activeElement?.closest('[role="menu"]')
    if (menu)
      pendingFocus.current = {
        target,
        menu,
        trigger: document.getElementById(menu.getAttribute('aria-labelledby') ?? ''),
      }
  }
  useEffect(() => {
    const request = pendingFocus.current
    if (!request) return
    // Radix FocusScope restores the retiring trigger in a zero-delay passive cleanup.
    const timer = setTimeout(() => {
      if (pendingFocus.current !== request) return
      pendingFocus.current = null
      if (!isCurrent() || !page.current?.isConnected) return
      const active = document.activeElement
      if (active !== document.body && active !== request.trigger && !request.menu.contains(active))
        return
      ;(
        page.current.querySelector<HTMLElement>(
          request.target
            ? `[data-section-options="${request.target}"], [data-section-tile="${request.target}"]`
            : '[data-section-show]',
        ) ?? page.current.querySelector<HTMLElement>('h1')
      )?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [layout, isCurrent])
  const announce = (id: SectionId, index: number, count: number) => {
    const title = t(SECTIONS[id].title, locale),
      position = formatNumber(locale, index + 1),
      total = formatNumber(locale, count)
    setAnnouncement(
      t(
        {
          en: `${title} moved to position ${position} of ${total}`,
          ru: `${title}: позиция ${position} из ${total}`,
        },
        locale,
      ),
    )
  }
  const move = (id: SectionId, index: number) => {
    if (
      !isCurrent() ||
      !visible.includes(id) ||
      index < 0 ||
      index >= visible.length ||
      visible.indexOf(id) === index
    )
      return false
    setLayout((old) => {
      const current = shown(old)
      const target = current[index]
      return target && current.includes(id)
        ? { ...old, order: moveSection(old.order, id, old.order.indexOf(target)) }
        : old
    })
    return true
  }
  const reorder = useReorder({
    ids: mobile !== null && !firstRun && !zero ? visible : [],
    onCommit: move,
    announce,
  })
  const hide = (id: SectionId) => {
    if (!isCurrent() || !visible.includes(id)) return
    const index = visible.indexOf(id)
    if (openId === id) setOpenId(visible[index + 1] ?? visible[index - 1] ?? null)
    else restoreMenuFocus(visible[index + 1] ?? visible[index - 1])
    setLayout((old) => (old.hidden.includes(id) ? old : { ...old, hidden: [...old.hidden, id] }))
  }
  const show = (id: SectionId | 'all') => {
    if (!isCurrent()) return
    if (id === 'all' || (layout.hidden.length === 1 && layout.hidden.includes(id))) {
      restoreMenuFocus(
        id === 'all' ? layout.order.find((section) => layout.hidden.includes(section)) : id,
      )
    }
    setLayout((old) => ({
      ...old,
      hidden: id === 'all' ? [] : old.hidden.filter((section) => section !== id),
    }))
  }
  const lanes = useLanes(visible.join(','))
  const frame = (id: SectionId) => {
    const { Section, title } = SECTIONS[id]
    return (
      <SectionFrame
        key={id}
        id={id}
        title={t(title, locale)}
        index={visible.indexOf(id)}
        count={visible.length}
        onMove={(section, index) => {
          if (move(section, index)) {
            restoreMenuFocus(section)
            announce(section, index, visible.length)
          }
        }}
        onHide={hide}
        drag={reorder.bindings(id)}
        narrator={scope ? <Narrator slot={id} /> : null}
      >
        <Section span="full" />
      </SectionFrame>
    )
  }
  // Display name, else the username (as on the public profile); a bare "Hi" read as unfinished, so an unnamed account gets a full greeting.
  const greeting = t(
    {
      en: name ? `Hi, ${name}` : 'Welcome back',
      ru: name ? `Здравствуйте, ${name}` : 'С возвращением',
    },
    locale,
  )
  return (
    <div ref={page} className="ov3-page" lang={locale}>
      <div className="ov3-page-heading">
        <h1 tabIndex={-1}>
          {greeting}
          <span className="ov3-scope">{scopeTitle(filter, labels, locale)}</span>
        </h1>
      </div>
      {payload?.mode === 'aggregate' &&
      payload.aggregateResolution !== 'day' &&
      filter.period &&
      'from' in filter.period &&
      filter.period.from.length === 10 ? (
        <div role="alert">
          <p>
            {locale === 'ru' ? 'В этой сводке нет точных дат.' : 'This summary has no exact dates.'}
          </p>
          <Button onClick={() => void revalidate()}>{t(S.retry, locale)}</Button>
          <Button onClick={() => actions.setPeriod(null)}>
            {locale === 'ru' ? 'Очистить диапазон' : 'Clear range'}
          </Button>
        </div>
      ) : !scope || !all || !payload ? (
        <>
          <p role="status">{t(S.loading, locale)}</p>
          <Skeleton height={520} label={t(S.loading, locale)} />
        </>
      ) : (
        <>
          <div data-region="next">
            <NextStrip />
          </div>
          {!payload.derivedReady ? (
            <p role="status" className="status-note">
              {t(S.countriesUpdating, locale)}
            </p>
          ) : null}
          <div className="ov3-overview-workspace">
            {/* On very wide screens CSS docks the country list as a third card (page.css); both it and the disclosure render, so the server's first paint is already final. */}
            <div className="ov3-globe-band">
              <section
                className="ov3-globe-region ov-globe"
                aria-label={t(S.map, locale)}
                data-globe={firstRun ? 'blank' : zero ? 'ghost' : 'ready'}
              >
                <OverviewGlobe topLeft={<FilterBar />} />
              </section>
              {!firstRun ? (
                <>
                  <div data-region="figures">
                    <HeroPanel />
                  </div>
                  <CountryList />
                </>
              ) : null}
            </div>
            {firstRun ? <FirstRun /> : null}
          </div>
          {!firstRun && !zero ? <NextUp goals={scope.goals} /> : null}
          {zero ? (
            <ZeroResult />
          ) : !firstRun && mobile !== null ? (
            mobile ? (
              <div className="ov3-sections" data-surface="tiles">
                {packTiles(visible).map(({ id, span }) => {
                  const { Tile } = SECTIONS[id]
                  return (
                    <SectionTile
                      key={id}
                      id={id}
                      span={span}
                      drag={reorder.bindings(id)}
                      onOpen={(section, trigger) => {
                        if (isCurrent()) {
                          opener.current = trigger
                          setOpenId(section)
                        }
                      }}
                    >
                      <Tile span={span} />
                    </SectionTile>
                  )
                })}
              </div>
            ) : (
              <div ref={lanes} className="ov3-bento" data-surface="sections">
                {visible.map(frame)}
              </div>
            )
          ) : null}
          {mobile === true ? (
            <SectionSheet
              openId={openId}
              order={visible}
              onNavigate={(id) => {
                if (isCurrent() && visible.includes(id)) setOpenId(id)
              }}
              onClose={() => setOpenId(null)}
              onMove={(id, index) => {
                if (move(id, index)) announce(id, index, visible.length)
              }}
              onHide={hide}
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                if (isCurrent() && page.current?.isConnected)
                  (opener.current?.isConnected
                    ? opener.current
                    : page.current.querySelector<HTMLElement>('h1')
                  )?.focus()
              }}
            />
          ) : null}
          <div className="ov3-layout-status" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>
          {!firstRun && !zero ? (
            <HiddenFooter
              hidden={layout.order.filter((id) => layout.hidden.includes(id))}
              onShow={show}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
