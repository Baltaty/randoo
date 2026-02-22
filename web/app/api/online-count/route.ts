import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'
    const res  = await fetch(`${url}/health`, { next: { revalidate: 10 } })
    const data = await res.json()
    return NextResponse.json({ count: data.onlineCount ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
