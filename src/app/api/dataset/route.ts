export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchJson } from '@/lib/github'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder')
    const id     = searchParams.get('id')

    if (!folder || !id) {
      return NextResponse.json({ error: 'folder and id required' }, { status: 400 })
    }

    // Dataset files are at: {folder}/datasets/{id}.json
    const path = `${folder}/datasets/${id}.json`
    const ds = await fetchJson(path)
    return NextResponse.json(ds)
  } catch (err) {
    return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
  }
}
