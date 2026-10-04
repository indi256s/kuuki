'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return <html lang="en"><body><main className="error-state"><h1>Kuuki couldn’t start.</h1><p>Please try again.</p><button onClick={reset}>Try again</button></main></body></html>
}
