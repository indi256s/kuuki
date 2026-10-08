'use client'
import { IMPORT_MAX_FILE_BYTES } from '@kuuki/shared/constants'

import { FileText, Upload } from 'lucide-react'
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Disclosure } from '../ui/disclosure'
import { SegmentedControl } from '../ui/segmented-control'
import { S } from './copy'
import type { ImportSource } from './import-api'
import { ImportTextarea } from './import-textarea'

export const MAX_FILE_BYTES = IMPORT_MAX_FILE_BYTES
const ACCEPT = 'application/pdf,image/png,image/jpeg'

/** Base64 of the file, built in memory for the request body only. It is never written to browser storage. */
export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

export type FileProblem = 'type' | 'size'
export function checkFile(file: { type: string; size: number }): FileProblem | null {
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) return 'type'
  return file.size > MAX_FILE_BYTES ? 'size' : null
}

export function SourceStep({ locale, busy, initialMode, onSubmit, notice }: {
  locale: Locale
  busy: boolean
  initialMode: 'file' | 'text' | null
  /** The operation id stays the same while the source is unchanged, so a retry never calls the service twice. */
  onSubmit: (source: ImportSource, operationId: string) => void
  notice?: string | null
}) {
  const [mode, setMode] = useState<'file' | 'text'>(initialMode ?? 'file')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<'type' | 'size' | 'read' | 'needFile' | 'needText' | null>(null)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const prompt = useRef<HTMLTextAreaElement>(null)
  const operation = useRef<string | null>(null)
  const dropId = useId()
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(null), 4000); return () => clearTimeout(timer) } }, [copied])

  const choose = (next: File | null | undefined) => {
    operation.current = null
    if (!next) return
    const bad = checkFile(next)
    if (bad) { setFile(null); setProblem(bad); return }
    setFile(next); setProblem(null)
  }
  const onDrop = (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }

  const submit = async () => {
    if (mode === 'file') {
      if (!file) { setProblem('needFile'); return }
      let content: string
      try { content = await fileToBase64(file) } catch { setProblem('read'); return }
      operation.current ??= crypto.randomUUID()
      onSubmit({ type: file.type === 'application/pdf' ? 'pdf' : 'image', content, sourceLabel: file.name }, operation.current)
    } else {
      if (!text.trim()) { setProblem('needText'); return }
      operation.current ??= crypto.randomUUID()
      onSubmit({ type: 'text', content: text }, operation.current)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(S.prompt[locale]); setCopied('ok') } catch {
      // No clipboard permission: the prompt stays on screen, selected, so the member can copy it by hand.
      prompt.current?.focus(); prompt.current?.select(); setCopied('failed')
    }
  }
  const problemText = problem === 'needText' ? null : problem === 'type' ? S.fileBad[locale] : problem === 'size' ? S.fileBig[locale] : problem === 'read' ? S.fileRead[locale]
    : problem === 'needFile' ? S.needFile[locale] : null

  return <section className="import-source" aria-label={S.stepSource[locale]}>
    <SegmentedControl label={S.modeLabel[locale]} value={mode} onChange={next => { setMode(next); setProblem(null) }}
      options={[{ value: 'file', label: S.modeFile[locale] }, { value: 'text', label: S.modeText[locale] }]} />
    {mode === 'file' ? <div className="import-drop-wrap">
      <button type="button" id={dropId} className="import-dropzone" data-dragging={dragging ? 'true' : undefined} disabled={busy}
        onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={onDrop}
        aria-describedby={`${dropId}-hint`}>
        <span className="import-drop-icon" aria-hidden="true">{file ? <FileText size={24} strokeWidth={1.5} /> : <Upload size={24} strokeWidth={1.5} />}</span>
        <span className="import-drop-title">{file ? <><span className="sr-only">{S.dropChosen[locale]}: </span>{file.name}</> : S.dropTitle[locale]}</span>
        <span className="import-drop-hint" id={`${dropId}-hint`}>{file ? S.dropChange[locale] : S.dropHint[locale]}</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={event => { choose(event.target.files?.[0]); event.target.value = '' }} />
    </div> : <ImportTextarea label={S.textLabel[locale]} hint={S.textHint[locale]} rows={7} value={text} disabled={busy}
      error={problem === 'needText' ? S.needText[locale] : undefined}
      onChange={event => { setText(event.target.value); operation.current = null; setProblem(null) }} />}
    <p className="import-problem" role={problemText ? 'alert' : undefined}>{problemText}</p>
    {notice ? <p className="import-hint" role="status">{notice}</p> : null}
    <div className="import-actions">
      <Button variant="primary" loading={busy} loadingLabel={S.finding[locale]} onClick={() => void submit()}>{S.find[locale]}</Button>
    </div>
    <p className="import-privacy">{S.privacy[locale]}</p>
    <Disclosure summary={S.emailHelp[locale]}>
      <div className="import-email-help">
        <p>{S.emailHelpBody[locale]}</p>
        <p>{S.importLimit[locale]}</p>
        <ImportTextarea ref={prompt} className="import-prompt" readOnly rows={8} label={S.promptLabel[locale]} value={S.prompt[locale]} />
        <div className="import-actions"><Button morphText textAlternatives={[S.copyPrompt[locale], locale === 'ru' ? 'Скопировано' : 'Copied']} onClick={() => void copy()}>{copied === 'ok' ? (locale === 'ru' ? 'Скопировано' : 'Copied') : S.copyPrompt[locale]}</Button></div>
        <p className="import-hint" role="status">{copied === 'ok' ? S.copied[locale] : copied === 'failed' ? S.copyFailed[locale] : ''}</p>
      </div>
    </Disclosure>
  </section>
}
