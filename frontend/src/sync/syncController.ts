import { db as defaultDb, type AppDB } from '../db/database'
import { runSync, type PostSyncFn } from './syncEngine'
import { postSync as apiPostSync } from '../api/client'
import { AuthError } from '../api/client'

const realPostSync: PostSyncFn = (token, body) => apiPostSync(token, body)

/** How often to poll for changes from other members while the app is open. */
const POLL_INTERVAL_MS = 60_000

export class SyncController {
  needsRelogin = false
  private running = false
  private queued = false
  private listeners = new Set<() => void>()
  private syncedListeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private onOnline = () => { void this.requestSync() }
  private onVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.requestSync()
  }
  private db: AppDB
  private postSync: PostSyncFn

  constructor(db: AppDB = defaultDb, postSync: PostSyncFn = realPostSync) {
    this.db = db
    this.postSync = postSync
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  /** Fires after a sync that actually pulled changes (e.g. a partner's entry). */
  onSynced(cb: () => void): () => void {
    this.syncedListeners.add(cb)
    return () => this.syncedListeners.delete(cb)
  }
  private emit() { for (const cb of this.listeners) cb() }
  private emitSynced() { for (const cb of this.syncedListeners) cb() }
  private setNeedsRelogin(v: boolean) {
    if (this.needsRelogin !== v) { this.needsRelogin = v; this.emit() }
  }

  start(): void {
    window.addEventListener('online', this.onOnline)
    window.addEventListener('focus', this.onOnline)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible)
    // Poll so a partner's changes show up without a manual action.
    this.timer = setInterval(() => void this.requestSync(), POLL_INTERVAL_MS)
    void this.requestSync()
  }
  stop(): void {
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('focus', this.onOnline)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible)
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null }
  }

  /** Best-effort, debounced: höchstens ein Sync gleichzeitig; Fehler werden geschluckt. */
  async requestSync(): Promise<void> {
    if (this.running) { this.queued = true; return }
    this.running = true
    try {
      const res = await runSync(this.db, this.postSync)
      this.setNeedsRelogin(false)
      if (res.pulled > 0) this.emitSynced()
    } catch (err) {
      if (err instanceof AuthError) this.setNeedsRelogin(true)
      // sonst: offline/Netzwerk — still schlucken, dirty bleibt für nächsten Trigger
    } finally {
      this.running = false
      if (this.queued) { this.queued = false; void this.requestSync() }
    }
  }
}

/** App-weiter Singleton-Controller. */
export const syncController = new SyncController()
