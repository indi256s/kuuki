'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { Check, X } from '@keyline-icons/react'
import { Button } from './button'
import './arc-interactions.css'

// Adapted from Arc "inline-edit" (uiarc.dev, MIT, see ARC-LICENSE.txt): the idle display button that turns into a field with Save and Cancel
// beside it, plus the screen-reader hints. Arc's own state machine is not used: it saves optimistically and on blur. Here Enter or Save sends
// the draft, blur and Escape never do, and the draft survives every rejection.

/** Rejected: the server answered no (draft stays, field shows why). Unknown: the request may or may not have landed (draft stays, outcome is not claimed). */
export type InlineEditOutcome =
  | { status: 'saved' }
  | { status: 'rejected'; message: string }
  | { status: 'unknown'; message: string }

export type InlineEditFieldProps = {
  value: string
  onChange: (value: string) => void
  inputRef: Ref<HTMLInputElement>
  error?: string
  disabled: boolean
}

export type InlineEditCopy = {
  /** Names the field group: "Aircraft". */
  group: string
  save: string
  cancel: string
  saving: string
  /** "Enter saves, Escape cancels." */
  hint: string
  /** Shown when the save callback throws instead of answering. */
  unknown: string
  /** Optional escape hatch to the full form. */
  fullEditor?: string
}

export type InlineEditProps = {
  /** The saved value; a new value from outside replaces the display while the editor is closed. */
  value: string
  display: ReactNode
  /** Accessible name of the idle trigger: names the current value and the record. */
  triggerLabel: string
  /** An empty value renders the trigger as a dense Button ("Add aircraft") instead of an inline value. */
  empty?: boolean
  copy: InlineEditCopy
  editing: boolean
  onEditingChange: (editing: boolean) => void
  renderField: (props: InlineEditFieldProps) => ReactNode
  onSave: (draft: string) => Promise<InlineEditOutcome>
  onFullEditor?: () => void
  /** Blocks starting and saving; the reason must already be visible and is linked from the controls. */
  disabled?: boolean
  disabledReasonId?: string
  className?: string
}

/** Keeps the caller's render function out of InlineEdit's own render, where its handlers and refs are not readable. */
function FieldSlot({
  render,
  ...props
}: InlineEditFieldProps & { render: (props: InlineEditFieldProps) => ReactNode }) {
  return <>{render(props)}</>
}

