import { createAuthClient } from 'better-auth/react'
import { api, ApiError, type IdentityOperationToken } from '@kuuki/client/apiClient'

/** Route Better Auth actions through the API client's identity lock and timeout handling. */
export function authClientFor(identityToken?: IdentityOperationToken) {
  return createAuthClient({
    basePath: '/api/auth',
    fetchOptions: {
      customFetchImpl: async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
        if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/auth/')) {
          throw new Error('Unexpected auth request URL')
        }
        const path = url.pathname + url.search
        const method = (init?.method ?? 'GET').toUpperCase()
        const options = { identityToken, signal: init?.signal ?? undefined }
        try {
          const data = method === 'POST'
            ? await api.post(path, init?.body ? JSON.parse(String(init.body)) : undefined, options)
            : method === 'GET'
              ? await api.get(path, undefined, options)
              : (() => { throw new Error(`Unexpected auth request method: ${method}`) })()
          return new Response(JSON.stringify(data ?? null), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          if (!(error instanceof ApiError)) throw error
          return new Response(JSON.stringify({ message: error.message, code: error.code }), {
            status: error.status,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  })
}
