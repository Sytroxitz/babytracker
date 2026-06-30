/**
 * Web-Notification helpers. Reliable while the app is OPEN (foreground).
 * Background delivery (app closed) is best-effort via the experimental
 * Notification Triggers API (Chromium only) and otherwise needs a push
 * server (deferred to the deployment phase).
 */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** Show a notification now (prefers the SW registration so it works installed). */
export async function showNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, { icon: '/icon.svg', badge: '/icon.svg', ...options })
      return
    }
  } catch {
    /* fall through to the constructor */
  }
  try {
    new Notification(title, options)
  } catch {
    /* nothing else we can do */
  }
}

/**
 * Best-effort BACKGROUND schedule via TimestampTrigger (Chromium). No-op where
 * unsupported — the in-app watchdog covers the foreground case there.
 */
export async function scheduleFeedingReminder(whenMs: number, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  if (whenMs <= Date.now()) return false
  const TriggerCtor = (window as unknown as { TimestampTrigger?: new (ts: number) => unknown })
    .TimestampTrigger
  if (!TriggerCtor) return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (!reg) return false
    const opts: Record<string, unknown> = {
      tag: `feed-${whenMs}`, // dedups identical scheduled times
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      showTrigger: new TriggerCtor(whenMs),
    }
    await reg.showNotification('🍼 Zeit zum Füttern', opts as unknown as NotificationOptions)
    return true
  } catch {
    return false
  }
}
