'use client'

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import type { FacetKey, OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import type { OverviewPrefs } from '@kuuki/shared/overview/prefs'
import type { Locale } from '../../../lib/format'
import { trackPrivateOperation } from '../../activity'
import { announceShellNotice } from '../../shell-notices'
import { LIFECYCLE_CHANGED_EVENT } from '../../lifecycle-sync'
import { attachRevalidation, createOverviewDataStore, scopeFor } from '../data-store'
import * as filters from './filter-actions'
import { createUIBus } from './ui-bus'

type Saver = (prefs: OverviewPrefs, signal: AbortSignal) => Promise<OverviewPrefs>
type Props = { payload: OverviewPayload | null; prefs: OverviewPrefs; ownerKey: string; locale: Locale; children: ReactNode; saver?: Saver; live?: boolean }
const savePrefs: Saver = (prefs, signal) => api.put('/api/me/overview/prefs', {
  version: prefs.version, filter: prefs.filter, layout: prefs.layout, replayPaused: prefs.replayPaused,
}, { signal })
type Lifetime = { active: boolean; generation: number; controllers: Set<AbortController> }

function useController({ payload: initial, prefs: initialPrefs, ownerKey, locale, saver = savePrefs, live = true }: Props) {
  const [navigation] = useState(() => {
    let observed: string | null = null, requested: string | null = null, opener: HTMLElement | SVGElement | null = null
    let targets: string[] = []
    return {
      getRequested: () => requested,
      observeURL(url: string, hash: string) {
        if (observed === url) return
        observed = url
        const target = url + hash, index = targets.indexOf(target)
        targets = index >= 0 ? targets.slice(index + 1) : []
        if (!targets.length) requested = target
      },
      traverse(url: string) { observed = url.split('#')[0]; requested = url; targets = [] },
      request(target: string) { requested = target; targets.push(target) },
      captureOpener() {
        const active = document.activeElement
        opener = active !== document.body && (active instanceof HTMLElement || active instanceof SVGElement) ? active : null
      },
      restoreFocus() {
        const target = opener?.isConnected ? opener : document.querySelector<HTMLElement>('main h1')
        if (target) {
          if (!target.hasAttribute('tabindex') && target.tagName === 'H1') target.setAttribute('tabindex', '-1')
          target.focus()
        }
        opener = null
      },
    }
  })
  const [retired, setRetired] = useState(false)
  const [serverPayload] = useState(initial)
  const [prefs, setPrefs] = useState(() => structuredClone(initialPrefs))
  const [runtime] = useState(() => ({
    lifetime: null as Lifetime | null,
    pending: null as OverviewPrefs | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    saving: false,
    eligible: false,
    warned: false,
    saver, locale,
    initialPrefs: prefs,
    incoming: initialPrefs,
    schedule: undefined as ((prefs: OverviewPrefs) => void) | undefined,
  }))
  const currentLifetime = useCallback(() => {
    const lifetime = runtime.lifetime
    if (!lifetime?.active) return null
    const generation = getAuthGeneration()
    if (lifetime.generation !== generation) {
      lifetime.generation = generation
      clearTimeout(runtime.timer)
      runtime.pending = null; runtime.eligible = false
      for (const controller of lifetime.controllers) controller.abort()
      // Keep the write slot until settlement: abort does not undo an accepted UPDATE.
    }
    return lifetime
  }, [runtime])
  const [bus] = useState(createUIBus)
  const [publicationGuards] = useState(() => new WeakMap<Response, () => boolean>())
  const [store] = useState(() => createOverviewDataStore(initial, async (input, options) => {
    const lifetime = currentLifetime()
    const generation = getAuthGeneration()
    const controller = new AbortController()
    const signal = options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal
    const current = () => lifetime?.active && runtime.lifetime === lifetime &&
      generation === getAuthGeneration() && !signal.aborted
    if (!current()) throw new DOMException('Session changed', 'AbortError')
    lifetime!.controllers.add(controller)
    const release = trackPrivateOperation(controller)
    const finish = () => { lifetime!.controllers.delete(controller); release() }
    try {
      const response = await fetch(input, { ...options, signal })
      if (!current()) throw new DOMException('Session changed', 'AbortError')
      if (response.status !== 200) { finish(); return response }
      publicationGuards.set(response, () => current() === true)
      const read = response.json.bind(response)
      response.json = async () => {
        try {
          const body: unknown = await read()
          if (!current()) throw new DOMException('Session changed', 'AbortError')
          const etag = body && typeof body === 'object' && 'etag' in body ? body.etag : null
          const prefix = `W/"ov3-${encodeURIComponent(ownerKey)}-`
          const revisions = typeof etag === 'string' && etag.startsWith(prefix)
            ? /^(0|[1-9]\d*)-(0|[1-9]\d*)"$/.exec(etag.slice(prefix.length)) : null
          if (!revisions || !revisions.slice(1).every(value => Number.isSafeInteger(Number(value)))) {
            throw new DOMException('Response owner is unproven', 'AbortError')
          }
          return body
        } finally { finish() }
      }
      return response
    } catch (error) { finish(); throw error }
  }, response => publicationGuards.get(response)?.() === true))
  const payload = useSyncExternalStore(store.subscribe, store.get, () => serverPayload)

  useEffect(() => {
    if (!live || !initial || store.get()?.etag === initial.etag || !currentLifetime()) return
    let active = true
    void store.revalidate().then(() => {
      // A refresh already in flight may predate this server publication.
      if (active && currentLifetime() && store.get()?.etag !== initial.etag) void store.revalidate()
    })
    return () => { active = false }
  }, [initial, store, live, currentLifetime])

  useEffect(() => { runtime.saver = saver; runtime.locale = locale; runtime.incoming = initialPrefs }, [runtime, saver, locale, initialPrefs])
  useEffect(() => {
    const lifetime: Lifetime = { active: true, generation: getAuthGeneration(), controllers: new Set() }
    runtime.lifetime = lifetime
    const active = () => lifetime.active && runtime.lifetime === lifetime
    async function send() {
      if (currentLifetime() !== lifetime || runtime.saving || !runtime.eligible || !runtime.pending) return
      const generation = getAuthGeneration()
      const current = () => active() && generation === getAuthGeneration()
      const body = { ...runtime.pending, version: runtime.incoming.version, publicSections: runtime.incoming.publicSections }
      runtime.pending = null; runtime.eligible = false; runtime.saving = true
      const controller = new AbortController()
      lifetime.controllers.add(controller)
      const release = trackPrivateOperation(controller)
      try {
        await runtime.saver(body, controller.signal)
        if (current() && !controller.signal.aborted) runtime.warned = false
      } catch {
        if (current() && !controller.signal.aborted && !runtime.warned) {
          runtime.warned = true
          announceShellNotice(ownerKey, { kind: 'error', message: runtime.locale === 'ru'
            ? 'Настройки не сохранены. Ваш выбор остаётся на этой странице.'
            : 'Settings were not saved. Your choices remain on this page.' })
        }
      } finally {
        release(); lifetime.controllers.delete(controller)
        if (active()) { runtime.saving = false; void send() }
      }
    }
    const schedule = (next: OverviewPrefs) => {
      if (currentLifetime() !== lifetime) return
      runtime.pending = next; runtime.eligible = false
      clearTimeout(runtime.timer)
      runtime.timer = setTimeout(() => { runtime.eligible = true; void send() }, 800)
    }
    runtime.schedule = schedule
    const stop = () => {
      lifetime.active = false
      clearTimeout(runtime.timer)
      runtime.pending = null; runtime.eligible = false; runtime.saving = false
      for (const controller of lifetime.controllers) controller.abort()
    }
    const reset = () => { stop(); setRetired(true) }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => {
      stop()
      window.removeEventListener('kuuki:identity-reset', reset)
    }
  }, [runtime, ownerKey, currentLifetime])
  useEffect(() => {
    if (!live) return
    const detach = attachRevalidation(store, window)
    const refresh = () => {
      void store.revalidate()
    }
    const stop = () => {
      detach()
      window.removeEventListener('kuuki:identity-reset', stop)
      window.removeEventListener(LIFECYCLE_CHANGED_EVENT, refresh)
    }
    window.addEventListener('kuuki:identity-reset', stop)
    window.addEventListener(LIFECYCLE_CHANGED_EVENT, refresh)
    return stop
  }, [runtime, store, live])
  useEffect(() => { if (prefs !== runtime.initialPrefs) runtime.schedule?.(prefs) }, [prefs, runtime])

  const updateFilter = (change: (filter: OverviewFilter) => OverviewFilter) => setPrefs(old => {
    const filter = change(old.filter)
    return filter === old.filter ? old : { ...old, filter }
  })
  return {
    payload, scope: scopeFor(store, prefs.filter), all: scopeFor(store, {}),
    filter: prefs.filter, layout: prefs.layout, replayPaused: prefs.replayPaused, locale, ownerKey,
    aggregate: payload?.mode === 'aggregate',
    actions: {
      add: <K extends FacetKey>(facet: K, value: filters.FacetValue<K>) => updateFilter(filter => filters.addValue(filter, facet, value)),
      remove: <K extends FacetKey>(facet: K, value: filters.FacetValue<K>) => updateFilter(filter => filters.removeValue(filter, facet, value)),
      removeFacet: (facet: FacetKey) => updateFilter(filter => filters.removeFacet(filter, facet)),
      setPeriod: (period: OverviewFilter['period'] | null) => updateFilter(filter => filters.setPeriod(filter, period)),
      clear: () => updateFilter(filters.clearAll),
      removeLast: () => updateFilter(filters.removeLast),
    },
    setLayout: (change: OverviewPrefs['layout'] | ((layout: OverviewPrefs['layout']) => OverviewPrefs['layout'])) =>
      setPrefs(old => ({ ...old, layout: typeof change === 'function' ? change(old.layout) : change })),
    setReplayPaused: (change: boolean | ((paused: boolean) => boolean)) =>
      setPrefs(old => ({ ...old, replayPaused: typeof change === 'function' ? change(old.replayPaused) : change })),
    bus, navigation, retired,
    isCurrent: () => currentLifetime() !== null,
    revalidate: () => live && currentLifetime()
      ? store.revalidate() : Promise.resolve('unchanged' as const),
  }
}
const Context = createContext<ReturnType<typeof useController> | null>(null)
function OwnerProvider(props: Props) {
  const value = useController(props)
  if (value.retired) return null
  return <Context.Provider value={value}>{props.children}</Context.Provider>
}
export function OverviewProvider(props: Props) { return <OwnerProvider key={props.ownerKey} {...props} /> }
export function useOverview() {
  const value = useContext(Context)
  if (!value) throw new Error('OverviewProvider is required')
  return value
}
export function useFilterActions() { return useOverview().actions }
export function useOverviewUIBus() { return useOverview().bus }
export function useOverviewUI() {
  const bus = useOverviewUIBus()
  return useSyncExternalStore(bus.subscribe, bus.getSnapshot, bus.getServerSnapshot)
}
