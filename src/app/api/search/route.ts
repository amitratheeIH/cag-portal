export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q          = searchParams.get('q')?.trim()
    const productId  = searchParams.get('product_id')
    const blockType  = searchParams.get('block_type')
    const limit      = parseInt(searchParams.get('limit') || '10')

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const db = await getDb()

    // Build compound search query
    const mustClauses: unknown[] = [
      { text: { query: q, path: 'text_snippet', fuzzy: { maxEdits: 1 } } }
    ]

    const filterClauses: unknown[] = []
    if (productId) filterClauses.push({ equals: { path: 'product_id', value: productId } })
    if (blockType) filterClauses.push({ equals: { path: 'block_type',  value: blockType  } })

    const searchStage: Record<string, unknown> = {
      $search: {
        index: 'block_search',
        compound: { must: mustClauses, ...(filterClauses.length ? { filter: filterClauses } : {}) },
      }
    }

    const results = await db.collection('block_vectors').aggregate([
      searchStage,
      { $limit: limit },
      { $project: {
        _id: 0,
        block_id: 1, unit_id: 1, block_type: 1,
        para_number: 1, product_id: 1,
        text_snippet: 1,
        score: { $meta: 'searchScore' },
      }},
    ]).toArray()

    return NextResponse.json({ results, query: q })
  } catch (err) {
    console.error('GET /api/search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