export function InlineEdit({
  value,
  display,
  triggerLabel,
  empty,
  copy,
  editing,
  onEditingChange,
  renderField,
  onSave,
  onFullEditor,
  disabled,
  disabledReasonId,
  className,
}: InlineEditProps) {
  const [draft, setDraft] = useState(value)
  const [problem, setProblem] = useState<{ kind: 'rejected' | 'unknown'; message: string } | null>(
    null,
  )
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  // Enter only saves after the draft was touched, so opening the field and pressing Enter never picks the highlighted suggestion.
  const touched = useRef(false)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const editor = useRef<HTMLDivElement | null>(null)
  const saveOwnsFocus = useRef(false)
  const field = useRef<HTMLInputElement | null>(null)
  const wanted = useRef<'field' | 'trigger' | null>(null)
  const hintId = useId()
  const reasonDescribedBy = disabled ? disabledReasonId : undefined

  // Late-mounting fields (a lazily loaded picker) take the requested focus the moment they attach.
  const fieldRef = useCallback((node: HTMLInputElement | null) => {
    field.current = node
    if (node && wanted.current === 'field') {
      wanted.current = null
      node.focus()
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    const moved = () => {
      if (
        document.activeElement !== document.body &&
        !editor.current?.contains(document.activeElement)
      )
        saveOwnsFocus.current = false
    }
    document.addEventListener('focusin', moved)
    return () => document.removeEventListener('focusin', moved)
  }, [])
  const ownsSaveFocus = useCallback(
    () =>
      saveOwnsFocus.current &&
      (document.activeElement === document.body ||
        !!editor.current?.contains(document.activeElement)),
    [],
  )
  useEffect(() => {
    if (wanted.current === 'field' && editing && field.current) {
      wanted.current = null
      field.current.focus()
    } else if (wanted.current === 'trigger' && !editing && trigger.current) {
      wanted.current = null
      trigger.current.focus()
    }
  })
  // The canonical row arrived with the draft already in it (an unknown outcome reconciled): the edit is done.
  useEffect(() => {
    if (editing && !saving && problem?.kind === 'unknown' && draft === value) {
      wanted.current = ownsSaveFocus() ? 'trigger' : null
      onEditingChange(false)
    }
  }, [editing, saving, problem, draft, value, onEditingChange, ownsSaveFocus])

  const start = () => {
    if (disabled || inFlight.current) return
    touched.current = false
    setDraft(value)
    setProblem(null)
    wanted.current = 'field'
    onEditingChange(true)
  }
  const cancel = () => {
    if (inFlight.current) return
    wanted.current = 'trigger'
    setProblem(null)
    onEditingChange(false)
  }
  const submit = async () => {
    if (inFlight.current || disabled || !editing) return
    const next = draft.trim()
    if (next === value) {
      cancel()
      return
    } // nothing was changed on purpose: no request
    // Disabling the focused input can move native focus to body before the response arrives.
    saveOwnsFocus.current = !!editor.current?.contains(document.activeElement)
    inFlight.current = true
    setSaving(true)
    setProblem(null)
    let outcome: InlineEditOutcome
    try {
      outcome = await onSave(next)
    } catch {
      outcome = { status: 'unknown', message: copy.unknown }
    }
    inFlight.current = false
    if (!mounted.current) return
    setSaving(false)
    const ownsFocus = ownsSaveFocus()
    if (outcome.status === 'saved') {
      wanted.current = ownsFocus ? 'trigger' : null
      onEditingChange(false)
    } else {
      wanted.current = ownsFocus ? 'field' : null
      touched.current = false
      setProblem({ kind: outcome.status, message: outcome.message })
    } // the next plain Enter retries this draft
  }
  const change = (next: string) => {
    touched.current = true
    setDraft(next)
    setProblem(null)
  }

  const captureKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') touched.current = true
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      !(event.target as HTMLElement).closest('button')
    ) {
      if (saving) {
        event.preventDefault()
        return
      }
      // Untouched draft: keep the field's own Enter (it would choose the highlighted suggestion) out of it.
      if (!touched.current) {
        event.preventDefault()
        event.stopPropagation()
        void submit()
      }
    }
    if (event.key === 'Escape' && saving) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  const bubbleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return
    // The field consumes Enter and Escape while its suggestion list is open; whatever reaches here is the deliberate second press.
    if (event.key === 'Enter' && !(event.target as HTMLElement).closest('button')) {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
    }
  }

  if (!editing) {
    const common = {
      'aria-label': triggerLabel,
      'aria-describedby': reasonDescribedBy,
      onClick: start,
    }
    return (
      <div className={['arc-inline', className].filter(Boolean).join(' ')} data-editing="false">
        {empty ? (
          <Button ref={trigger} dense disabled={disabled} {...common}>
            {display}
          </Button>
        ) : (
          <button
            ref={trigger}
            type="button"
            className="arc-inline-trigger"
            aria-disabled={disabled || undefined}
            {...common}
            onClick={disabled ? (event) => event.preventDefault() : start}
          >
            {display}
          </button>
        )}
      </div>
    )
  }
  const unknown = problem?.kind === 'unknown'
  return (
    <div className={['arc-inline', className].filter(Boolean).join(' ')} data-editing="true">
      <div
        ref={editor}
        className="arc-inline-editor"
        role="group"
        aria-label={copy.group}
        aria-describedby={hintId}
        data-saving={saving || undefined}
        onKeyDownCapture={captureKeys}
        onKeyDown={bubbleKeys}
      >
        <FieldSlot
          render={renderField}
          value={draft}
          onChange={change}
          inputRef={fieldRef}
          error={problem?.kind === 'rejected' ? problem.message : undefined}
          disabled={saving}
        />
        <div className="arc-inline-actions">
          <button
            type="button"
            className="arc-inline-icon"
            data-role="save"
            aria-label={copy.save}
            aria-disabled={saving || disabled || undefined}
            aria-describedby={reasonDescribedBy}
            onClick={() => void submit()}
          >
            <Check size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="arc-inline-icon"
            data-role="cancel"
            aria-label={copy.cancel}
            aria-disabled={saving || undefined}
            onClick={cancel}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          {onFullEditor && copy.fullEditor && (
            <Button dense disabled={saving} onClick={onFullEditor}>
              {copy.fullEditor}
            </Button>
          )}
        </div>
        {saving && (
          <p role="status" className="arc-inline-status">
            {copy.saving}
          </p>
        )}
        {unknown && (
          <p role="alert" className="arc-inline-unknown">
            {problem.message}
          </p>
        )}
        <span id={hintId} className="arc-sr-only">
          {copy.hint}
        </span>
      </div>
    </div>
  )
}
