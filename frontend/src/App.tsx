import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './auth/useAuth'
import { AuthScreen } from './ui/AuthScreen'
import { QuickEntry } from './ui/QuickEntry'
import { Timeline } from './ui/Timeline'
import { WeightChart } from './ui/WeightChart'
import { syncController } from './sync/syncController'

type Tab = 'entry' | 'timeline' | 'weight'

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
    tab: 'weight',
    label: 'Gewicht',
    icon: (
      <path d="M4 16l5-5 4 3 7-7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
]

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('entry')
  const [needsRelogin, setNeedsRelogin] = useState(false)
  const online = useOnline()

  useEffect(() => {
    if (!auth.token) return
    syncController.start()
    const off = syncController.onChange(() => setNeedsRelogin(syncController.needsRelogin))
    return () => {
      off()
      syncController.stop()
    }
  }, [auth.token])

  if (!auth.ready) return null
  if (!auth.token) return <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-neutral-950/70 backdrop-blur-md border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm">
            🍼
          </span>
          <span className="font-semibold tracking-tight">BabyTracker</span>
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
      <main className="flex-1 overflow-y-auto scroll-area pb-28">
        <div key={tab} className="animate-fade-in-up">
          {tab === 'entry' && <QuickEntry />}
          {tab === 'timeline' && <Timeline />}
          {tab === 'weight' && <WeightChart />}
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-20 h-nav pb-safe grid grid-cols-3 bg-neutral-950/80 backdrop-blur-md border-t border-white/8">
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
    </div>
  )
}
