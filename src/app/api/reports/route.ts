export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb()

    const [catalog, meta] = await Promise.all([
      db.collection('catalog_index').findOne({ product_id: params.id }),
      db.collection('report_meta').findOne({ product_id: params.id }),
    ])

    if (!catalog) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ catalog, meta })
  } catch (err) {
    console.error('GET /api/reports/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 })
  }
}
