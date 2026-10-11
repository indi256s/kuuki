import { api } from '@kuuki/client/apiClient'

/** Onboarding is done: "I'll do this later", "Start empty" or "Open my journal". Idempotent on the server. */
export const markOnboarded = (signal?: AbortSignal) =>
  api.post<{ onboarded_at: string }>('/api/profiles/me/onboarded', undefined, { signal })
