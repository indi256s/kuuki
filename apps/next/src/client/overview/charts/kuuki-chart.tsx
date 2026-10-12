'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SVGProps,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../ui/button'
import { useLocale } from '../../preferences'
import { t } from '../copy'
import { DEFAULT_PALETTE, type ChartPalette } from './palettes'
import { TableView, type ChartTable } from './table-view'
import { useMeasuredWidth } from './use-width'
import './chart-theme.css'

export type ChartPoint<T> = { key: string; datum: T; label: string }
export type TipAction = { label: string; run: () => void }
/** `width` and `height` are the SVG's coordinate size, equal to CSS pixels (1 unit = 1px). `available` is the measured host width. */
export type ChartSize = { width: number; height: number; available: number }
export type KuukiChartProps<T> = {
  points: readonly ChartPoint<T>[]
  /** A function receives the SVG width, for charts whose height follows their width. */
  height: number | ((width: number) => number)
  ariaLabel: string
  ariaDescription?: string
  palette?: ChartPalette
  inView: boolean
  onPick?: (point: ChartPoint<T>) => void
  /** Points the page is already filtered by: they carry `aria-pressed` and a standing outline (the filter chips live in the toolbar). */
  applied?: (point: ChartPoint<T>) => boolean
  /** The chapter's current reading: `data-picked` and `aria-current`, separate from `applied` (a filter) and from the tooltip subject. Enter then reads as "selects". */
  selected?: (point: ChartPoint<T>) => boolean
  /** A touch tap calls `onPick` instead of pinning the tooltip; long-press, the context menu and Shift+F10 still pin it with its actions. */
  tapPicks?: boolean
  tip?: (points: readonly ChartPoint<T>[]) => ReactNode
  actions?: (point: ChartPoint<T>) => readonly TipAction[]
  table: ChartTable
  /** Count-driven charts: the SVG's natural width for the measured host width (left-aligned, scrolls when wider). Default fills the host. */
  fit?: (available: number) => number
  /** With `fit`: when the chart is wider than its host, open scrolled to the far end (the latest data). */
  scrollEnd?: boolean
  /** Legacy fixed coordinate system, scaled to the host width. Prefer the pixel-sized default. */
  viewBox?: string
  /** Keys the arrow keys stop on, when the drawn marks are finer than what a reader steps through (Fleet's ridge samples: one stop per family). Default: every point. */
  keyStops?: readonly string[]
  children: (mark: (point: ChartPoint<T>) => SVGProps<SVGGElement>, size: ChartSize) => ReactNode
}

type Selection = { key: string; pinned: boolean; left: number; top: number }

