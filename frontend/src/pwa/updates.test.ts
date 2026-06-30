import { expect, test, vi } from 'vitest'
import { hardReset, checkLatestVersion } from './updates'

test('checkLatestVersion returns newer build', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ build: 150 }) }))
  expect(await checkLatestVersion(143)).toBe(150)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ build: 143 }) }))
  expect(await checkLatestVersion(143)).toBeNull()
  vi.unstubAllGlobals()
})

test('hardReset deletes all caches and reloads', async () => {
  const del = vi.fn().mockResolvedValue(true)
  vi.stubGlobal('caches', { keys: async () => ['a', 'b'], delete: del })
  const reload = vi.fn()
  vi.stubGlobal('location', { reload } as unknown as Location)
  await hardReset()
  expect(del).toHaveBeenCalledTimes(2)
  expect(reload).toHaveBeenCalled()
  vi.unstubAllGlobals()
})
