'use client'

import { X } from '@keyline-icons/react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'
import type { Transition, Variants } from 'motion/react'
import { useLocale } from './preferences'
import { Button } from './ui/button'
import './kuukies.css'

// Adapted from Arc "cookie-consent" (uiarc.dev, MIT, see ui/ARC-LICENSE.txt): one surface that springs between a bar and a
// details panel, faces that rise from a short blur, a grow spring with a little bounce and a flat one for folding.
// Changed for Kuuki: Kuuki keeps only necessary cookies, so this is a notice, not a consent form. There are no categories
// to switch, no Accept/Reject and no floating reopen button; Settings reopens the panel through `openKuukies()`. The bar
// and panel share one width, so only the height springs; space groups the rows (no dividers); Kuuki tokens and Button.

const STORAGE_KEY = 'kuuki-kuukies'
/** Bump when the list below changes, so returning visitors see the notice again. */
const VERSION = '1'
const OPEN_EVENT = 'kuuki:kuukies'
/** First visit: let the page settle before the bar rises. */
const ENTRY_DELAY_MS = 800

type Copy = { en: string; ru: string }
const KUUKIES: { id: string; label: Copy; hint: Copy }[] = [
  {
    id: 'session',
    label: { en: 'Sign-in', ru: 'Вход' },
    hint: {
      en: 'Keeps you signed in. Without it, every click would start with a password.',
      ru: 'Держит вас в аккаунте. Без этого каждый клик начинался бы с пароля.',
    },
  },
  {
    id: 'csrf',
    label: { en: 'Security', ru: 'Защита' },
    hint: {
      en: 'Checks that a change came from you, not from another site.',
      ru: 'Проверяет, что изменение отправили вы, а не чужой сайт.',
    },
  },
  {
    id: 'appearance',
    label: { en: 'Theme and language', ru: 'Тема и язык' },
    hint: {
      en: 'So the page opens the way you left it.',
      ru: 'Чтобы страница открывалась такой, какой вы её оставили.',
    },
  },
  {
    id: 'accent',
    label: { en: 'Accent', ru: 'Акцент' },
    hint: { en: 'The color you picked.', ru: 'Цвет, который вы выбрали.' },
  },
]

/** Opens the details panel from anywhere, for example the Settings row. */
export function openKuukies() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

function readSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === VERSION
  } catch {
    return false
  }
}

function writeSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, VERSION)
  } catch {
    /* Blocked storage: the bar returns next visit, which is the honest fallback. */
  }
}

type Mode = 'bar' | 'panel'
const WIDTH_MAX = 400
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps its velocity. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: 'spring', stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}
const GROW = physical(0.4, 0.12)
const SHRINK = physical(0.32, 0)
const EASE_OUT = [0.23, 1, 0.32, 1] as const

const faceVariants: Variants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  shown: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      y: physical(0.36, 0.08),
      opacity: { duration: 0.2, ease: EASE_OUT, delay: 0.04 },
      filter: { duration: 0.22, ease: EASE_OUT, delay: 0.04 },
    },
  },
  gone: { opacity: 0, y: 4, filter: 'blur(4px)', transition: { duration: 0.12, ease: EASE_OUT } },
}
const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.16 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
}

/** A face reports its natural height while it is current, then goes inert as it leaves. */
function Face({
  id,
  reduced,
  onSize,
  className,
  children,
  ...rest
}: {
  id: Mode
  reduced: boolean
  onSize: (id: Mode, height: number) => void
  className: string
  children: ReactNode
  role?: string
  'aria-modal'?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !present) return
    const report = () => onSize(id, node.offsetHeight)
    report()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [id, onSize, present])
  return (
    <motion.div
      {...rest}
      ref={ref}
      className={`kuukies-face ${className}`}
      data-face={id}
      variants={reduced ? fadeVariants : faceVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
    >
      {children}
    </motion.div>
  )
}

/**
 * The kuukie notice: on a first visit a bar names the cookies Kuuki keeps; "What's inside" morphs it into a panel listing
 * each one. Nothing renders on the server or once the notice is seen, unless Settings reopens the panel.
 */
