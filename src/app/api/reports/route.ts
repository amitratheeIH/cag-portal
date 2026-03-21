export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const page     = parseInt(searchParams.get('page')  || '1')
    const limit    = parseInt(searchParams.get('limit') || '20')
    const year     = searchParams.get('year')
    const sector   = searchParams.get('sector')
    const type     = searchParams.get('type')
    const jur      = searchParams.get('jurisdiction')
    const findings = searchParams.get('findings')
    const skip     = (page - 1) * limit

    // Build filter
    const filter: Record<string, unknown> = {}
    if (year)     filter['year']        = parseInt(year)
    if (sector)   filter['report_sector']  = sector
    if (type)     filter['audit_type']     = type
    if (jur)      filter['jurisdiction']   = jur
    if (findings) filter['audit_findings_categories'] = findings

    const db = await getDb()
    const col = db.collection('catalog_index')

    const [docs, total] = await Promise.all([
      col
        .find(filter)
        .sort({ year: -1, 'report_number.number': 1 })
        .skip(skip)
        .limit(limit)
        .project({
          product_id: 1, product_type: 1, year: 1,
          jurisdiction: 1, slug: 1, title: 1, summary: 1,
          audit_type: 1, report_sector: 1, topics: 1,
          audit_findings_categories: 1, audit_period: 1,
          state_ut_id: 1, audit_status: 1, report_number: 1,
          tabling_dates: 1, report_path: 1,
        })
        .toArray(),
      col.countDocuments(filter),
    ])

    return NextResponse.json({
      reports: docs,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('GET /api/reports error:', err)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}
