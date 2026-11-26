'use client'

import { Camera, Clipboard, Cloud, Upload } from '@keyline-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Locale } from '../../lib/format'
import { NavigationLink as Link } from '../navigation-link'
import { Button } from '../ui/button'
import { ChevronIcon } from '../ui/icon-morph'
import { Menu, MenuItem } from '../ui/menu'
import { TextShimmer } from '../ui/text-shimmer'
import { failureOf } from './batch-run'
import { FAILURE, S } from './copy'
import { ImportTextarea } from './import-textarea'
import { NOMADS_ACCEPT } from './nomads-json'
import { NomadsNote } from './nomads-note'
import { ACCEPT } from './source-step'
import type { EntryProblem, SessionEntry, UnifiedSession } from './unified-session'

const C = {
  choose: { en: 'Choose files', ru: 'Выбрать файлы' },
  more: { en: 'Add files', ru: 'Добавить файлы' },
  moreSources: { en: 'Add more', ru: 'Добавить ещё' },
  photo: { en: 'Take a photo', ru: 'Сфотографировать' },
  paste: { en: 'Paste text', ru: 'Вставить текст' },
  flighty: { en: 'Flighty history', ru: 'История из Flighty' },
  nomads: { en: 'Nomads.com trips', ru: 'Поездки из Nomads.com' },
  nomadsBad: {
    en: 'Not a Nomads.com export',
    ru: 'Это не экспорт Nomads.com',
  },
  online: {
    en: 'Documents and text are read online',
    ru: 'Документы и текст распознаются онлайн',
  },
  tooBig: {
    en: 'Over 10 MB',
    ru: 'Больше 10 МБ',
  },
  removeFile: { en: 'Remove file', ru: 'Убрать файл' },
  readText: { en: 'Read text', ru: 'Распознать текст' },
  queued: { en: 'Waiting to read', ru: 'Ожидает чтения' },
  local: { en: 'Reading barcode', ru: 'Чтение штрихкода' },
  onlineReading: { en: 'Reading document online', ru: 'Распознавание документа' },
  ready: { en: 'Ready to review', ru: 'Готово к проверке' },
  empty: { en: 'No flights found', ru: 'Перелёты не найдены' },
  manual: { en: 'Enter manually', ru: 'Ввести вручную' },
  retry: { en: 'Try again', ru: 'Повторить' },
  reselect: {
    en: 'Choose the file again',
    ru: 'Выберите файл заново',
  },
  partial: {
    en: 'Stopped early',
    ru: 'Чтение прервалось',
  },
} as const

type InputKey = 'nomads' | 'file' | 'camera' | 'flighty'
const INPUTS: readonly {
  key: InputKey
  accept: string
  multiple?: boolean
  capture?: 'environment'
  history: boolean
}[] = [
  { key: 'nomads', accept: NOMADS_ACCEPT, history: false },
  {
    key: 'file',
    accept: `${ACCEPT},.csv,text/csv,${NOMADS_ACCEPT}`,
    multiple: true,
    history: true,
  },
  { key: 'camera', accept: 'image/jpeg,image/png', capture: 'environment', history: false },
  { key: 'flighty', accept: '.csv,text/csv', history: true },
]

const PROBLEM: Partial<Record<EntryProblem, { en: string; ru: string }>> = {
  type: S.fileBad,
  nomads: C.nomadsBad,
  size: C.tooBig,
  partial: C.partial,
  reselect: C.reselect,
}

function problemText(entry: SessionEntry, locale: Locale): string {
  const known = entry.problem && PROBLEM[entry.problem]
  if (known) return known[locale]
  const failure = entry.runs.map((run) => failureOf(run.getState())).find((found) => found !== null)
  return failure ? FAILURE[failure.kind][locale].title : S.fileRead[locale]
}

function statusText(entry: SessionEntry, locale: Locale): ReactNode {
  switch (entry.phase) {
    case 'queued':
    case 'local':
      return <TextShimmer>{C[entry.phase][locale]}</TextShimmer>
    case 'online':
      return <TextShimmer>{C.onlineReading[locale]}</TextShimmer>
    case 'failed':
      return problemText(entry, locale)
    default:
      return C[entry.phase][locale]
  }
}

function PasteText({
  locale,
  open,
  saving,
  onRead,
  onPending,
}: {
  locale: Locale
  open: boolean
  saving: boolean
  onRead: (text: string) => void
  onPending: (pending: boolean) => void
}) {
  const [text, setText] = useState('')
  const pending = text.trim().length > 0
  useEffect(() => {
    onPending(pending)
  }, [pending, onPending])
  useEffect(() => () => onPending(false), [onPending])
  if (!open) return null
  return (
    <form
      className="unified-import-text"
      onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim() || saving) return
        onRead(text.trim())
        setText('')
      }}
    >
      <ImportTextarea
        label={C.paste[locale]}
        value={text}
        maxLength={100000}
        disabled={saving}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" disabled={!text.trim() || saving}>
        {C.readText[locale]}
      </Button>
    </form>
  )
}

