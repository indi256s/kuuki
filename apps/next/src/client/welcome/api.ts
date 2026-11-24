import { api } from '@kuuki/client/apiClient'

export const markOnboarded = (signal?: AbortSignal) =>
  api.post<{ onboarded_at: string }>('/api/profiles/me/onboarded', undefined, { signal })
