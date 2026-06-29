import { useEffect, useState } from 'react'
import { db } from '../db/database'
import { getWeightSeries } from '../db/repository'
import type { LogRecord } from '../types'

const W = 320, H = 200, PAD = 28

export function WeightChart() {
  const [series, setSeries] = useState<LogRecord[]>([])
  useEffect(() => { void getWeightSeries(db).then(setSeries) }, [])

  if (series.length === 0) {
    return <p className="text-neutral-500 text-center py-12">Keine Gewichtsdaten.</p>
  }

  const grams = series.map((r) => r.weightGrams!)
  const times = series.map((r) => Date.parse(r.occurredAt))
  const minG = Math.min(...grams), maxG = Math.max(...grams)
  const minT = Math.min(...times), maxT = Math.max(...times)
  const spanG = maxG - minG || 1
  const spanT = maxT - minT || 1
  const x = (t: number) => PAD + ((t - minT) / spanT) * (W - 2 * PAD)
  const y = (g: number) => H - PAD - ((g - minG) / spanG) * (H - 2 * PAD)
  const points = series.map((r) => `${x(Date.parse(r.occurredAt)).toFixed(1)},${y(r.weightGrams!).toFixed(1)}`).join(' ')

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-3">Gewicht</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full bg-neutral-900 rounded-xl">
        <text x={4} y={PAD} className="fill-neutral-500" fontSize="10">{maxG} g</text>
        <text x={4} y={H - PAD} className="fill-neutral-500" fontSize="10">{minG} g</text>
        <polyline data-testid="weight-line" fill="none" stroke="#818cf8" strokeWidth="2" points={points} />
        {series.map((r) => (
          <circle key={r.id} cx={x(Date.parse(r.occurredAt))} cy={y(r.weightGrams!)} r="3" fill="#a5b4fc" />
        ))}
      </svg>
    </div>
  )
}
