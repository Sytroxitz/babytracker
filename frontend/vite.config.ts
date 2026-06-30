import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

function git(cmd: string, fallback: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return fallback
  }
}

const build = Number(git('git rev-list --count HEAD', '0'))
const sha = git('git rev-parse --short HEAD', 'dev')
const date = git('git log -1 --format=%cs', new Date().toISOString().slice(0, 10))
const versionString = `Version ${build > 0 ? build : sha} · ${sha} · ${date}`

const emitVersionJson = {
  name: 'emit-version-json',
  closeBundle() {
    mkdirSync('dist', { recursive: true })
    writeFileSync(
      'dist/version.json',
      JSON.stringify({ version: versionString, build, builtAt: new Date().toISOString() }),
    )
  },
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(versionString),
    __APP_BUILD__: build,
  },
  plugins: [
    react(),
    tailwindcss(),
    emitVersionJson,
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'BabyTracker',
        short_name: 'BabyTracker',
        description: 'Still-, Pump-, Flaschen- und Gewichts-Tracker',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } },
})
