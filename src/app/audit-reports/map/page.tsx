import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'
import IndiaMapClient from '@/components/map/IndiaMapClient'

export const metadata: Metadata = { title: 'Browse Audit Reports by Map — CAG' }

const JUR_LABELS: Record<string, string> = {
  STATE: 'State', UT: 'Union Territory', LG: 'Local Body',
}

export default async function AuditReportsMapPage({
  searchParams,
}: {
  searchParams: { jurisdiction?: string }
}) {
  const jur = (searchParams.jurisdiction || 'UT') as 'UT' | 'STATE' | 'LG'
  const label = JUR_LABELS[jur] || jur

  const db = await getDb()

  // Count reports per state_id for this jurisdiction
  const pipeline = [
    { $match: { portal_section: 'audit_reports', jurisdiction: jur, state_id: { $exists: true, $ne: null } } },
    { $group: { _id: '$state_id', count: { $sum: 1 } } },
  ]
  const rows = await db.collection('catalog_index').aggregate(pipeline).toArray()
  const reportCounts: Record<string, number> = {}
  for (const row of rows) {
    if (row._id) reportCounts[row._id] = row.count
  }

  const totalRegions  = Object.keys(reportCounts).length
  const totalReports  = Object.values(reportCounts).reduce((a, b) => a + b, 0)

  return (
    <main id="main-content" style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: '20px', display: 'flex', gap: '6px' }}>
        <Link href="/" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Home</Link>
        <span>›</span>
        <Link href="/audit-reports" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Audit Reports</Link>
        <span>›</span>
        <span>Browse by Map</span>
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '30px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
            {label} Audit Reports
          </h1>
          <p style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'var(--ink3)', margin: 0 }}>
            {totalReports} report{totalReports !== 1 ? 's' : ''} across {totalRegions} region{totalRegions !== 1 ? 's' : ''} · click a region to view its reports
          </p>
        </div>

        {/* List view link */}
        <Link href={`/audit-reports?jurisdiction=${jur}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            fontFamily: 'system-ui', fontSize: '12px', fontWeight: 600,
            color: 'var(--navy)', background: 'var(--navy-lt)',
            padding: '7px 16px', borderRadius: '20px', textDecoration: 'none',
            border: '1px solid rgba(26,58,107,.2)', flexShrink: 0,
          }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
          List view
        </Link>
      </div>

      {/* Jurisdiction switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {[
          { label: 'Union Territories', jur: 'UT'    },
          { label: 'States',            jur: 'STATE' },
          { label: 'Local Bodies',      jur: 'LG'    },
        ].map(item => (
          <Link key={item.jur}
            href={`/audit-reports/map?jurisdiction=${item.jur}`}
            style={{
              fontFamily: 'system-ui', fontSize: '12px', fontWeight: 600,
              padding: '6px 16px', borderRadius: '20px', textDecoration: 'none',
              border: '1px solid',
              borderColor: jur === item.jur ? 'var(--navy)' : 'var(--rule)',
              background:  jur === item.jur ? 'var(--navy)' : '#fff',
              color:       jur === item.jur ? '#fff'        : 'var(--ink2)',
            }}>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Two-column layout: map + sidebar */}
      <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Map */}
        <div style={{ flex: '1 1 400px', minWidth: 0 }}>
          <IndiaMapClient
            jurisdiction={jur}
            reportCounts={reportCounts}
          />
        </div>

        {/* Sidebar: regions with reports */}
        <div style={{ flex: '0 0 260px', minWidth: '220px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--rule)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ background: 'var(--navy)', padding: '11px 16px' }}>
              <span style={{ fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>
                {label}s with Reports
              </span>
            </div>
            {Object.keys(reportCounts).length === 0 ? (
              <div style={{ padding: '20px 16px', fontFamily: 'system-ui', fontSize: '13px', color: 'var(--ink3)', textAlign: 'center' }}>
                No reports ingested yet for this jurisdiction.
              </div>
            ) : (
              <div>
                {Object.entries(reportCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([stateId, count]) => (
                    <Link key={stateId}
                      href={`/audit-reports?jurisdiction=${jur}&state=${stateId}`}
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--rule-lt)' }}
                      className="section-row">
                      <span style={{ fontFamily: 'system-ui', fontSize: '12px', color: 'var(--ink)', fontWeight: 500 }}>
                        {stateId}
                      </span>
                      <span style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, background: 'var(--navy)', color: '#fff', padding: '1px 8px', borderRadius: '10px' }}>
                        {count}
                      </span>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {/* LG notice */}
          {jur === 'LG' && (
            <div style={{ marginTop: '16px', background: 'var(--amber-lt)', border: '1px solid rgba(122,74,0,.2)', borderRadius: '8px', padding: '12px 14px' }}>
              <p style={{ fontFamily: 'system-ui', fontSize: '12px', color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
                Local body reports require <code>state_id</code> to be populated in the catalog. This will be available after the v2 pipeline update.
              </p>
            </div>
          )}
        </div>
      </div>

    </main>
  )
}
