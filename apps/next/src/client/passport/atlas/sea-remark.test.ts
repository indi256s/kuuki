import { expect, it } from 'vitest'
import { seaRemark } from './sea-remark'

const name = (en: string, ru: string) => ({ en, ru })

it('remarks only where "by sea" is wrong, and concedes the Caspian', () => {
  expect(seaRemark('HR', name('Croatia', 'Хорватия'))).toBeUndefined()
  expect(seaRemark('SK', name('Slovakia', 'Словакия'))?.en).toBeTruthy()
  expect(seaRemark('KZ', name('Kazakhstan', 'Казахстан'))?.en).toMatch(/Caspian/)
})
