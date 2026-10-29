import type { CameraPose } from '../../../lib/airport-models/model'

type Position = { x: number; y: number }
type Pointer = Position & { startX: number; startY: number }
type PointerOptions = {
  pose: () => CameraPose
  change: (pose: CameraPose) => void
  zoom: (factor: number) => void
  tap: (x: number, y: number) => void
  hover: (position: Position | null) => void
}

/** A second pointer suppresses selection until every pointer is released. */
export function attachPointers(canvas: HTMLCanvasElement, options: PointerOptions) {
  const pointers = new Map<number, Pointer>()
  let dragged = false,
    multiple = false
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (!pointers.size) {
      dragged = false
      multiple = false
    }
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    })
    if (pointers.size > 1) multiple = true
    options.hover(null)
    canvas.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent) => {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) {
      if (event.pointerType !== 'touch' && !pointers.size)
        options.hover({ x: event.clientX, y: event.clientY })
      return
    }
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y
    const before = [...pointers.values()]
    const previousDistance =
      before.length === 2 ? Math.hypot(before[0]!.x - before[1]!.x, before[0]!.y - before[1]!.y) : 0
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6)
      dragged = true
    pointer.x = event.clientX
    pointer.y = event.clientY
    if (pointers.size === 2) {
      const after = [...pointers.values()]
      const distance = Math.hypot(after[0]!.x - after[1]!.x, after[0]!.y - after[1]!.y)
      if (previousDistance > 0 && distance > 0) options.zoom(distance / previousDistance)
      const pose = options.pose(),
        metres = pose.verticalSpanM / Math.max(1, canvas.clientHeight)
      const x = (-dx / 2) * metres,
        y = ((dy / 2) * metres) / Math.sin(pose.elevation)
      options.change({
        ...pose,
        targetM: [
          pose.targetM[0] + x * Math.cos(pose.azimuth) + y * Math.sin(pose.azimuth),
          pose.targetM[1] - x * Math.sin(pose.azimuth) + y * Math.cos(pose.azimuth),
        ],
      })
    } else if (pointers.size === 1 && dragged) {
      const pose = options.pose()
      if (event.shiftKey || event.buttons === 4) {
        const metres = pose.verticalSpanM / Math.max(1, canvas.clientHeight)
        const x = -dx * metres,
          y = (dy * metres) / Math.sin(pose.elevation)
        options.change({
          ...pose,
          targetM: [
            pose.targetM[0] + x * Math.cos(pose.azimuth) + y * Math.sin(pose.azimuth),
            pose.targetM[1] - x * Math.sin(pose.azimuth) + y * Math.cos(pose.azimuth),
          ],
        })
      } else
        options.change({
          ...pose,
          azimuth: pose.azimuth - dx * 0.006,
          elevation: Math.max(0.2, Math.min(1.5, pose.elevation + dy * 0.005)),
        })
    }
  }
  const end = (event: PointerEvent) => {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    const tap =
      event.type === 'pointerup' &&
      !dragged &&
      !multiple &&
      pointers.size === 1 &&
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= 6
    pointers.delete(event.pointerId)
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (tap) options.tap(event.clientX, event.clientY)
  }
  const leave = () => options.hover(null)
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1
    options.zoom(Math.exp(-Math.max(-400, Math.min(400, event.deltaY * units)) * 0.002))
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('lostpointercapture', end)
  canvas.addEventListener('pointerleave', leave)
  canvas.addEventListener('wheel', wheel, { passive: false })
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', end)
    canvas.removeEventListener('pointercancel', end)
    canvas.removeEventListener('lostpointercapture', end)
    canvas.removeEventListener('pointerleave', leave)
    canvas.removeEventListener('wheel', wheel)
    for (const id of pointers.keys())
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
    pointers.clear()
  }
}
