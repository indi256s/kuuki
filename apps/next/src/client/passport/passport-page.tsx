'use client'

import { MoreHorizontal } from '@keyline-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { ROUTE_LINK_EVENT } from '../navigation-link'
import { useLocale } from '../preferences'
import { remarksLine } from '../profile/remarks'
import { notificationStorage } from '../profile/storage'
import type { EarnedBadge } from '../profile/achievements'
import { Button } from '../ui/button'
import { Menu, MenuItem } from '../ui/menu'
import { useMobile } from '../ui/use-mobile'
import type { Locale } from '../../lib/format'
import type { PassportData } from '../../server/passport'
import { AddCountrySheet } from './add-country-sheet'
import { CountrySheet, countryDetailQuery } from './country-sheet'
import { HiddenSheet } from './hidden-sheet'
import {
  arrivalFlightId,
  arrivalHref,
  countryNamer,
  passportEntries,
  splitPending,
  visitorEntries,
} from './model'
import { unseenCountries } from './new-stamps'
import {
  PassportLayout,
  type OwnerLayout,
  type PassportBar,
  type PassportStats,
} from './passport-layout'
import type { IdentityProfile } from './passport-identity'
import { usePassportQuery, type PassportPatch } from './use-passport-query'
import { useOpener } from './use-opener'
import { VisitorSheet } from './visitor-sheet'

type ProfileFields = IdentityProfile & {
  bio: string | null
  is_public: boolean
  theme_color: string | null
}
type Shared = {
  locale: Locale
  profile: ProfileFields
  /** The handle from the route, for a read that carries none. */
  routeHandle: string
  stats: PassportStats | null
  badges: EarnedBadge[]
  rankings: { category: string; rank: number }[]
  derivedState: string
}

/**
 * The shared Passport page, one tree for three viewers. `visitor` and `preview` receive only the public payload
 * (the permitted country codes, public stats, badges and rankings): no owner passport data reaches their props or DOM.
 */
export type PassportPageProps =
  | (Shared & {
      mode: 'owner'
      ownerId: string
      /** The full owner read: every source, dates, hidden countries and pending slots. */
      data: PassportData
      visibility: 'public' | 'private'
      shareUrl: string | null
    })
  | (Shared & {
      mode: 'visitor'
      /** The public set, sorted by name on the client. */
      countries: string[]
      memberViewer: boolean
      /** The viewer is the owner reading their own public page: a slim bar links back to /passport. */
      viewerIsOwner: boolean
    })
  | (Shared & {
      mode: 'preview'
      /** The owner's public projection under the stored publication, whether or not the profile is public. */
      countries: string[]
    })

export function PassportPage(props: PassportPageProps) {
  return props.mode === 'owner' ? <OwnerPassport {...props} /> : <PublicPassport {...props} />
}

const NO_STAMPS: ReadonlyMap<string, string> = new Map()

type OwnerProps = Extract<PassportPageProps, { mode: 'owner' }>

function OwnerPassport(props: OwnerProps) {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <OwnerInner {...props} />
    </QueryClientProvider>
  )
}

/** Countries pressed since this owner last looked play their impression once; the first visit records a baseline. */
function useFreshStamps(ownerId: string, codes: string[]) {
  const [fresh, setFresh] = useState<ReadonlyMap<string, string>>(NO_STAMPS)
  const key = codes.join(',')
  useEffect(() => {
    const added = unseenCountries(ownerId, key ? key.split(',') : [], notificationStorage())
    if (!added.length) return
    // Effects run twice in development; the in-memory baseline makes the second pass empty, so keep the first.
    // oxlint-disable-next-line hooks-compat/set-state-in-effect -- one-shot, derived from device storage that cannot be read during render
    setFresh((current) => {
      const next = new Map(current)
      for (const code of added) next.set(code, `passport-new:${ownerId}:${code}`)
      return next
    })
  }, [ownerId, key])
  return fresh
}

