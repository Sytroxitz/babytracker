import { registerSW } from 'virtual:pwa-register'

/**
 * Network-first poll of the deployed build number. Returns the newer build when
 * the server is ahead of `currentBuild`, otherwise null. Never throws.
 */
export async function checkLatestVersion(currentBuild: number): Promise<number | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { build: number }
    return data.build > currentBuild ? data.build : null
  } catch {
    return null
  }
}

/** Nuclear option: drop every cache and reload from the network. */
export async function hardReset(): Promise<void> {
  if ('caches' in globalThis) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
  location.reload()
}

export interface PwaControls {
  /** Ask the active service worker to check for a new version now. */
  update: () => Promise<void>
  /** Activate the waiting service worker and reload the page. */
  applyUpdate: () => void
}

/**
 * Registers the service worker and wires up update checks: an hourly interval
 * plus a check whenever the tab regains visibility/focus. `onNeedRefresh` fires
 * when a new worker is waiting.
 */
export function registerPwa(onNeedRefresh: () => void): PwaControls {
  let registration: ServiceWorkerRegistration | undefined

  const swUpdate = registerSW({
    onNeedRefresh,
    onRegisteredSW(_swUrl, r) {
      registration = r
      if (r) {
        setInterval(() => void r.update(), 60 * 60 * 1000)
      }
    },
  })

  const checkNow = () => {
    if (registration) void registration.update()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkNow()
  })
  window.addEventListener('focus', checkNow)

  return {
    update: async () => {
      if (registration) await registration.update()
    },
    applyUpdate: () => void swUpdate(true),
  }
}
