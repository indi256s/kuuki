declare module '*/.open-next/worker.js' {
  const worker: { fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> }
  export default worker
}

declare module '*/functions-build/index.js' {
  const worker: { fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> }
  export default worker
}