function OwnerInner({
  ownerId,
  locale: initialLocale,
  data: initial,
  profile,
  routeHandle,
  stats,
  badges,
  rankings,
  visibility,
  shareUrl,
}: OwnerProps) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru'
  const router = useRouter()
  const queryClient = useQueryClient()
  const mobile = useMobile()
  const query = usePassportQuery('/passport')
  const { state } = query
  const opener = useOpener()
  const menuTrigger = useRef<HTMLButtonElement | null>(null)
  const [adding, setAdding] = useState(false)
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const [removedCountry, setRemovedCountry] = useState<string | null>(null)
  // A pending slot resolving its arrival card: shown while the evidence loads, dropped when the member leaves or acts.
  const [opening, setOpening] = useState<string | null>(null)
  const arrivalIntent = useRef<{ code: string; href: string } | null>(null)
  useEffect(() => {
    const cancelArrival = () => {
      arrivalIntent.current = null
      setOpening(null)
    }
    window.addEventListener('popstate', cancelArrival)
    window.addEventListener(ROUTE_LINK_EVENT, cancelArrival)
    return () => {
      arrivalIntent.current = null
      window.removeEventListener('popstate', cancelArrival)
      window.removeEventListener(ROUTE_LINK_EVENT, cancelArrival)
    }
  }, [])

  const collection = useQuery({
    queryKey: ['passport', ownerId],
    queryFn: async ({ signal }) => {
      const controller = new AbortController()
      const untrack = trackPrivateOperation(controller)
      signal.addEventListener('abort', () => controller.abort(), { once: true })
      try {
        return await api.get<PassportData>('/api/passport/countries', undefined, {
          signal: controller.signal,
        })
      } finally {
        untrack()
      }
    },
    initialData: initial,
    initialDataUpdatedAt: initial.updatedAt,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
  useEffect(() => {
    const key = ['passport', ownerId]
    const newer = (current: PassportData | undefined) =>
      !current ||
      (initial.revision >= current.revision &&
        initial.publishedRevision >= current.publishedRevision &&
        (initial.revision > current.revision ||
          initial.publishedRevision > current.publishedRevision ||
          initial.updatedAt > current.updatedAt))
    if (!newer(queryClient.getQueryData<PassportData>(key))) return
    let active = true
    void queryClient.cancelQueries({ queryKey: key, exact: true }).then(() => {
      if (active && newer(queryClient.getQueryData<PassportData>(key)))
        queryClient.setQueryData(key, initial, { updatedAt: initial.updatedAt })
    })
    return () => {
      active = false
    }
  }, [queryClient, ownerId, initial])

  const data = collection.data ?? initial
  const name = useMemo(() => countryNamer(locale), [locale])
  const entries = useMemo(() => passportEntries(data), [data])
  const { collection: pressed, pending } = useMemo(() => splitPending(entries), [entries])
  const fresh = useFreshStamps(
    ownerId,
    useMemo(() => pressed.map((entry) => entry.code), [pressed]),
  )

  const cancelArrival = () => {
    arrivalIntent.current = null
    setOpening(null)
  }
  // Filters and the sheet replace the history entry, a mode change pushes one; either drops a pending arrival card.
  const navigate = useCallback(
    (patch: PassportPatch, mode?: 'push' | 'replace') => {
      arrivalIntent.current = null
      setOpening(null)
      query.navigate(patch, mode)
    },
    [query],
  )
  const openCountry = (code: string, element?: HTMLElement) => {
    opener.remember(element)
    navigate({ country: code })
  }

  // A pending slot's arrival card comes from the country's published evidence, not from the queue page's flags.
  // Repeated activation of the same slot is ignored; a newer activation, any other navigation or leaving the page
  // supersedes it, so a late read never pulls the member away.
  async function openArrival(code: string) {
    if (arrivalIntent.current?.code === code) return
    const intent = { code, href: window.location.href }
    arrivalIntent.current = intent
    setOpening(code)
    const flight = await queryClient
      .fetchQuery(countryDetailQuery(ownerId, code))
      .then(arrivalFlightId, () => null)
    if (arrivalIntent.current !== intent) return
    arrivalIntent.current = null
    setOpening(null)
    if (window.location.href === intent.href) router.push(arrivalHref(flight))
  }
  // The menu closes into the sheet: focus goes back to its button first, so the sheet returns there when dismissed.
  const fromMenu = (open: () => void) => () => {
    menuTrigger.current?.focus()
    cancelArrival()
    open()
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['passport', ownerId], exact: true }),
      queryClient.invalidateQueries({ queryKey: ['passport-country', ownerId] }),
    ])
  }

  const hiddenCodes = data.hidden
  const menu = (
    <Menu
      align="end"
      trigger={
        <button
          ref={menuTrigger}
          type="button"
          className="ui-icon-button"
          aria-label={ru ? 'Меню паспорта' : 'Passport menu'}
        >
          <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      }
    >
      <MenuItem asChild>
        <Link href="/settings">{ru ? 'Изменить профиль' : 'Edit profile'}</Link>
      </MenuItem>
      <MenuItem asChild>
        <Link href="/passport?as=visitor">
          {ru ? 'Посмотреть как посетитель' : 'View as visitor'}
        </Link>
      </MenuItem>
      <MenuItem onSelect={fromMenu(() => setHiddenOpen(true))}>
        {ru ? `Скрытые (${hiddenCodes.length})` : `Hidden (${hiddenCodes.length})`}
      </MenuItem>
      <MenuItem onSelect={fromMenu(() => setAdding(true))}>
        {ru ? 'Добавить страну' : 'Add country'}
      </MenuItem>
    </Menu>
  )

  const status = opening
    ? ru
      ? `Открываем карточку прилёта: ${name(opening)}…`
      : `Opening the arrival card for ${name(opening)}…`
    : removedCountry
      ? ru
        ? `Страна «${name(removedCountry)}» удалена из паспорта.`
        : `${name(removedCountry)} was removed from your passport.`
      : ''
  const owner: OwnerLayout = {
    ownerId,
    identity: {
      visibility,
      shareUrl,
      remarks: stats ? remarksLine(profile.id, stats, locale) : null,
      menu,
    },
    opening,
    status,
    onOpenArrival: (code) => void openArrival(code),
    onAdd: () => {
      opener.remember()
      cancelArrival()
      setAdding(true)
    },
    onOpenHidden: () => {
      opener.remember()
      setHiddenOpen(true)
    },
  }

  return (
    <PassportLayout
      locale={locale}
      mode="owner"
      profile={profile}
      routeHandle={routeHandle}
      stats={stats}
      badges={badges}
      rankings={rankings}
      memberViewer
      derivedState={data.derivedState}
      visited={data.pressedCountryCount}
      entries={pressed}
      pending={pending}
      hiddenCodes={hiddenCodes}
      name={name}
      query={{ state, navigate }}
      fresh={fresh}
      onOpen={openCountry}
      bar={null}
      notices={
        <>
          {data.derivedState === 'error' ? (
            <p role="status" className="status-note">
              {ru
                ? 'Не удалось обработать последние изменения. Записи сохранены, но штампы и итоги могут отставать.'
                : 'Recent changes could not be processed. Your records are saved, but stamps and totals may lag behind.'}
            </p>
          ) : data.derivedState !== 'ready' ? (
            <p role="status" className="status-note">
              {ru
                ? 'Последние изменения ещё обрабатываются. Штампы могут отставать от сохранённых перелётов.'
                : 'Recent changes are still being prepared. Stamps may lag behind saved flights.'}
            </p>
          ) : null}
          {collection.isError ? (
            <p role="alert" className="status-note">
              {ru
                ? 'Не удалось обновить паспорт. Показаны последние загруженные места.'
                : 'Could not refresh your passport. Showing the last loaded places.'}{' '}
              <Button dense onClick={() => void collection.refetch()}>
                {ru ? 'Повторить' : 'Try again'}
              </Button>
            </p>
          ) : null}
        </>
      }
      owner={owner}
      sheets={
        mobile === null ? null : (
          <>
            <CountrySheet
              ownerId={ownerId}
              locale={locale}
              code={state.country}
              entry={entries.find((entry) => entry.code === state.country)}
              publishedRevision={data.publishedRevision}
              mobile={mobile}
              name={name}
              onClose={() => navigate({ country: null })}
              onChanged={async () => {
                await refresh()
              }}
              onRemoved={(code) => {
                navigate({ country: null })
                setRemovedCountry(code)
              }}
              onCloseAutoFocus={opener.restore}
            />
            <AddCountrySheet
              open={adding}
              onOpenChange={setAdding}
              locale={locale}
              mobile={mobile}
              entries={entries}
              name={name}
              onPick={(code, addOpener) => {
                setAdding(false)
                opener.remember(addOpener)
                navigate({ country: code })
              }}
            />
            <HiddenSheet
              open={hiddenOpen}
              onOpenChange={setHiddenOpen}
              locale={locale}
              mobile={mobile}
              codes={hiddenCodes}
              name={name}
              onRestored={refresh}
            />
          </>
        )
      }
    />
  )
}

