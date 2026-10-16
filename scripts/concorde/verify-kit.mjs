import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Shared by figure generators. Validate the complete locked dependency set before executing kit code or writing.
export function verifiedAnatomyKit() {
  const pin = JSON.parse(readFileSync(new URL('./anatomy.lock.json', import.meta.url), 'utf8'))
  const kit = resolve(process.env.ANATOMY_KIT ?? '.scratch/concorde/anatomy/kit')
  for (const [file, expected] of Object.entries(pin.sha256)) {
    let actual
    try {
      actual = createHash('sha256')
        .update(readFileSync(join(kit, file)))
        .digest('hex')
    } catch {
      throw new Error(`Missing anatomy kit file ${file}. See scripts/concorde/README.md for setup.`)
    }
    if (actual !== expected)
      throw new Error(
        `Anatomy kit ${file} differs from pinned commit ${pin.commit}. See scripts/concorde/README.md.`,
      )
  }
  return kit
}
