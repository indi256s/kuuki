'use client'

// Quick Add source step: two equal ways to bring a boarding pass in, then a local barcode read. A readable pass goes to
// the server as flight fields only; anything else is offered as an upload for online recognition, after the member has
// been told the document will leave the device. The file lives in this component's state and is never stored.
import { Camera, FileArrowUp } from '@keyline-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { Locale } from '../../lib/format'
import { NavigationLink as Link } from '../navigation-link'
import { Button } from '../ui/button'
import { readBoardingPass, prefetchReader, type NoneReason } from './barcode-reader'
import { S } from './copy'
import { FileDropzone } from './file-dropzone'
import type { DocumentSource, ImportSource } from './import-api'
import { ACCEPT, checkFile, fileToBase64, type FileProblem } from './source-step'

// The camera input only offers still images; the file inputs take SourceStep's list.
const PHOTO_ACCEPT = 'image/jpeg,image/png'

type Problem = FileProblem | 'read'
const PROBLEM: Record<Problem, 'fileBad' | 'fileBig' | 'fileRead'> = {
  type: 'fileBad',
  size: 'fileBig',
  read: 'fileRead',
}
const REASON: Record<NoneReason, 'qaNoBarcode' | 'qaNotPass' | 'qaUnsupported'> = {
  'no-barcode': 'qaNoBarcode',
  'not-boarding-pass': 'qaNotPass',
  unsupported: 'qaUnsupported',
  failed: 'qaUnsupported',
}

/** The online-recognition body for a file: its base64 lives only in this request, and the flown question is required. */
export async function uploadSource(file: File): Promise<DocumentSource> {
  return {
    type: file.type === 'application/pdf' ? 'pdf' : 'image',
    content: await fileToBase64(file),
    sourceLabel: file.name,
    requireFlownConfirmation: true,
  }
}

/** What the member is told before anything is uploaded, and the one action that uploads. */
export function UploadFallback({
  locale,
  intro,
  uploading,
  disabled,
  onUpload,
  onOther,
}: {
  locale: Locale
  intro: string
  uploading: boolean
  disabled?: boolean
  onUpload: () => void
  onOther?: () => void
}) {
  return (
    <div className="quick-add-fallback" data-testid="quick-add-fallback">
      <p>{intro}</p>
      <p className="import-privacy">{S.qaUploadNote[locale]}</p>
      <div className="import-actions">
        <Button
          variant="primary"
          loading={uploading}
          loadingLabel={S.qaUploading[locale]}
          disabled={disabled}
          onClick={onUpload}
        >
          {S.qaUpload[locale]}
        </Button>
        {onOther ? <Button onClick={onOther}>{S.dropChange[locale]}</Button> : null}
      </div>
    </div>
  )
}

