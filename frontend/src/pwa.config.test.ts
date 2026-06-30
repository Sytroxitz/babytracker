// @vitest-environment node
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'

test('vite config excludes /api from SW navigation fallback', () => {
  const cfg = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  expect(cfg).toMatch(/navigateFallbackDenylist/)
  expect(cfg).toMatch(/\^\\\/api/)
  expect(cfg).toMatch(/display: 'standalone'/)
})

test('vite config enables a forced service-worker update', () => {
  const cfg = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  expect(cfg).toMatch(/skipWaiting: true/)
  expect(cfg).toMatch(/cleanupOutdatedCaches: true/)
})
