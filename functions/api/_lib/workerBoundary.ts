import { gateActivationHost, maintenanceResponse } from './hostGate'

export function gateRequest(request: Request, env: Env): Response | null {
  const activation = gateActivationHost(request, env)
  if (activation instanceof Response) return activation
  if (new URL(request.url).pathname.startsWith('/api/')) return maintenanceResponse(env)
  return null
}