export function QuickAddSource({
  locale,
  onSubmit,
  onGeneral,
  notice,
}: {
  locale: Locale
  /** The operation id stays the same while the source is unchanged. `file` stays in memory for a later upload. */
  onSubmit: (source: ImportSource, operationId: string, file: File) => void
  /** Switch to the general file/text import. */
  onGeneral: () => void
  notice?: string | null
}) {
  const [file, setFile] = useState<File | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [state, setState] = useState<'idle' | 'reading' | 'none'>('idle')
  const [reason, setReason] = useState<NoneReason>('failed')
  const [uploading, setUploading] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // A new revision starts at every choose/remove; answers that arrive for an older one are dropped.
  const revision = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const uploadingNow = useRef(false)
  const readOperation = useRef<string | null>(null)
  const uploadOperation = useRef<string | null>(null)

  useEffect(() => {
    mounted.current = true
    void prefetchReader()
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])

  const choose = (next: File | null | undefined) => {
    revision.current += 1
    controller.current?.abort()
    controller.current = null
    readOperation.current = null
    uploadOperation.current = null
    setProblem(null)
    if (!next) {
      setFile(null)
      setState('idle')
      return
    }
    const bad = checkFile(next)
    if (bad) {
      setFile(null)
      setState('idle')
      setProblem(bad)
      return
    }
    setFile(next)
    setState('reading')
    const own = revision.current
    const abort = new AbortController()
    controller.current = abort
    const current = () => mounted.current && own === revision.current && !abort.signal.aborted
    readBoardingPass(next, { signal: abort.signal }).then(
      (outcome) => {
        if (!current()) return
        if (outcome.kind === 'legs') {
          readOperation.current ??= crypto.randomUUID()
          onSubmit(
            {
              type: 'boarding_pass',
              source: next.type === 'application/pdf' ? 'pdf' : 'image',
              sourceLabel: next.name,
              legs: outcome.legs,
              incomplete: outcome.incomplete || undefined,
            },
            readOperation.current,
            next,
          )
          return
        }
        setReason(outcome.reason)
        setState('none')
      },
      () => {
        // An abort is a replacement or a removal and says nothing; anything else is a read this browser could not do.
        if (!current()) return
        setReason('failed')
        setState('none')
      },
    )
  }

  const upload = async () => {
    if (!file || uploadingNow.current) return
    const own = revision.current
    uploadingNow.current = true
    setUploading(true)
    let source: DocumentSource
    try {
      source = await uploadSource(file)
    } catch {
      if (mounted.current && own === revision.current) setProblem('read')
      return
    } finally {
      uploadingNow.current = false
      if (mounted.current) setUploading(false)
    }
    if (!mounted.current || own !== revision.current) return
    uploadOperation.current ??= crypto.randomUUID()
    onSubmit(source, uploadOperation.current, file)
  }

  const pick = (input: HTMLInputElement) => {
    const chosen = input.files?.[0]
    // Cancelling the camera or the picker delivers no file: nothing is created and the current choice stays.
    if (chosen) choose(chosen)
    input.value = ''
  }

  return (
    <section className="import-source" aria-label={S.stepSource[locale]}>
      <div className="quick-add-actions" role="group" aria-label={S.qaActionsLabel[locale]}>
        <Button
          icon={<Camera size={18} strokeWidth={2} aria-hidden="true" />}
          onClick={() => photoInput.current?.click()}
        >
          {S.qaPhoto[locale]}
        </Button>
        <Button
          icon={<FileArrowUp size={18} strokeWidth={2} aria-hidden="true" />}
          onClick={() => fileInput.current?.click()}
        >
          {S.qaChoose[locale]}
        </Button>
        {/* The buttons are the controls; these only receive the browser's picker result. */}
        <input
          ref={photoInput}
          className="sr-only"
          type="file"
          accept={PHOTO_ACCEPT}
          capture="environment"
          tabIndex={-1}
          aria-hidden="true"
          data-quick-add="photo"
          onChange={(event) => pick(event.target)}
        />
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept={ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          data-quick-add="file"
          onChange={(event) => pick(event.target)}
        />
      </div>
      <div className="quick-add-drop" data-empty={file ? undefined : 'true'}>
        <FileDropzone
          file={file}
          accept={ACCEPT}
          disabled={false}
          locale={locale}
          onFilesChange={(files) => choose(files[0])}
        />
      </div>
      <p className="import-hint" role="status">
        {/* The outcome of a read that found no pass is announced here once; the fallback below stays silent. */}
        {state === 'reading'
          ? S.qaReading[locale]
          : state === 'none'
            ? S[REASON[reason]][locale]
            : ''}
      </p>
      <p className="import-problem" role={problem ? 'alert' : undefined}>
        {problem ? S[PROBLEM[problem]][locale] : null}
      </p>
      {state === 'none' ? (
        <UploadFallback
          locale={locale}
          intro={S[REASON[reason]][locale]}
          uploading={uploading}
          onUpload={() => void upload()}
          onOther={() => choose(null)}
        />
      ) : null}
      {notice ? (
        <p className="import-hint" role="status">
          {notice}
        </p>
      ) : null}
      <p className="import-privacy">{S.qaLocalNote[locale]}</p>
      <div className="import-actions">
        <Link href="/add" className="ui-button" data-variant="ghost">
          {S.qaManual[locale]}
        </Link>
        <button type="button" className="ui-button" data-variant="ghost" onClick={onGeneral}>
          {S.qaGeneral[locale]}
        </button>
      </div>
    </section>
  )
}