type PublicProps = Exclude<PassportPageProps, { mode: 'owner' }>

function PublicPassport(props: PublicProps) {
  const locale = useLocale(props.locale)
  const ru = locale === 'ru'
  const mobile = useMobile()
  const query = usePassportQuery(
    props.mode === 'preview' ? '/passport' : `/fly/${encodeURIComponent(props.routeHandle)}`,
  )
  const opener = useOpener()
  const name = useMemo(() => countryNamer(locale), [locale])
  const entries = useMemo(() => visitorEntries(props.countries), [props.countries])
  const { state, navigate } = query
  const bar: PassportBar | null =
    props.mode === 'preview'
      ? props.profile.is_public
        ? 'preview-public'
        : 'preview-private'
      : props.viewerIsOwner
        ? 'own-public-page'
        : null
  return (
    <PassportLayout
      locale={locale}
      mode={props.mode}
      profile={props.profile}
      routeHandle={props.routeHandle}
      stats={props.stats}
      badges={props.badges}
      rankings={props.rankings}
      memberViewer={props.mode === 'preview' || props.memberViewer}
      derivedState={props.derivedState}
      visited={props.countries.length}
      entries={entries}
      pending={[]}
      hiddenCodes={[]}
      name={name}
      query={query}
      fresh={NO_STAMPS}
      onOpen={(code, element) => {
        opener.remember(element)
        navigate({ country: code })
      }}
      bar={bar}
      notices={
        props.derivedState === 'pending' ? (
          <p className="profile-quiet" role="status">
            {ru
              ? 'Недавние изменения обрабатываются. Рейтинг может появиться позже.'
              : 'Recent changes are being prepared. Rankings may take a little longer to appear.'}
          </p>
        ) : null
      }
      owner={null}
      sheets={
        mobile === null ? null : (
          <VisitorSheet
            code={state.country}
            inCollection={!!state.country && props.countries.includes(state.country)}
            locale={locale}
            mobile={mobile}
            name={name}
            onClose={() => navigate({ country: null })}
            onCloseAutoFocus={opener.restore}
          />
        )
      }
    />
  )
}
