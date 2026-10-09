// Bundled in the Miniflare fixture instead of the network SDK. Production has no fake-provider flag.
export const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
}
export class ApiError extends Error {
  constructor(public status: number) {
    super('Fixture provider failure')
  }
}
let service: Fetcher
export function configureProvider(binding: Fetcher) {
  service = binding
}
export class GoogleGenAI {
  constructor(_options: unknown) {}
  models = {
    async generateContentStream(input: {
      model: string
      contents: unknown
      config: {
        abortSignal: AbortSignal
        httpOptions: { timeout: number }
        responseMimeType: string
        responseSchema: unknown
      }
    }) {
      const response = await service.fetch('https://fake.internal', {
        method: 'POST',
        body: JSON.stringify({
          model: input.model,
          contents: input.contents,
          timeout: input.config.httpOptions.timeout,
          mime: input.config.responseMimeType,
          schema: input.config.responseSchema,
        }),
      })
      const reader = response.body!.getReader()
      // Deliberately ignore abort so the job must fence late callbacks and enforce its own deadline.
      return (async function* () {
        const decoder = new TextDecoder()
        let pending = ''
        try {
          for (;;) {
            const next = await reader.read()
            if (next.done) break
            pending += decoder.decode(next.value, { stream: true })
            let end: number
            while ((end = pending.indexOf('\n')) >= 0) {
              const item = JSON.parse(pending.slice(0, end)) as {
                text?: string
                status?: number
                error?: string
              }
              pending = pending.slice(end + 1)
              if (item.status) throw new ApiError(item.status)
              if (item.error) throw new Error(item.error)
              yield { text: item.text ?? '' }
            }
          }
        } finally {
          await reader.cancel().catch(() => undefined)
          reader.releaseLock()
        }
      })()
    },
  }
}
