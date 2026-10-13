// Types for the two build outputs worker.ts dispatches to. Without them tsc infers types from the
// bundles themselves (the Pages Functions bundle alone is ~150k lines); their sources are checked separately.
declare module '*/.open-next/worker.js' {
  const worker: { fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> }
  export default worker
}

declare module '*/functions-build/index.js' {
  const worker: { fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> }
  export default worker
}
