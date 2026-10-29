'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import type { AirportModelV1, CameraPose } from '../../../lib/airport-models/model'
import type {
  AirportViewerHandle,
  RendererController,
  ViewerCallbacks,
  ViewerState,
  ViewerStatus,
} from './types'
import './viewer.css'

export type AirportViewerProps = ViewerCallbacks & {
  model: AirportModelV1
  initialPose: CameraPose
  state: ViewerState
  /** false retires GPU resources; caller retains detail state for later remount. */
  active?: boolean
  /** Parent supplies the prepared preview; it remains visible until the first successful frame. */
  fallback: ReactNode
  className?: string
}

export const AirportViewer = forwardRef<AirportViewerHandle, AirportViewerProps>(
  function AirportViewer(
    {
      model,
      initialPose,
      state,
      active = true,
      fallback,
      className,
      onPoseChange,
      onSelection,
      onHover,
      onStatus,
    },
    ref,
  ) {
    const host = useRef<HTMLDivElement>(null),
      controller = useRef<RendererController | null>(null)
    const latest = useRef({ state, onPoseChange, onSelection, onHover, onStatus })
    const [attempt, setAttempt] = useState(0)
    const [status, setStatus] = useState<ViewerStatus>('loading')
    useEffect(() => {
      latest.current = { state, onPoseChange, onSelection, onHover, onStatus }
      controller.current?.update(state)
    }, [state, onPoseChange, onSelection, onHover, onStatus])
    useImperativeHandle(
      ref,
      () => ({
        zoom: (factor) => controller.current?.zoom(factor),
        reset: () => controller.current?.reset(),
        focusFeature: (id) => controller.current?.focusFeature(id),
        retry: () => setAttempt((value) => value + 1),
      }),
      [],
    )
    useEffect(() => {
      if (!active || !host.current) return
      let retired = false
      const target = host.current
      const canvas = document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      target.appendChild(canvas)
      const report = (next: ViewerStatus) => {
        if (retired) return
        setStatus(next)
        latest.current.onStatus?.(next)
      }
      const stop = () => {
        retired = true
        controller.current?.dispose()
        controller.current = null
        canvas.remove()
      }
      window.addEventListener('kuuki:identity-reset', stop)
      report('loading')
      void import('./renderer')
        .then(({ createAirportRenderer }) => {
          if (retired) return
          controller.current = createAirportRenderer({
            canvas,
            model,
            initialPose,
            state: latest.current.state,
            callbacks: {
              onPoseChange: (pose) => latest.current.onPoseChange(pose),
              onSelection: (id) => latest.current.onSelection(id),
              onHover: (hit) => latest.current.onHover?.(hit),
              onStatus: report,
            },
          })
        })
        .catch(() => report('error'))
      return () => {
        stop()
        window.removeEventListener('kuuki:identity-reset', stop)
      }
    }, [model, initialPose, active, attempt])
    const ready = active && status === 'ready'
    return (
      <div
        className={['airport-viewer', className].filter(Boolean).join(' ')}
        data-status={active ? status : 'inactive'}
      >
        <div className="airport-viewer-fallback" hidden={ready}>
          {fallback}
        </div>
        <div
          className="airport-viewer-canvas"
          ref={host}
          style={{ visibility: ready ? 'visible' : 'hidden' }}
        />
      </div>
    )
  },
)
