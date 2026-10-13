import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createPrivateAircraftArtifact, groupAircraftOccurrences } from './evaluate-aircraft'

const flight = {
  id: 'first',
  date: '2024-03-15',
  origin: 'DXB',
  destination: 'LHR',
  airline_iata: 'EK',
  flight_number: '001',
}

test('repeated journal occurrences reuse one full marketing flight lookup without combining codeshares', () => {
  const groups = groupAircraftOccurrences([
    flight,
    { ...flight, id: 'second', flight_number: 'ek 1' },
    { ...flight, id: 'codeshare', airline_iata: 'QF', flight_number: '1' },
    { ...flight, id: 'return', origin: 'LHR', destination: 'DXB' },
  ])
  assert.equal(groups.length, 3)
  assert.deepEqual(groups[0].ids, ['first', 'second'])
  assert.equal(groups[0].flight.flight_number, 'EK1')
  assert.throws(
    () => groupAircraftOccurrences([{ ...flight, flight_number: 'no flight' }]),
    /Malformed/,
  )
})

test('private artifacts refuse overwrite, symlink traversal and escapes; incremental writes retain private permissions', async () => {
  await mkdir(resolve('.scratch/import-eval'), { recursive: true, mode: 0o700 })
  const directory = await mkdtemp(resolve('.scratch/import-eval/aircraft-test-'))
  const path = join(directory, 'result.json')
  try {
    await writeFile(path, 'original', { mode: 0o600 })
    await assert.rejects(createPrivateAircraftArtifact(path), { code: 'EEXIST' })
    assert.equal(await readFile(path, 'utf8'), 'original')
    await symlink(directory, join(directory, 'link'))
    await assert.rejects(
      createPrivateAircraftArtifact(join(directory, 'link', 'new.json')),
      /Symlink/,
    )
    await assert.rejects(createPrivateAircraftArtifact('.scratch/outside.json'), /private/)
    const artifact = await createPrivateAircraftArtifact(join(directory, 'new.json'))
    try {
      await artifact.write({ reservation: 2, state: 'in_progress', long: 'previous content' })
      await artifact.write({ reservation: 2 })
      assert.deepEqual(JSON.parse(await readFile(artifact.path, 'utf8')), { reservation: 2 })
      assert.equal((await stat(artifact.path)).mode & 0o777, 0o600)
    } finally {
      await artifact.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
