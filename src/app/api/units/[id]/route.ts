export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get('unit_id')

    if (!unitId) {
      return NextResponse.json({ error: 'unit_id required' }, { status: 400 })
    }

    const db = await getDb()
    const blocks = await db
      .collection('block_vectors')
      .find({ product_id: params.id, unit_id: unitId })
      .sort({ seq: 1 })
      .project({
        block_id: 1, unit_id: 1, block_type: 1,
        para_type: 1, para_number: 1, seq: 1,
        text_snippet: 1, audit_metadata: 1,
        annotations: 1, resolved_meta: 1,
      })
      .toArray()

    return NextResponse.json({ blocks })
  } catch (err) {
    console.error('GET /api/units/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 })
  }
}
