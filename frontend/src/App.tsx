import { useEffect, useState } from 'react'
import { useAuth } from './auth/useAuth'
import { AuthScreen } from './ui/AuthScreen'
import { QuickEntry } from './ui/QuickEntry'
import { Timeline } from './ui/Timeline'
import { WeightChart } from './ui/WeightChart'
import { syncController } from './sync/syncController'

type Tab = 'entry' | 'timeline' | 'weight'

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('entry')
  const [needsRelogin, setNeedsRelogin] = useState(false)

  useEffect(() => {
    if (!auth.token) return
    syncController.start()
    const off = syncController.onChange(() => setNeedsRelogin(syncController.needsRelogin))
    return () => { off(); syncController.stop() }
  }, [auth.token])

  if (!auth.ready) return null
  if (!auth.token) return <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />

  return (
    <div className="min-h-full flex flex-col">
      {needsRelogin && (
        <button onClick={auth.signOut} className="bg-amber-700/80 text-sm py-2 px-4 text-center">
          Sitzung abgelaufen – tippe hier zum neu Anmelden (Eintragen funktioniert weiter)
        </button>
      )}
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'entry' && <QuickEntry />}
        {tab === 'timeline' && <Timeline />}
        {tab === 'weight' && <WeightChart />}
      </div>
      <nav className="fixed bottom-0 inset-x-0 grid grid-cols-3 bg-neutral-900 border-t border-neutral-800">
        {([['entry', 'Erfassen'], ['timeline', 'Verlauf'], ['weight', 'Gewicht']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`min-h-16 text-sm ${tab === t ? 'text-indigo-400' : 'text-neutral-400'}`}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
