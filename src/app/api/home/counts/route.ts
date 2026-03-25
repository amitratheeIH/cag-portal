// app/api/home/counts/route.ts
// Returns aggregate counts for the home page category postcards.
// Queries: catalog_index collection, grouped by portal_section + jurisdiction.

import { getDb } from '@/lib/mongodb'
import { NextResponse } from 'next/server'

export const revalidate = 3600  // revalidate every hour

export async function GET() {
  try {
    const db = await getDb()
    const col = db.collection('catalog_index')

    // Single aggregation — group by portal_section + jurisdiction
    const pipeline = [
      {
        $group: {
          _id: { section: '$portal_section', jur: '$jurisdiction' },
          count: { $sum: 1 },
        },
      },
    ]

    const rows = await col.aggregate(pipeline).toArray()

    // Build counts object
    const counts = {
      audit:    { total: 0, union: 0, state: 0, ut: 0, lg: 0 },
      accounts: { total: 0, union: 0, state: 0 },
      finance:  { total: 0, union: 0, state: 0 },
      other:    { total: 0, study: 0, compendium: 0, impact_study: 0 },
      impact:   { total: 0 },
    }

    for (const row of rows) {
      const section = row._id.section as string
      const jur     = (row._id.jur as string || '').toUpperCase()
      const n       = row.count as number

      if (section === 'audit_reports') {
        counts.audit.total += n
        if (jur === 'UNION') counts.audit.union += n
        else if (jur === 'STATE') counts.audit.state += n
        else if (jur === 'UT') counts.audit.ut += n
        else if (jur === 'LG') counts.audit.lg += n
      } else if (section === 'accounts_reports') {
        counts.accounts.total += n
        if (jur === 'UNION') counts.accounts.union += n
        else if (jur === 'STATE' || jur === 'UT') counts.accounts.state += n
      } else if (section === 'finance_reports') {
        counts.finance.total += n
        if (jur === 'UNION') counts.finance.union += n
        else if (jur === 'STATE' || jur === 'UT') counts.finance.state += n
      } else if (section === 'study_reports') {
        counts.other.total += n
        counts.other.study += n
      } else if (section === 'compendium') {
        counts.other.total += n
        counts.other.compendium += n
      } else if (section === 'audit_impact') {
        counts.impact.total += n
      }
    }

    return NextResponse.json(counts, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch (err) {
    console.error('home/counts error:', err)
    return NextResponse.json({ error: 'Failed to load counts' }, { status: 500 })
  }
}
