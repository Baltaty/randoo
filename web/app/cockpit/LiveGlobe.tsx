'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

// react-globe.gl uses WebGL — must be client-side only
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false })

// Country code → [lat, lng]
const COORDS: Record<string, [number, number]> = {
  AF:[33.9,67.7],AL:[41.2,20.2],DZ:[28.0,1.7],AO:[-11.2,17.9],AR:[-38.4,-63.6],
  AM:[40.1,45.0],AU:[-25.3,133.8],AT:[47.5,14.6],AZ:[40.1,47.6],BD:[23.7,90.4],
  BE:[50.5,4.5],BJ:[9.3,2.3],BO:[-16.3,-63.6],BA:[43.9,17.7],BR:[-14.2,-51.9],
  BG:[42.7,25.5],KH:[12.6,104.9],CA:[56.1,-106.3],CL:[-35.7,-71.5],CN:[35.9,104.2],
  CO:[4.6,-74.3],CD:[-4.0,21.8],CR:[9.7,-83.8],HR:[45.1,15.2],CU:[21.5,-79.8],
  CZ:[49.8,15.5],DK:[56.3,9.5],DO:[18.7,-70.2],EC:[-1.8,-78.2],EG:[26.8,30.8],
  SV:[13.8,-88.9],EE:[58.6,25.0],ET:[9.1,40.5],FI:[61.9,25.7],FR:[46.2,2.2],
  GE:[42.3,43.4],DE:[51.2,10.5],GH:[7.9,-1.0],GR:[39.1,22.0],GT:[15.8,-90.2],
  HN:[15.2,-86.2],HK:[22.4,114.1],HU:[47.2,19.5],IN:[20.6,78.9],ID:[-0.8,113.9],
  IR:[32.4,53.7],IQ:[33.2,43.7],IE:[53.4,-8.2],IL:[31.0,35.0],IT:[41.9,12.6],
  JM:[18.1,-77.3],JP:[36.2,138.3],JO:[31.2,36.5],KZ:[48.0,66.9],KE:[-0.0,37.9],
  KR:[35.9,127.8],KW:[29.3,47.5],LB:[33.9,35.5],LY:[26.3,17.2],LT:[55.2,23.9],
  MK:[41.6,21.7],MY:[4.2,108.0],MX:[23.6,-102.6],MA:[31.8,-7.1],MZ:[-18.7,35.5],
  NL:[52.1,5.3],NZ:[-40.9,174.9],NI:[12.9,-85.2],NG:[9.1,8.7],NO:[60.5,8.5],
  PK:[30.4,69.3],PS:[31.9,35.2],PA:[8.5,-80.8],PY:[-23.4,-58.4],PE:[-9.2,-75.0],
  PH:[12.9,121.8],PL:[51.9,19.1],PT:[39.4,-8.2],RO:[45.9,24.9],RU:[61.5,105.3],
  SA:[23.9,45.1],SN:[14.5,-14.5],RS:[44.0,21.0],SK:[48.7,19.7],ZA:[-29.0,25.1],
  ES:[40.5,-3.7],LK:[7.9,80.8],SD:[12.9,30.2],SE:[60.1,18.6],CH:[46.8,8.2],
  TW:[23.7,120.9],TZ:[-6.4,34.9],TH:[15.9,100.9],TN:[34.0,9.0],TR:[38.9,35.2],
  UA:[48.4,31.2],GB:[55.4,-3.4],US:[37.1,-95.7],UY:[-32.5,-55.8],UZ:[41.4,64.6],
  VE:[6.4,-66.6],VN:[14.1,108.3],YE:[15.6,48.5],ZM:[-13.1,27.8],ZW:[-19.0,29.2],
}

interface LogEntry {
  ts:       number
  country?: string
}

interface Point {
  lat:   number
  lng:   number
  count: number
  country: string
  recent: boolean
}

export default function LiveGlobe({ log }: { log: LogEntry[] }) {
  const { points, arcs } = useMemo(() => {
    const now = Date.now()
    const counts: Record<string, { count: number; latestTs: number }> = {}
    for (const e of log) {
      if (!e.country || !COORDS[e.country]) continue
      const existing = counts[e.country]
      if (!existing) {
        counts[e.country] = { count: 1, latestTs: e.ts }
      } else {
        existing.count++
        if (e.ts > existing.latestTs) existing.latestTs = e.ts
      }
    }

    const pts: Point[] = Object.entries(counts).map(([country, { count, latestTs }]) => ({
      lat:     COORDS[country][0],
      lng:     COORDS[country][1],
      count,
      country,
      recent:  now - latestTs < 60_000, // connected within last 60s
    }))

    // Arcs between the two most recent different countries (just visual flair)
    const sorted = [...log]
      .filter(e => e.country && COORDS[e.country as string])
      .sort((a, b) => b.ts - a.ts)
    const seen = new Set<string>()
    const recent: LogEntry[] = []
    for (const e of sorted) {
      if (!seen.has(e.country!)) { seen.add(e.country!); recent.push(e) }
      if (recent.length >= 6) break
    }
    const arcList = []
    for (let i = 0; i < recent.length - 1; i++) {
      const a = recent[i], b = recent[i + 1]
      if (!a.country || !b.country) continue
      arcList.push({
        startLat: COORDS[a.country][0], startLng: COORDS[a.country][1],
        endLat:   COORDS[b.country][0], endLng:   COORDS[b.country][1],
      })
    }

    return { points: pts, arcs: arcList }
  }, [log])

  if (log.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 680 }}>
        <p className="text-xs" style={{ color: '#333' }}>No data yet</p>
      </div>
    )
  }

  return (
    <div style={{ height: 680, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Globe
        width={1000}
        height={680}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
        atmosphereColor="#ffd53a"
        atmosphereAltitude={0.12}
        // Points
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.01}
        pointRadius={(d) => Math.min(0.4 + (d as Point).count * 0.15, 1.2)}
        pointColor={(d) => (d as Point).recent ? '#ffd53a' : '#ff66b3'}
        pointLabel={(d) => {
          const p = d as Point
          return `<div style="background:#111;border:1px solid #272727;padding:6px 10px;border-radius:8px;font-size:12px;color:white">${p.country} · ${p.count} connection${p.count > 1 ? 's' : ''}</div>`
        }}
        // Rings on recent countries
        ringsData={points.filter(p => p.recent)}
        ringLat="lat"
        ringLng="lng"
        ringMaxRadius={3}
        ringPropagationSpeed={1.5}
        ringRepeatPeriod={800}
        ringColor={() => '#ffd53a'}
        // Arcs
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => ['rgba(255,213,58,0.6)', 'rgba(255,102,179,0.6)']}
        arcAltitudeAutoScale={0.3}
        arcStroke={0.5}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
      />
    </div>
  )
}
