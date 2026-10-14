// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { addOrigin } from './add-origin'

beforeEach(() => sessionStorage.clear())

it('returns to Journal when the last screen was a ground-travel form', () => {
  for (const path of [
    '/ground-travel/new?mode=rail',
    '/ground-travel/new',
    '/ground-travel/00000000-0000-4000-8000-000000000001/edit?complete=1',
  ]) {
    sessionStorage.setItem('kuuki:add-origin', path)
    expect(addOrigin(), path).toBe('/journal')
  }
})

it('still returns to the ground-travel list and other member screens', () => {
  sessionStorage.setItem('kuuki:add-origin', '/ground-travel?mode=road')
  expect(addOrigin()).toBe('/ground-travel?mode=road')
  sessionStorage.setItem('kuuki:add-origin', '/passport')
  expect(addOrigin()).toBe('/passport')
})