export function Kuukies() {
  const locale = useLocale()
  const t = (copy: Copy) => copy[locale]
  const reduced = !!useReducedMotion()
  const uid = useId()
  const titleId = `${uid}-title`
  const descriptionId = `${uid}-description`
  const messageId = `${uid}-message`

  const [mode, setMode] = useState<Mode | null>(null)
  const seen = useRef(true)
  /** Where focus was before it entered the surface, so closing hands it back instead of dropping it on <body>. */
  const returnTo = useRef<HTMLElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const panelHeadingRef = useRef<HTMLHeadingElement>(null)
  const barDetailsRef = useRef<HTMLButtonElement>(null)
  const [focusTarget, setFocusTarget] = useState<'panel' | 'bar' | null>(null)

  useEffect(() => {
    seen.current = readSeen()
    const timer = seen.current
      ? undefined
      : window.setTimeout(() => setMode((m) => m ?? 'bar'), ENTRY_DELAY_MS)
    const open = () => {
      const active = document.activeElement
      if (active instanceof HTMLElement && !surfaceRef.current?.contains(active))
        returnTo.current = active
      setFocusTarget('panel')
      setMode('panel')
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(OPEN_EVENT, open)
    }
  }, [])

  useEffect(() => {
    if (focusTarget === 'panel' && mode === 'panel')
      panelHeadingRef.current?.focus({ preventScroll: true })
    if (focusTarget === 'bar' && mode === 'bar')
      barDetailsRef.current?.focus({ preventScroll: true })
  }, [focusTarget, mode])

  const restoreFocus = () => {
    const target = returnTo.current
    returnTo.current = null
    if (surfaceRef.current?.contains(document.activeElement) && target?.isConnected)
      target.focus({ preventScroll: true })
  }

  const dismiss = () => {
    seen.current = true
    writeSeen()
    restoreFocus()
    setFocusTarget(null)
    setMode(null)
  }

  const closePanel = () => {
    if (seen.current) {
      restoreFocus()
      setFocusTarget(null)
      setMode(null)
    } else {
      setFocusTarget('bar')
      setMode('bar')
    }
  }

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    closePanel()
  }

  /* Geometry: the layer is measured, both faces share its width (capped) and report their heights; the surface springs to them. */
  const layerRef = useRef<HTMLDivElement>(null)
  const [layerWidth, setLayerWidth] = useState(0)
  useLayoutEffect(() => {
    const node = layerRef.current
    if (!node) return
    const read = () => setLayerWidth(node.clientWidth)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const width = Math.min(layerWidth || WIDTH_MAX, WIDTH_MAX)

  const height = useMotionValue(0)
  const heights = useRef<Record<Mode, number>>({ bar: 0, panel: 0 })
  const shape = useRef({ h: 0, ready: false })
  const [tick, setTick] = useState(0)
  const onSize = useCallback((id: Mode, h: number) => {
    if (heights.current[id] === h) return
    heights.current[id] = h
    setTick((count) => count + 1)
  }, [])

  useLayoutEffect(() => {
    if (!mode) {
      shape.current.ready = false
      return
    }
    const h = heights.current[mode]
    if (!h) return
    if (!shape.current.ready || reduced) {
      height.jump(h)
      shape.current = { h, ready: true }
      return
    }
    const transition = h >= shape.current.h ? GROW : SHRINK
    shape.current = { h, ready: true }
    animate(height, h, transition)
  }, [mode, tick, reduced, height])

  return (
    <div ref={layerRef} className="kuukies-layer">
      <AnimatePresence>
        {mode ? (
          <motion.div
            key="surface"
            ref={surfaceRef}
            className="kuukies-surface"
            style={{ width, height }}
            onFocusCapture={(event) => {
              const from = event.relatedTarget
              if (from instanceof HTMLElement && !event.currentTarget.contains(from))
                returnTo.current = from
            }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: reduced
                ? { duration: 0.16 }
                : {
                    y: physical(0.42, 0.1),
                    scale: physical(0.42, 0.1),
                    opacity: { duration: 0.2, ease: EASE_OUT },
                  },
            }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0.12 } }
                : { opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.16, ease: EASE_OUT } }
            }
          >
            <AnimatePresence initial={false}>
              {mode === 'bar' ? (
                <Face
                  key="bar"
                  id="bar"
                  reduced={reduced}
                  onSize={onSize}
                  className="kuukies-bar"
                  role="region"
                  aria-label="Kuukies"
                  aria-describedby={messageId}
                >
                  <p id={messageId} className="kuukies-message">
                    {t({
                      en: 'Kuuki runs on kuukies: sign-in, security, theme, language and accent. None of them follow you around.',
                      ru: 'Kuuki работает на kuukies: вход, защита, тема, язык и акцент. Слежки не обнаружено.',
                    })}
                  </p>
                  <div className="kuukies-actions">
                    <Button
                      ref={barDetailsRef}
                      variant="ghost"
                      dense
                      aria-haspopup="dialog"
                      onClick={() => {
                        setFocusTarget('panel')
                        setMode('panel')
                      }}
                    >
                      {t({ en: "What's inside", ru: 'Что внутри' })}
                    </Button>
                    <Button variant="primary" dense onClick={dismiss}>
                      {t({ en: 'Got it', ru: 'Принято' })}
                    </Button>
                  </div>
                </Face>
              ) : null}

              {mode === 'panel' ? (
                <Face
                  key="panel"
                  id="panel"
                  reduced={reduced}
                  onSize={onSize}
                  className="kuukies-panel"
                  role="dialog"
                  aria-modal={false}
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                  onKeyDown={onPanelKeyDown}
                >
                  <div className="kuukies-head">
                    <h2 id={titleId} ref={panelHeadingRef} className="kuukies-title" tabIndex={-1}>
                      Kuukies
                    </h2>
                    <button
                      type="button"
                      className="ui-icon-button"
                      aria-label={t({ en: 'Close', ru: 'Закрыть' })}
                      onClick={closePanel}
                    >
                      <X size={20} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                  <p id={descriptionId} className="kuukies-description">
                    {t({
                      en: 'All four are needed for the site to work, so there is nothing to switch off. Drafts and page layouts stay in this browser.',
                      ru: 'Все четыре нужны для работы сайта, отключать нечего. Черновики и вид страниц хранятся в этом браузере.',
                    })}
                  </p>
                  <ul className="kuukies-list">
                    {KUUKIES.map((kuukie) => (
                      <li key={kuukie.id}>
                        <h3>{t(kuukie.label)}</h3>
                        <p>{t(kuukie.hint)}</p>
                      </li>
                    ))}
                  </ul>
                  <Button variant="primary" dense className="kuukies-done" onClick={dismiss}>
                    {t({ en: 'Got it', ru: 'Принято' })}
                  </Button>
                </Face>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