/** Shared interaction/table host for the locally adapted Arc SVG charts. Geometry stays with each chart, drawn in CSS pixels from `size`. */
export function KuukiChart<T>({
  points,
  height,
  ariaLabel,
  ariaDescription,
  palette = DEFAULT_PALETTE,
  inView,
  onPick,
  applied,
  selected,
  tapPicks,
  tip,
  actions,
  table,
  fit,
  scrollEnd,
  viewBox,
  keyStops,
  children,
}: KuukiChartProps<T>) {
  const id = useId(),
    host = useRef<SVGSVGElement>(null),
    portal = useRef<HTMLDivElement>(null)
  const locale = useLocale()
  const [measure, available] = useMeasuredWidth<HTMLDivElement>()
  const root = useRef<HTMLDivElement | null>(null)
  const bindRoot = useCallback(
    (node: HTMLDivElement | null) => {
      root.current = node
      measure(node)
    },
    [measure],
  )
  const wanted = fit?.(available)
  const width = wanted !== undefined && Number.isFinite(wanted) && wanted > 0 ? wanted : available
  const svgHeight = typeof height === 'function' ? height(width) : height
  const size: ChartSize = { width, height: svgHeight, available }
  // Geometry must not glide while the host is being resized: hold transitions until the width settles.
  const [seen, setSeen] = useState(available),
    [resizing, setResizing] = useState(false)
  if (seen !== available) {
    setSeen(available)
    setResizing(true)
  }
  useEffect(() => {
    if (!resizing) return
    const timer = setTimeout(() => setResizing(false), 150)
    return () => clearTimeout(timer)
  }, [available, resizing])
  const marks = useRef(new Map<string, SVGGElement>())
  const pointer = useRef('mouse')
  const [active, setActive] = useState<string | null>(null)
  const [picked, setSelection] = useState<Selection | null>(null)
  // A selection whose point left the data (filter change) reads as dismissed.
  const selection = picked && points.some((item) => item.key === picked.key) ? picked : null
  const point = selection && points.find((item) => item.key === selection.key)
  const stops = keyStops ? points.filter((item) => keyStops.includes(item.key)) : points
  const activeKey = points.some((item) => item.key === active) ? active : stops[0]?.key
  const selectedKey = selection?.key
  // The tooltip portals into the dialog that holds the mark (so it stays above a sheet), else the body; chosen when a mark is shown.
  const [portalOwner, setPortalOwner] = useState<Element | null>(null)
  const nativePopover =
    typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'
  const ownerBox =
    typeof document !== 'undefined' &&
    !nativePopover &&
    portalOwner &&
    portalOwner !== document.body
      ? portalOwner.getBoundingClientRect()
      : null
  const hasPoint = !!point
  const dismiss = useCallback(() => {
    if (portal.current?.contains(document.activeElement))
      ((selectedKey && marks.current.get(selectedKey)) || host.current)?.focus()
    setSelection(null)
  }, [selectedKey])
  useEffect(() => {
    if (!selection?.pinned) return
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !portal.current?.contains(event.target) &&
        !host.current?.contains(event.target)
      )
        dismiss()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        dismiss()
      }
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', escape, true)
    }
  }, [selection?.pinned, dismiss])
  useLayoutEffect(() => {
    const node = portal.current
    if (!node || !hasPoint || !nativePopover) return
    node.showPopover()
    return () => {
      if (node.matches(':popover-open')) node.hidePopover()
    }
  }, [hasPoint, portalOwner, nativePopover])
  useLayoutEffect(() => {
    if (selection?.pinned) portal.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [selection?.key, selection?.pinned])
  useLayoutEffect(() => {
    const node = portal.current
    if (!node || !selection) return
    const box = node.getBoundingClientRect()
    const left = Math.max(16, Math.min(selection.left, window.innerWidth - box.width - 16))
    const top = Math.max(16, Math.min(selection.top, window.innerHeight - box.height - 16))
    if (left !== selection.left || top !== selection.top) setSelection({ ...selection, left, top })
  }, [selection, point])
  const show = (key: string, element: SVGGElement, pinned: boolean) => {
    const box = element.getBoundingClientRect()
    setPortalOwner(element.closest('[role="dialog"]') ?? document.body)
    setSelection({ key, pinned, left: Math.max(16, box.left), top: box.bottom + 8 })
  }
  const focus = (index: number) => {
    const target = stops[Math.max(0, Math.min(stops.length - 1, index))]
    if (target) {
      setActive(target.key)
      marks.current.get(target.key)?.focus()
    }
  }
  const mark = (
    item: ChartPoint<T>,
  ): SVGProps<SVGGElement> & {
    'data-chart-key': string
    'data-kc-key': string
    'data-selected'?: string
    'data-pinned'?: string
    'data-filtered'?: string
    'data-picked'?: string
  } => ({
    ref: (node) => {
      if (node) marks.current.set(item.key, node)
      else marks.current.delete(item.key)
    },
    role: 'button',
    tabIndex: item.key === activeKey ? 0 : -1,
    'aria-label': item.label,
    'aria-describedby': [ariaDescription ? `${id}-description` : '', `${id}-keys`]
      .filter(Boolean)
      .join(' '),
    'data-chart-key': item.key,
    'data-kc-key': item.key,
    // Hover, focus and pin only describe the tooltip's subject; none of them filters, recolors or hides data.
    'data-selected': selection?.key === item.key ? 'true' : undefined,
    'data-pinned': selection?.pinned && selection.key === item.key ? 'true' : undefined,
    'data-filtered': applied?.(item) ? 'true' : undefined,
    'aria-pressed': applied ? !!applied(item) : undefined,
    'data-picked': selected?.(item) ? 'true' : undefined,
    'aria-current': selected?.(item) ? 'true' : undefined,
    onFocus: (event) => {
      setActive(item.key)
      if (!selection?.pinned) show(item.key, event.currentTarget, false)
    },
    onPointerDown: (event) => {
      pointer.current = event.pointerType || 'mouse'
    },
    onPointerEnter: (event) => {
      if (event.pointerType !== 'touch' && !selection?.pinned)
        show(item.key, event.currentTarget, false)
    },
    onPointerLeave: () => {
      if (!selection?.pinned) dismiss()
    },
    onContextMenu: (event) => {
      if (actions) {
        event.preventDefault()
        show(item.key, event.currentTarget, true)
      }
    },
    onClick: (event) => {
      event.stopPropagation()
      if (pointer.current === 'touch' && !tapPicks) show(item.key, event.currentTarget, true)
      else {
        dismiss()
        onPick?.(points.find((current) => current.key === item.key) ?? item)
      }
    },
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        pointer.current = 'keyboard'
        dismiss()
        onPick?.(points.find((current) => current.key === item.key) ?? item)
      }
    },
  })
  const fixed = !viewBox && fit !== undefined
  const scrolls = fixed && width > available + 0.5
  // Content beyond the right edge shows as a fade (CSS) until the reader reaches the end.
  const [more, setMore] = useState(false)
  useLayoutEffect(() => {
    const node = root.current
    if (!node || !scrolls) return
    const update = () => setMore(node.scrollLeft + node.clientWidth < node.scrollWidth - 1)
    if (scrollEnd) node.scrollLeft = node.scrollWidth
    update()
    node.addEventListener('scroll', update, { passive: true })
    return () => node.removeEventListener('scroll', update)
  }, [scrolls, scrollEnd, width])
  return (
    <div
      ref={bindRoot}
      className="kc"
      style={palette}
      data-in-view={inView}
      data-resizing={resizing || undefined}
      data-scroll={scrolls || undefined}
      data-more={(scrolls && more) || undefined}
    >
      <svg
        ref={host}
        className="kc-svg"
        role="group"
        tabIndex={activeKey ? -1 : 0}
        aria-label={ariaLabel}
        aria-describedby={[ariaDescription ? `${id}-description` : '', `${id}-keys`]
          .filter(Boolean)
          .join(' ')}
        viewBox={viewBox ?? `0 0 ${width} ${svgHeight}`}
        preserveAspectRatio={viewBox ? undefined : 'xMinYMin meet'}
        style={fixed ? { height: svgHeight, width, maxWidth: 'none' } : { height: svgHeight }}
        onBlur={(event) => {
          if (!selection?.pinned && !event.currentTarget.contains(event.relatedTarget)) dismiss()
        }}
        onKeyDown={(event) => {
          if (actions && event.shiftKey && event.key === 'F10' && activeKey) {
            const mark = marks.current.get(activeKey)
            if (mark) {
              event.preventDefault()
              event.stopPropagation()
              show(activeKey, mark, true)
            }
            return
          }
          const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          const at = stops.findIndex((item) => item.key === activeKey)
          // From a hovered mark that is not a stop, the arrows go to the nearest stop on that side.
          const passed = stops.filter(
            (item) => points.indexOf(item) < points.findIndex((point) => point.key === activeKey),
          ).length
          const next = at >= 0 ? at + (back ? -1 : 1) : back ? passed - 1 : passed
          if (
            ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)
          ) {
            event.preventDefault()
            pointer.current = 'keyboard'
            focus(event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : next)
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            pointer.current = 'keyboard'
            dismiss()
            const target = points.find((item) => item.key === activeKey)
            if (target) onPick?.(target)
          } else if (event.key === 'Escape') dismiss()
        }}
      >
        {ariaDescription ? <desc id={`${id}-description`}>{ariaDescription}</desc> : null}
        {children(mark, size)}
      </svg>
      {/* The keys are otherwise undiscoverable: one point is a tab stop and the others are reached with arrows. */}
      <span id={`${id}-keys`} className="sr-only">
        {t(
          onPick && (selected || tapPicks)
            ? {
                en: 'Arrow keys move between points. Enter selects the focused point.',
                ru: 'Стрелки переключают точки. Enter выбирает точку в фокусе.',
              }
            : onPick
              ? {
                  en: 'Arrow keys move between points. Enter filters the page by the focused point.',
                  ru: 'Стрелки переключают точки. Enter фильтрует страницу по выбранной точке.',
                }
              : { en: 'Arrow keys move between points.', ru: 'Стрелки переключают точки.' },
          locale,
        )}
        {actions
          ? ` ${t({ en: 'Shift+F10 opens actions for the focused point.', ru: 'Shift+F10 открывает действия для выбранной точки.' }, locale)}`
          : ''}
      </span>
      {point && selection && portalOwner
        ? createPortal(
            <div
              ref={portal}
              popover={nativePopover ? 'manual' : undefined}
              className="kc-tooltip"
              style={{
                ...palette,
                left: selection.left - (ownerBox?.left ?? 0),
                top: selection.top - (ownerBox?.top ?? 0),
              }}
              role={selection.pinned ? 'dialog' : 'tooltip'}
              aria-label={point.label}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') event.stopPropagation()
              }}
            >
              {tip ? tip([point]) : <span>{point.label}</span>}
              {selection.pinned && (
                <div className="kc-tip-actions">
                  {actions?.(point).map((action) => (
                    <Button
                      key={action.label}
                      onClick={() => {
                        dismiss()
                        action.run()
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                  <Button onClick={dismiss}>
                    {document.documentElement.lang === 'ru' ? 'Закрыть' : 'Close'}
                  </Button>
                </div>
              )}
            </div>,
            portalOwner,
          )
        : null}
      <TableView table={table} />
    </div>
  )
}
