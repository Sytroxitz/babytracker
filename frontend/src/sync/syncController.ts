import { db as defaultDb, type AppDB } from '../db/database'
import { runSync, type PostSyncFn } from './syncEngine'
import { postSync as apiPostSync } from '../api/client'
import { AuthError } from '../api/client'

const realPostSync: PostSyncFn = (token, body) => apiPostSync(token, body)

export class SyncController {
  needsRelogin = false
  private running = false
  private queued = false
  private listeners = new Set<() => void>()
  private onOnline = () => { void this.requestSync() }
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
  private emit() { for (const cb of this.listeners) cb() }
  private setNeedsRelogin(v: boolean) {
    if (this.needsRelogin !== v) { this.needsRelogin = v; this.emit() }
  }

  start(): void {
    window.addEventListener('online', this.onOnline)
    void this.requestSync()
  }
  stop(): void {
    window.removeEventListener('online', this.onOnline)
  }

  /** Best-effort, debounced: höchstens ein Sync gleichzeitig; Fehler werden geschluckt. */
  async requestSync(): Promise<void> {
    if (this.running) { this.queued = true; return }
    this.running = true
    try {
      await runSync(this.db, this.postSync)
      this.setNeedsRelogin(false)
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
