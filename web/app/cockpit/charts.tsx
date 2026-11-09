'use client'

// Dependency-free SVG charts for the cockpit.
// Single-series only (one hue = --theme-accent), text in text tokens, recessive grid,
// hover tooltip on every chart, hit targets wider than the marks.

import { useEffect, useRef, useState } from 'react'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function Tooltip({ x, width, title, value }: { x: number; width: number; title: string; value: string }) {
  // Keep the tooltip inside the chart horizontally
  const left = Math.max(0, Math.min(width - 150, x - 75))
  return (
    <div className="absolute top-0 pointer-events-none rounded-lg px-2.5 py-1.5 text-xs z-10"
      style={{
        left, width: 150,
        background: 'var(--theme-surface-solid)', border: '1px solid var(--theme-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}>
      <div style={{ color: 'var(--theme-text-muted)' }}>{title}</div>
      <div className="font-bold tabular-nums" style={{ color: 'var(--theme-text)' }}>{value}</div>
    </div>
  )
}

export interface BarPoint { label: string; value: number; display: string }

/** Vertical bars over time — one series. */
export function BarChart({ points, height = 150, emptyText = 'Aucune donnée' }: {
  points: BarPoint[]; height?: number; emptyText?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(0, ...points.map(p => p.value))
  const top = 18, bottom = 20
  const plotH = height - top - bottom
  const n = points.length
  const step = n > 0 ? width / n : 0
  const gap = step > 6 ? 2 : 0
  const barW = Math.max(1, step - gap)

  // Sparse x labels: first, middle, last
  const labelIdx = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <div ref={ref} className="relative w-full" style={{ height }}
      onMouseLeave={() => setHover(null)}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label="Graphique en barres">
          {/* recessive grid: baseline + max line */}
          <line x1={0} x2={width} y1={top + plotH} y2={top + plotH} stroke="var(--theme-border)" />
          {max > 0 && <line x1={0} x2={width} y1={top} y2={top} stroke="var(--theme-border)" strokeDasharray="2 4" />}
          {points.map((p, i) => {
            const h = max > 0 ? Math.max(p.value > 0 ? 2 : 0, (p.value / max) * plotH) : 0
            const x = i * step + gap / 2
            const y = top + plotH - h
            const r = Math.min(4, barW / 2, h)
            // rounded top, square baseline
            const d = h <= 0 ? '' :
              `M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${top + plotH} Z`
            return (
              <g key={i}>
                {d && <path d={d} fill="var(--theme-accent)" opacity={hover === null || hover === i ? 1 : 0.45} />}
                {/* full-height hit target */}
                <rect x={i * step} y={0} width={step} height={top + plotH} fill="transparent"
                  onMouseEnter={() => setHover(i)} />
              </g>
            )
          })}
          {labelIdx.map(i => (
            <text key={i} x={Math.min(width - 2, Math.max(2, i * step + step / 2))} y={height - 4}
              fontSize={10} fill="var(--theme-text-muted)"
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {points[i].label}
            </text>
          ))}
        </svg>
      )}
      {n > 0 && max === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {emptyText}
        </div>
      )}
      {hover !== null && points[hover] && (
        <Tooltip x={hover * step + step / 2} width={width} title={points[hover].label} value={points[hover].display} />
      )}
    </div>
  )
}

export interface LinePoint { ts: number; value: number; label: string }

/** Small line chart with crosshair (e.g. online users over the last hour). */
export function Sparkline({ points, height = 90, format }: {
  points: LinePoint[]; height?: number; format: (v: number) => string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pad = 6
  const n = points.length
  const max = Math.max(1, ...points.map(p => p.value))
  const xs = (i: number) => n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - 2 * pad)
  const ys = (v: number) => pad + (1 - v / max) * (height - 2 * pad)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(' ')

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (n === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left - pad) / Math.max(1, width - 2 * pad)
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 ? (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          role="img" aria-label="Courbe">
          <line x1={0} x2={width} y1={height - pad} y2={height - pad} stroke="var(--theme-border)" />
          <path d={d} fill="none" stroke="var(--theme-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <>
              <line x1={xs(hover)} x2={xs(hover)} y1={0} y2={height} stroke="var(--theme-text-muted)" strokeDasharray="2 3" />
              <circle cx={xs(hover)} cy={ys(points[hover].value)} r={4}
                fill="var(--theme-accent)" stroke="var(--theme-surface-solid)" strokeWidth={2} />
            </>
          )}
        </svg>
      ) : (
        <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          Historique disponible après quelques minutes
        </div>
      )}
      {hover !== null && points[hover] && (
        <Tooltip x={xs(hover)} width={width} title={points[hover].label} value={format(points[hover].value)} />
      )}
    </div>
  )
}

export interface RankItem { key: string; label: string; count: number }

/** Horizontal ranked bars with label + count + share (identity carried by text, not color). */
export function RankedBars({ items, total, emptyText = 'Aucune donnée' }: {
  items: RankItem[]; total?: number; emptyText?: string
}) {
  if (!items.length) return <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{emptyText}</p>
  const max = Math.max(...items.map(i => i.count))
  const sum = total ?? items.reduce((s, i) => s + i.count, 0)
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map(item => {
        const share = sum > 0 ? Math.round((item.count / sum) * 100) : 0
        return (
          <li key={item.key} title={`${item.label} : ${item.count.toLocaleString('fr-FR')} (${share} %)`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-sm truncate" style={{ color: 'var(--theme-text)' }}>{item.label}</span>
              <span className="text-xs tabular-nums whitespace-nowrap" style={{ color: 'var(--theme-text-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--theme-text)' }}>{item.count.toLocaleString('fr-FR')}</span>
                {' · '}{share} %
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--theme-surface)' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${max > 0 ? (item.count / max) * 100 : 0}%`, background: 'var(--theme-accent)' }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
