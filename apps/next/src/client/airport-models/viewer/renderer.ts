import {
  AmbientLight,
  DirectionalLight,
  OrthographicCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three'
import { applyCamera, focusPose } from './camera'
import { buildAirportScene, type ScenePalette } from './scene'
import { attachPointers } from './pointers'
import type { RendererController, RendererOptions, ViewerState } from './types'

function readPalette(canvas: HTMLCanvasElement): ScenePalette {
  const probe = document.createElement('span')
  probe.hidden = true
  canvas.appendChild(probe)
  const token = (name: string) => {
    probe.style.color = `var(${name})`
    return getComputedStyle(probe).color
  }
  const palette = {
    background: token('--background'),
    base: token('--surface-inset'),
    pavement: token('--mark-rest'),
    runway: token('--text-muted'),
    building: token('--brand-neutral'),
    line: token('--text-muted'),
    selected: token('--accent-text'),
  }
  probe.remove()
  return palette
}

/** No animation loop: one coalesced frame only after a state/size/visibility change. */
export function createAirportRenderer(options: RendererOptions): RendererController {
  const { canvas, model, initialPose, callbacks } = options
  let state: ViewerState = options.state
  let disposed = false,
    frame: number | null = null,
    inView = true
  let lastWidth = 0,
    lastHeight = 0,
    lastDpr = 0
  let ready = false
  let hoverTimer: ReturnType<typeof setTimeout> | undefined
  let hoverId: string | null = null,
    hoverShown = false
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  })
  const scene = new Scene(),
    camera = new OrthographicCamera()
  const palette = readPalette(canvas),
    airport = buildAirportScene(model, palette)
  renderer.setClearColor(palette.background)
  scene.add(airport.root, new AmbientLight('white', 2))
  const light = new DirectionalLight('white', 2)
  light.position.set(-1, 3, 2)
  scene.add(light)
  const distance = Math.max(
    1000,
    Math.hypot(model.boundsM[2] - model.boundsM[0], model.boundsM[3] - model.boundsM[1]) * 4,
  )
  const raycaster = new Raycaster()
  const dimensions = () => ({
    width: Math.max(1, canvas.clientWidth),
    height: Math.max(1, canvas.clientHeight),
  })
  const cancelFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }
  const render = () => {
    frame = null
    if (disposed || document.hidden || !inView) return
    try {
      const { width, height } = dimensions()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (width !== lastWidth || height !== lastHeight || dpr !== lastDpr) {
        if (dpr !== lastDpr) renderer.setPixelRatio(dpr)
        renderer.setSize(width, height, false)
        lastWidth = width
        lastHeight = height
        lastDpr = dpr
      }
      applyCamera(camera, state.pose, width, height, distance)
      airport.root.updateMatrixWorld(true)
      renderer.render(scene, camera)
      if (!ready) {
        ready = true
        callbacks.onStatus?.('ready')
      }
    } catch {
      fail()
    }
  }
  const requestRender = () => {
    if (!disposed && !document.hidden && inView && frame === null)
      frame = requestAnimationFrame(render)
  }
  const clearHover = () => {
    clearTimeout(hoverTimer)
    hoverId = null
    hoverShown = false
    callbacks.onHover?.(null)
  }
  const hit = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    applyCamera(camera, state.pose, rect.width, rect.height, distance)
    airport.root.updateMatrixWorld(true)
    raycaster.setFromCamera(
      new Vector2(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2),
      camera,
    )
    const meshes = [...airport.objects.values()]
      .filter((item) => item.group.visible)
      .flatMap((item) => item.meshes)
    // Exact visible geometry only: no screen-space widening that can select a neighbouring stand.
    const hits = raycaster.intersectObjects(meshes, false)
    const first = hits[0]
    if (!first) return null
    const id = String(first.object.userData.featureId)
    // Coplanar overlapping IDs have no visual ordering; require the explicit object list.
    if (
      hits.some(
        (other) =>
          Math.abs(other.distance - first.distance) < 0.001 &&
          other.object.userData.featureId !== id,
      )
    )
      return null
    return id
  }
  const change = (pose: ViewerState['pose']) => {
    if (disposed) return
    state = { ...state, pose }
    callbacks.onPoseChange(pose)
    requestRender()
  }
  const zoom = (factor: number) => {
    if (!Number.isFinite(factor) || factor <= 0) return
    change({
      ...state.pose,
      verticalSpanM: Math.max(40, Math.min(distance, state.pose.verticalSpanM / factor)),
    })
  }
  const detachPointers = attachPointers(canvas, {
    pose: () => state.pose,
    change,
    zoom,
    tap: (x, y) => {
      if (!disposed) callbacks.onSelection(hit(x, y))
    },
    hover: (position) => {
      if (disposed) return
      if (!position) {
        clearHover()
        return
      }
      const id = hit(position.x, position.y)
      if (!id) {
        clearHover()
        return
      }
      if (id === hoverId) return
      const immediate = hoverShown
      clearTimeout(hoverTimer)
      hoverId = id
      const show = () => {
        if (disposed) return
        hoverShown = true
        const rect = canvas.getBoundingClientRect()
        callbacks.onHover?.({ id, x: position.x - rect.left, y: position.y - rect.top })
      }
      if (immediate) show()
      else hoverTimer = setTimeout(show, 250)
    },
  })
  const resize = new ResizeObserver(requestRender)
  resize.observe(canvas)
  const intersection =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          inView = entries[0]?.isIntersecting ?? true
          if (inView) requestRender()
          else {
            cancelFrame()
            clearHover()
          }
        })
  intersection?.observe(canvas)
  const visibility = () => {
    if (document.hidden) {
      cancelFrame()
      clearHover()
    } else requestRender()
  }
  const theme = new MutationObserver(() => {
    const next = readPalette(canvas)
    airport.setPalette(next)
    renderer.setClearColor(next.background)
    requestRender()
  })
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-accent', 'style', 'class'],
  })
  const dispose = () => {
    if (disposed) return
    disposed = true
    cancelFrame()
    clearHover()
    detachPointers()
    resize.disconnect()
    intersection?.disconnect()
    theme.disconnect()
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('kuuki:identity-reset', dispose)
    canvas.removeEventListener('webglcontextlost', lost)
    airport.dispose()
    scene.clear()
    renderer.dispose()
    renderer.forceContextLoss()
  }
  const fail = () => {
    dispose()
    callbacks.onStatus?.('error')
  }
  const lost = (event: Event) => {
    event.preventDefault()
    fail()
  }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('kuuki:identity-reset', dispose)
  canvas.addEventListener('webglcontextlost', lost)
  airport.update(state.layers, state.selectedFeatureId)
  requestRender()
  return {
    update(next) {
      if (disposed) return
      state = next
      airport.update(state.layers, state.selectedFeatureId)
      requestRender()
    },
    zoom,
    reset: () => change({ ...initialPose, targetM: [...initialPose.targetM] }),
    focusFeature(id) {
      if (disposed) return
      const feature = airport.objects.get(id)?.feature
      if (feature) {
        const { width, height } = dimensions()
        change(focusPose(feature, state.pose, width, height, state.visibleInsets))
      }
    },
    dispose,
  }
}
