import { gateActivationHost, maintenanceResponse } from './hostGate'

/** Synchronous, shared Worker/Pages gate. Invoke before assets, API, or sessions. */
export function gateRequest(request: Request, env: Env): Response | null {
  const activation = gateActivationHost(request, env)
  if (activation instanceof Response) return activation
  // The activation host has been constrained to its three assets and completion
  // endpoint. A maintenance hold still blocks that API before it reaches D1.
  if (new URL(request.url).pathname.startsWith('/api/')) return maintenanceResponse(env)
  return null
}
