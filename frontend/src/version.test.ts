import { expect, test } from 'vitest'
import { buildVersionString } from './version'

test('builds version string from git parts with fallback', () => {
  expect(buildVersionString({ build: 143, sha: 'a1b2c3d', date: '2026-06-30' }))
    .toBe('Version 143 · a1b2c3d · 2026-06-30')
  expect(buildVersionString({ build: 0, sha: 'dev', date: '2026-06-30' }))
    .toBe('Version dev · dev · 2026-06-30')
})
