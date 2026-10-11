'use client'

import { CircleAlert } from '@keyline-icons/react'
import { useEffect, useRef } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { ACTION, FAILURE, S, UNFINISHED_EMPTY, UNFINISHED_ITEM, relativeInstant } from './copy'
import type { Failure, FailureAction } from './import-errors'
import type { UnfinishedImport } from './import-types'

/** A stated cause with its own actions. It replaces the review: it is never rendered beside empty-review copy. */
export function FailurePanel({
  failure,
  locale,
  onAction,
  unfinished,
  headingId = 'import-failure',
}: {
  failure: Failure
  locale: Locale
  onAction: (action: FailureAction) => void
  unfinished?: UnfinishedImport[] | null
  headingId?: string
}) {
  const copy = FAILURE[failure.kind][locale]
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [failure.kind])
  return (
    <section className="import-failure" role="alert" aria-labelledby={headingId}>
      <CircleAlert size={20} strokeWidth={2} aria-hidden="true" className="import-failure-icon" />
      <div className="import-failure-body">
        <h2 id={headingId} ref={heading} tabIndex={-1}>
          {copy.title}
        </h2>
        <p>{copy.body}</p>
        {failure.retryAt ? (
          <p>
            {S.retryAt[locale]}{' '}
            <time dateTime={failure.retryAt}>{relativeInstant(locale, failure.retryAt)}</time>.
          </p>
        ) : null}
        {failure.kind === 'nothing' ? (
          <p>
            <strong>{S.tipsTitle[locale]}.</strong> {S.tips[locale]}
          </p>
        ) : null}
        <div className="import-actions">
          {failure.actions.map((action) => (
            <Button
              key={action}
              variant={action === failure.actions[0] ? 'primary' : 'secondary'}
              onClick={() => onAction(action)}
            >
              {ACTION[action][locale]}
            </Button>
          ))}
        </div>
        {unfinished ? (
          unfinished.length === 0 ? (
            <p role="status">{UNFINISHED_EMPTY[locale]}</p>
          ) : (
            <ul className="import-unfinished">
              {unfinished.map((item) => (
                <li key={item.batchId}>
                  <a
                    className="ui-button"
                    data-variant="secondary"
                    href={`/import?batch=${item.batchId}`}
                  >
                    {UNFINISHED_ITEM[locale]}
                    {item.sourceLabel ? `: ${item.sourceLabel}` : ''}
                  </a>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  )
}
