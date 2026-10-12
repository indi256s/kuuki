const stage = document.querySelector('.cn-stage')
const readout = document.querySelector('[data-readout]')
const still = matchMedia('(prefers-reduced-motion: reduce)')
const SPEED = 15 // degrees per second: one turn every 24 s
const REST = 0
let angle = REST
let last = 0
let frame = 0
let visible = true
const controller = TURN.mount(stage, DATA, { follow: (v) => v })
const show = () => {
  const heading = Math.round((((360 - angle) % 360) + 360) % 360)
  if (readout) readout.textContent = `hdg ${String(heading).padStart(3, '0')}°`
}
const tick = (now) => {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
  last = now
  angle = (angle + SPEED * dt) % 360
  controller.set({ model: angle })
  controller.events()
  show()
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0
}
controller.set({ model: angle })
controller.events()
show()
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting
  if (visible && !frame && !still.matches) {
    last = 0
    frame = requestAnimationFrame(tick)
  }
}).observe(stage)
