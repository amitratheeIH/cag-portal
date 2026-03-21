export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const OWNER  = process.env.GITHUB_OWNER!
const REPO   = process.env.GITHUB_REPO!
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const TOKEN  = process.env.GITHUB_TOKEN

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') // e.g. reports/.../assets/images/fig1.png

    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

    const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`
    const headers: Record<string,string> = {}
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`

    const res = await fetch(url, { headers })
    if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const blob = await res.arrayBuffer()
    const ct = res.headers.get('content-type') || 'image/png'
    return new NextResponse(blob, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
      }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
  }
}
