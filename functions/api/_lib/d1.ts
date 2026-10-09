/** Fail loudly when D1 reports an unsuccessful or partial read instead of rendering empty rows. */
export function assertRows(
  result: D1Result | D1Result[],
  failure: string,
  expected?: number,
): void {
  const results = Array.isArray(result) ? result : [result]
  if (
    results.length !== (expected ?? results.length) ||
    results.some((row) => !row.success || !Array.isArray(row.results))
  ) {
    throw new Error(failure)
  }
}
