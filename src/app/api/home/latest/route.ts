// app/api/home/latest/route.ts
// Returns the 6 most recent reports for each portal_section.
// Used by the Latest Reports strips on the home page.

import { getDb } from '@/lib/mongodb'
import { NextResponse } from 'next/server'

export const revalidate = 3600

const SECTIONS = ['audit_reports', 'accounts_reports', 'finance_reports', 'study_reports', 'audit_impact']
const PER_SECTION = 6

export async function GET() {
  try {
    const db  = await getDb()
    const col = db.collection('catalog_index')

    // Fetch latest N per section in parallel
    const results = await Promise.all(
      SECTIONS.map(async (section) => {
        const docs = await col
          .find(
            { portal_section: section },
            {
              projection: {
                product_id: 1, title: 1, year: 1,
                jurisdiction: 1, portal_section: 1,
                report_number: 1, last_indexed: 1,
                'state_ut.name': 1,
              },
            }
          )
          .sort({ year: -1, last_indexed: -1 })
          .limit(PER_SECTION)
          .toArray()

        return {
          section,
          reports: docs.map(d => ({
            product_id:    d.product_id,
            title:         (d.title?.en || Object.values(d.title || {})[0] || d.product_id) as string,
            year:          d.year as number,
            jurisdiction:  d.jurisdiction as string | undefined,
            portal_section: d.portal_section as string,
            report_number: d.report_number as { number: number; year: number } | undefined,
            last_indexed:  d.last_indexed as string,
          })),
        }
      })
    )

    // Shape into keyed object
    const latest: Record<string, unknown[]> = {}
    for (const { section, reports } of results) {
      latest[section] = reports
    }

    return NextResponse.json(latest, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch (err) {
    console.error('home/latest error:', err)
    return NextResponse.json({ error: 'Failed to load latest reports' }, { status: 500 })
  }
}
