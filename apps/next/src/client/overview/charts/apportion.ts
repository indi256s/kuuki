export const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

/**
 * Largest-remainder shares of `target` in proportion to `weights`: floors first, then the leftover units by largest
 * fraction, ties to the earlier index. With `minOne`, every positive weight keeps at least one share, taken from the
 * largest while it can spare one. With `target` equal to the integer total, the result is the weights themselves.
 */
export function apportion(weights: readonly number[], target: number, minOne = false): number[] {
  const total = sum(weights)
  if (total <= 0 || target <= 0) return weights.map(() => 0)
  const exact = weights.map((weight) => (weight * target) / total)
  const shares = exact.map((value) => Math.floor(value + 1e-9))
  let rest = target - sum(shares)
  const order = exact
    .map((value, index) => ({ index, fraction: value - shares[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const { index } of order) {
    if (rest <= 0) break
    shares[index]++
    rest--
  }
  if (minOne)
    weights.forEach((weight, index) => {
      if (weight <= 0 || shares[index] > 0) return
      let largest = 0
      shares.forEach((share, at) => {
        if (share > shares[largest]) largest = at
      })
      // Never manufacture a share: a weight only gains one when another can spare it.
      if (shares[largest] <= 1) return
      shares[largest]--
      shares[index] = 1
    })
  return shares
}