export function ImportSources({
  locale,
  entries,
  session,
  saving,
  retryReason,
  textOpen,
  onTextOpen,
  onTextPending,
  addFiles,
}: {
  locale: Locale
  entries: readonly SessionEntry[]
  session: UnifiedSession
  saving: boolean
  retryReason?: string
  textOpen: boolean
  onTextOpen: (open: boolean) => void
  onTextPending: (pending: boolean) => void
  addFiles: (files: File[]) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const actions = useRef<HTMLDivElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  const inputs = useRef<Partial<Record<InputKey, HTMLInputElement | null>>>({})
  const hadSources = useRef(entries.length > 0)
  useEffect(() => {
    if (entries.length && !hadSources.current) {
      const active = document.activeElement
      if (active === document.body || actions.current?.contains(active)) {
        moreButton.current?.focus()
      }
    }
    hadSources.current = entries.length > 0
  }, [entries.length])
  const pick = (key: InputKey) => inputs.current[key]?.click()

  return (
    <>
      <div ref={actions} className="unified-import-sources">
        {entries.length ? (
          <Menu
            open={menuOpen && !saving}
            onOpenChange={(open) => setMenuOpen(open && !saving)}
            trigger={
              <Button ref={moreButton} variant="ghost" disabled={saving}>
                {C.moreSources[locale]} <ChevronIcon size={16} aria-hidden="true" />
              </Button>
            }
          >
            <MenuItem disabled={saving} onSelect={() => pick('file')}>
              <Upload size={18} aria-hidden="true" />
              {C.more[locale]}
            </MenuItem>
            <MenuItem disabled={saving} onSelect={() => pick('camera')}>
              <Camera className="unified-import-camera" size={18} aria-hidden="true" />
              {C.photo[locale]}
            </MenuItem>
            <MenuItem disabled={saving} onSelect={() => onTextOpen(true)}>
              <Clipboard size={18} aria-hidden="true" />
              {C.paste[locale]}
            </MenuItem>
          </Menu>
        ) : (
          <div className="import-actions unified-import-source-actions">
            <Button
              variant="primary"
              icon={<Upload size={18} aria-hidden="true" />}
              disabled={saving}
              onClick={() => pick('file')}
            >
              {C.choose[locale]}
            </Button>
            <Button
              className="unified-import-camera"
              icon={<Camera size={18} aria-hidden="true" />}
              disabled={saving}
              onClick={() => pick('camera')}
            >
              {C.photo[locale]}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => onTextOpen(!textOpen)}>
              {C.paste[locale]}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => pick('flighty')}>
              {C.flighty[locale]}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => pick('nomads')}>
              {C.nomads[locale]}
            </Button>
          </div>
        )}
        {INPUTS.map(({ key, accept, multiple, capture, history }) => (
          <input
            key={key}
            ref={(node) => {
              inputs.current[key] = node
            }}
            className="sr-only"
            type="file"
            accept={accept}
            multiple={multiple}
            capture={capture}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              if (history) addFiles(files)
              else session.add(files)
              event.target.value = ''
            }}
          />
        ))}
        <div className="unified-import-notes" data-empty={entries.length ? undefined : true}>
          <p className="import-privacy">
            <Cloud size={16} aria-hidden="true" />
            {C.online[locale]}
          </p>
        </div>
      </div>
      <PasteText
        locale={locale}
        open={textOpen}
        saving={saving}
        onRead={(text) => {
          session.addText(text, C.paste[locale])
          onTextOpen(false)
        }}
        onPending={onTextPending}
      />
      <ul className="unified-import-files" aria-live="polite">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="unified-import-file-name" title={entry.label || S.title[locale]}>
              <span>{(entry.label || S.title[locale]).replace(/\.(pdf|png|jpe?g)$/i, '')}</span>
              <span>{entry.label.match(/\.(pdf|png|jpe?g)$/i)?.[0]}</span>
            </span>
            {entry.nomads && (entry.phase === 'ready' || entry.phase === 'empty') ? (
              <NomadsNote locale={locale} summary={entry.nomads} empty={entry.phase === 'empty'} />
            ) : (
              <span className="import-hint">{statusText(entry, locale)}</span>
            )}
            {entry.phase === 'failed' && entry.problem !== 'type' && entry.problem !== 'size' ? (
              <Button dense disabledReason={retryReason} onClick={() => session.retry(entry)}>
                {C.retry[locale]}
              </Button>
            ) : null}
            {entry.phase === 'failed' && !entry.runs.length ? (
              <Button dense variant="ghost" disabled={saving} onClick={() => session.remove(entry)}>
                {C.removeFile[locale]}
              </Button>
            ) : null}
            {entry.phase === 'empty' ? (
              <Link className="ui-button" data-dense="true" href="/add">
                {C.manual[locale]}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}
