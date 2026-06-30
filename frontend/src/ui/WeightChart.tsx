import { useEffect, useState } from 'react'
import { db } from '../db/database'
import { getWeightSeries } from '../db/repository'
import type { LogRecord } from '../types'

const W = 320,
  H = 200,
  PAD = 28

/** SVG weight curve. Loads its own series when no `series` prop is given. */
export function WeightChart({ series: seriesProp }: { series?: LogRecord[] } = {}) {
  const [loaded, setLoaded] = useState<LogRecord[]>([])
  useEffect(() => {
    if (seriesProp !== undefined) return
    void getWeightSeries(db).then(setLoaded)
  }, [seriesProp])
  const series = seriesProp ?? loaded

  if (series.length === 0) {
    return (
      <div className="animate-fade-in text-center py-12 text-neutral-500">
        <div className="text-4xl mb-3">⚖️</div>
        <p>Keine Gewichtsdaten.</p>
        <p className="text-sm mt-1">Trag ein Gewicht ein, um die Kurve zu sehen.</p>
      </div>
    )
  }

  const grams = series.map((r) => r.weightGrams!)
  const times = series.map((r) => Date.parse(r.occurredAt))
  const minG = Math.min(...grams),
    maxG = Math.max(...grams)
  const minT = Math.min(...times),
    maxT = Math.max(...times)
  const spanG = maxG - minG || 1
  const spanT = maxT - minT || 1
  const x = (t: number) => PAD + ((t - minT) / spanT) * (W - 2 * PAD)
  const y = (g: number) => H - PAD - ((g - minG) / spanG) * (H - 2 * PAD)
  const points = series
    .map((r) => `${x(Date.parse(r.occurredAt)).toFixed(1)},${y(r.weightGrams!).toFixed(1)}`)
    .join(' ')

  const firstX = x(times[0]).toFixed(1)
  const lastX = x(times[times.length - 1]).toFixed(1)
  const areaPoints = `${firstX},${H - PAD} ${points} ${lastX},${H - PAD}`

  return (
    <div className="card p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.08)" />
        <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="rgba(255,255,255,0.05)" />

        <text x={4} y={PAD + 3} className="fill-neutral-500" fontSize="10">
          {maxG}
        </text>
        <text x={4} y={H - PAD + 3} className="fill-neutral-500" fontSize="10">
          {minG}
        </text>

        {series.length > 1 && <polygon points={areaPoints} fill="url(#weight-area)" />}

        <polyline
          data-testid="weight-line"
          fill="none"
          stroke="#a5b4fc"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          points={points}
          style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'draw 0.9s ease forwards' }}
        />
        {series.map((r) => (
          <circle
            key={r.id}
            cx={x(Date.parse(r.occurredAt))}
            cy={y(r.weightGrams!)}
            r="3.5"
            fill="#0a0a0f"
            stroke="#a5b4fc"
            strokeWidth="2"
            className="animate-fade-in"
          />
        ))}
      </svg>
    </div>
  )
}
