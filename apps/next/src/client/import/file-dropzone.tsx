'use client'

import { ArrowUp, FileImage, FileText, X } from '@keyline-icons/react'
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import type { Locale } from '../../lib/format'
import { S } from './copy'
import styles from './file-dropzone.module.css'

function Thumb({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [broken, setBroken] = useState<File | null>(null)
  useEffect(() => {
    const image = imageRef.current
    if (!image || !file.type.startsWith('image/') || typeof URL.createObjectURL !== 'function')
      return
    const url = URL.createObjectURL(file)
    image.src = url
    return () => {
      image.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [file])
  if (
    !file.type.startsWith('image/') ||
    broken === file ||
    typeof URL.createObjectURL !== 'function'
  )
    return (
      <span className={styles.fileIcon}>
        {file.type === 'application/pdf' ? (
          <FileText aria-hidden="true" size={20} />
        ) : (
          <FileImage aria-hidden="true" size={20} />
        )}
      </span>
    )
  return (
    <span className={styles.thumb}>
      {/* Object URLs stay local and are revoked on replacement/unmount. */}
      {/* oxlint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        alt=""
        width={40}
        height={40}
        decoding="async"
        onError={() => setBroken(file)}
      />
    </span>
  )
}

// Arc FileDropzone, MIT (../ui/ARC-LICENSE.txt), manually adapted from https://uiarc.dev/r/file-dropzone.json.
// Keep its selection/thumbnail/removal, sheet-stack composition, drag-depth and clipboard lifecycle;
// Kuuki owns validation/submission. motion/react is omitted. By default it picks one document and lists it;
// `multiple` hands every picked or dropped file to the caller, which renders its own per-file rows.
export function FileDropzone({
  file = null,
  accept,
  disabled,
  locale,
  onFilesChange,
  multiple = false,
  paste = true,
  title,
  hint,
  note,
}: {
  file?: File | null
  accept: string
  disabled: boolean
  locale: Locale
  onFilesChange: (files: File[]) => void
  /** Several files per pick or drop; the dropzone then lists nothing, the caller owns the rows. */
  multiple?: boolean
  /** Take an image pasted anywhere on the page. A page with other paste targets turns it off. */
  paste?: boolean
  /** Replace the default title, hint and note. `note: null` removes the note line. */
  title?: string
  hint?: string
  note?: string | null
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLButtonElement>(null)
  const dragDepth = useRef(0)
  const descriptionId = useId(),
    noteId = useId()

  useEffect(() => {
    if (disabled || !paste) return
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            'input:not([type=file]), textarea, [contenteditable]:not([contenteditable=false])',
          ))
      )
        return
      const data = event.clipboardData
      const image =
        Array.from(data?.files ?? []).find((item) => item.type.startsWith('image/')) ??
        Array.from(data?.items ?? [])
          .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
          ?.getAsFile()
      if (!image) return
      event.preventDefault()
      onFilesChange([image])
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [disabled, paste, onFilesChange])

  const carriesFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files')
  const remove = () => {
    onFilesChange([])
    dropRef.current?.focus()
  }
  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${file ? styles.compact : ''}`}
        onDragEnter={(event) => {
          if (disabled || !carriesFiles(event)) return
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => {
          if (disabled || !carriesFiles(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(event) => {
          if (!carriesFiles(event)) return
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (!dragDepth.current) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          const dropped = Array.from(event.dataTransfer.files)
          if (!disabled && dropped.length) onFilesChange(multiple ? dropped : [dropped[0]!])
        }}
      >
        <button
          ref={dropRef}
          type="button"
          className={styles.trigger}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          aria-describedby={note === null ? descriptionId : `${descriptionId} ${noteId}`}
        >
          <span className={styles.sheets} aria-hidden="true">
            <span className={styles.sheet} data-sheet="back" />
            <span className={styles.sheet} data-sheet="side" />
            <span className={styles.sheet} data-sheet="front">
              <ArrowUp size={14} strokeWidth={2} />
            </span>
          </span>
          <strong className={styles.label}>
            {dragging
              ? S.dropNow[locale]
              : file
                ? S.dropChange[locale]
                : (title ?? S.dropTitle[locale])}
          </strong>
          <span id={descriptionId} className={styles.hint}>
            {hint ?? S.dropHint[locale]}
          </span>
          {note === null ? null : (
            <small id={noteId} className={styles.note}>
              {note ?? S.dropPaste[locale]}
            </small>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? [])
          if (picked.length) onFilesChange(multiple ? picked : [picked[0]!])
          event.target.value = ''
        }}
      />
      {file ? (
        <ul
          className={styles.list}
          aria-label={S.dropChosen[locale]}
          onKeyDown={(event) => {
            if (
              !disabled &&
              (event.key === 'Delete' || event.key === 'Backspace') &&
              event.target instanceof HTMLElement &&
              event.target.closest('button')
            ) {
              event.preventDefault()
              remove()
            }
          }}
        >
          <li className={styles.row}>
            <Thumb file={file} />
            <span className={styles.copy}>
              <span className={styles.name}>{file.name}</span>
              <span className={styles.meta}>
                {new Intl.NumberFormat(locale, {
                  style: 'unit',
                  unit: file.size < 1024 * 1024 ? 'kilobyte' : 'megabyte',
                  maximumFractionDigits: 1,
                }).format(file.size / (file.size < 1024 * 1024 ? 1024 : 1024 * 1024))}
              </span>
            </span>
            <button
              type="button"
              className={styles.remove}
              disabled={disabled}
              onClick={remove}
              aria-label={`${S.dropRemove[locale]} ${file.name}`}
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
        </ul>
      ) : null}
      <span className="sr-only" role="status">
        {file ? `${S.dropChosen[locale]}: ${file.name}` : ''}
      </span>
    </div>
  )
}
