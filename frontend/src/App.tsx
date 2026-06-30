import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './auth/useAuth'
import { useChildren } from './children/useChildren'
import { AuthScreen } from './ui/AuthScreen'
import { Onboarding } from './ui/Onboarding'
import { ChildSwitcher } from './ui/ChildSwitcher'
import { QuickEntry } from './ui/QuickEntry'
import { Timeline } from './ui/Timeline'
import { WeightPage } from './ui/WeightPage'
import { StatsPage } from './ui/StatsPage'
import { UpdateBanner } from './ui/UpdateBanner'
import { syncController } from './sync/syncController'
import { db, getMeta, setMeta } from './db/database'
import { useReminders } from './sync/useReminders'
import { notificationPermission, requestNotificationPermission } from './notifications'
import { registerPwa, checkLatestVersion, hardReset, type PwaControls } from './pwa/updates'
import { APP_VERSION, APP_BUILD } from './version'

type Tab = 'entry' | 'timeline' | 'stats' | 'weight'

function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

const NAV: { tab: Tab; label: string; icon: ReactNode }[] = [
  {
    tab: 'entry',
    label: 'Erfassen',
    icon: (
      <path d="M12 5v14M5 12h14" strokeWidth="2.2" strokeLinecap="round" />
    ),
  },
  {
    tab: 'timeline',
    label: 'Verlauf',
    icon: (
      <>
        <path d="M8 6h12M8 12h12M8 18h12" strokeWidth="2" strokeLinecap="round" />
        <circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    tab: 'stats',
    label: 'Statistik',
    icon: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    tab: 'weight',
    label: 'Gewicht',
    icon: (
      <path d="M4 16l5-5 4 3 7-7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
]

export default function App() {
  const auth = useAuth()
  const children = useChildren()
  const [tab, setTab] = useState<Tab>('entry')
  const [addingChild, setAddingChild] = useState(false)
  const [needsRelogin, setNeedsRelogin] = useState(false)
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [latestBuild, setLatestBuild] = useState<number | null>(null)
  const pwa = useRef<PwaControls | null>(null)
  const online = useOnline()

  // Register the service worker once and wire the update banner.
  useEffect(() => {
    pwa.current = registerPwa(() => setUpdateReady(true))
    void checkLatestVersion(APP_BUILD).then(setLatestBuild)
  }, [])

  async function checkForUpdates() {
    await pwa.current?.update()
    setLatestBuild(await checkLatestVersion(APP_BUILD))
  }

  function applyUpdate() {
    if (pwa.current) pwa.current.applyUpdate()
    else void hardReset()
  }

  useEffect(() => {
    if (!auth.token) return
    syncController.start()
    const off = syncController.onChange(() => setNeedsRelogin(syncController.needsRelogin))
    return () => {
      off()
      syncController.stop()
    }
  }, [auth.token])

  // Pull a partner's child master-data edits (name, birth weight, …) into the
  // shared store so the switcher and views update live.
  const refreshChildren = children.refresh
  useEffect(() => syncController.onSynced(() => void refreshChildren()), [refreshChildren])

  useEffect(() => {
    void getMeta<boolean>(db, 'remindersEnabled').then((v) =>
      setRemindersEnabled(v === true && notificationPermission() === 'granted'),
    )
  }, [])

  useReminders(remindersEnabled && !!auth.token, children.activeChildId)

  async function toggleReminders() {
    if (remindersEnabled) {
      setRemindersEnabled(false)
      await setMeta(db, 'remindersEnabled', false)
      return
    }
    const perm = await requestNotificationPermission()
    const granted = perm === 'granted'
    setRemindersEnabled(granted)
    await setMeta(db, 'remindersEnabled', granted)
  }

  if (!auth.ready) return null
  if (!auth.token) return <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />

  if (!children.ready) return null
  if (children.children.length === 0)
    return (
      <Onboarding
        token={auth.token}
        onDone={() => void children.refresh()}
        onSignOut={auth.signOut}
      />
    )

  const activeChild = children.activeChild!

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-neutral-950/70 backdrop-blur-md border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm">
            🍼
          </span>
          <ChildSwitcher token={auth.token} onAddChild={() => setAddingChild(true)} />
        </div>
        <div className="flex items-center gap-3">
          <span
            title={online ? 'Online' : 'Offline'}
            className={`flex items-center gap-1.5 text-xs ${online ? 'text-emerald-400' : 'text-neutral-500'}`}
          >
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
          <button
            onClick={auth.signOut}
            className="text-sm text-neutral-400 hover:text-neutral-100 px-2 py-1 rounded-lg hover:bg-white/8 transition"
          >
            Abmelden
          </button>
        </div>
      </header>

      {/* Update-available banner */}
      {(updateReady || latestBuild !== null) && (
        <UpdateBanner
          onUpdate={applyUpdate}
          latest={latestBuild !== null ? `Build ${latestBuild}` : null}
        />
      )}

      {/* Session-expired banner */}
      {needsRelogin && (
        <button
          onClick={auth.signOut}
          className="animate-slide-down sticky top-14 z-10 w-full text-left bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-sm py-2.5 px-4 hover:bg-amber-500/20 transition"
        >
          ⚠️ Sitzung abgelaufen – hier tippen zum neu Anmelden. (Eintragen funktioniert weiter.)
        </button>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto scroll-area pb-nav">
        <div key={tab} className="animate-fade-in">
          {tab === 'entry' && <QuickEntry child={activeChild} myUserId={children.myUserId} />}
          {tab === 'timeline' && <Timeline child={activeChild} />}
          {tab === 'stats' && (
            <StatsPage
              child={activeChild}
              remindersEnabled={remindersEnabled}
              onToggleReminders={toggleReminders}
              appVersion={APP_VERSION}
              onCheckUpdates={checkForUpdates}
              onHardReset={() => void hardReset()}
            />
          )}
          {tab === 'weight' && <WeightPage child={activeChild} myUserId={children.myUserId} />}
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-20 h-nav pb-safe grid grid-cols-4 bg-neutral-950/80 backdrop-blur-md border-t border-white/8">
        {NAV.map(({ tab: t, label, icon }) => {
          const activeTab = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={activeTab ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab ? 'text-indigo-400' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {activeTab && (
                <span className="absolute top-0 h-0.5 w-10 rounded-full bg-indigo-400" />
              )}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className={`h-6 w-6 transition-transform ${activeTab ? 'scale-110' : ''}`}
              >
                {icon}
              </svg>
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Add / join child overlay */}
      {addingChild && (
        <div className="fixed inset-0 z-40 bg-neutral-950 overflow-y-auto scroll-area animate-fade-in">
          <button
            onClick={() => setAddingChild(false)}
            aria-label="Schließen"
            className="absolute top-4 right-4 z-10 h-9 w-9 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-100 transition"
          >
            ✕
          </button>
          <Onboarding
            token={auth.token}
            onDone={() => {
              void children.refresh()
              setAddingChild(false)
            }}
            onSignOut={auth.signOut}
          />
        </div>
      )}
    </div>
  )
}
