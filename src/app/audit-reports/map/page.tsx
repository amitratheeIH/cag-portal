import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'
import IndiaMapClient from '@/components/map/IndiaMapClient'

export const metadata: Metadata = { title: 'Browse by Map — CAG Audit Reports' }

// ─── Full region registry ────────────────────────────────────────────────────
const REGION_NAMES: Record<string, string> = {
  'IN-AN': 'Andaman & Nicobar Islands',
  'IN-AP': 'Andhra Pradesh',
  'IN-AR': 'Arunachal Pradesh',
  'IN-AS': 'Assam',
  'IN-BR': 'Bihar',
  'IN-CH': 'Chandigarh',
  'IN-CT': 'Chhattisgarh',
  'IN-DD': 'Dadra, Nagar Haveli & Daman-Diu',
  'IN-DL': 'Delhi (NCT)',
  'IN-GA': 'Goa',
  'IN-GJ': 'Gujarat',
  'IN-HR': 'Haryana',
  'IN-HP': 'Himachal Pradesh',
  'IN-JK': 'Jammu & Kashmir',
  'IN-JH': 'Jharkhand',
  'IN-KA': 'Karnataka',
  'IN-KL': 'Kerala',
  'IN-LD': 'Lakshadweep',
  'IN-MP': 'Madhya Pradesh',
  'IN-MH': 'Maharashtra',
  'IN-MN': 'Manipur',
  'IN-ML': 'Meghalaya',
  'IN-MZ': 'Mizoram',
  'IN-NL': 'Nagaland',
  'IN-OD': 'Odisha',
  'IN-PY': 'Puducherry',
  'IN-PB': 'Punjab',
  'IN-RJ': 'Rajasthan',
  'IN-SK': 'Sikkim',
  'IN-TN': 'Tamil Nadu',
  'IN-TG': 'Telangana',
  'IN-TR': 'Tripura',
  'IN-UP': 'Uttar Pradesh',
  'IN-UK': 'Uttarakhand',
  'IN-WB': 'West Bengal',
}

const ALL_UTS: string[] = [
  'IN-AN','IN-CH','IN-DD','IN-DL','IN-JK','IN-LD','IN-PY',
]

const ALL_STATES: string[] = [
  'IN-AP','IN-AR','IN-AS','IN-BR','IN-CT','IN-GA','IN-GJ','IN-HR',
  'IN-HP','IN-JH','IN-KA','IN-KL','IN-MP','IN-MH','IN-MN','IN-ML',
  'IN-MZ','IN-NL','IN-OD','IN-PB','IN-RJ','IN-SK','IN-TN','IN-TG',
  'IN-TR','IN-UP','IN-UK','IN-WB',
]

const JUR_LABELS: Record<string, string> = {
  STATE: 'State', UT: 'Union Territory', LG: 'Local Body',
}

export default async function AuditReportsMapPage({
  searchParams,
}: {
  searchParams: { jurisdiction?: string }
}) {
  const jur    = (searchParams.jurisdiction || 'UT') as 'UT' | 'STATE' | 'LG'
  const label  = JUR_LABELS[jur] || jur
  const allIds = jur === 'STATE' ? ALL_STATES : jur === 'UT' ? ALL_UTS : [...ALL_UTS, ...ALL_STATES]

  const db = await getDb()

  // ── Count reports per state_id for this jurisdiction ──
  const rows = await db
    .collection('catalog_index')
    .aggregate([
      {
        $match: {
          portal_section: 'audit_reports',
          jurisdiction: jur,
          state_id: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$state_id', count: { $sum: 1 } } },
    ])
    .toArray()

  // reportCounts: stateId → count (only regions WITH reports)
  const reportCounts: Record<string, number> = {}
  for (const row of rows) {
    if (row._id) reportCounts[row._id] = row.count
  }

  // ── Build full list (all regions, count = 0 if no reports) ──
  const allRegions = allIds.map(id => ({
    id,
    name:  REGION_NAMES[id] ?? id,
    count: reportCounts[id] ?? 0,
  }))

  // Sort: regions with reports first (by count desc), then alphabetical
  allRegions.sort((a, b) =>
    b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)
  )

  const totalReports = Object.values(reportCounts).reduce((s, n) => s + n, 0)
  const covered      = Object.keys(reportCounts).length

  return (
    <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* Breadcrumb */}
      <div style={{
        fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
        letterSpacing: '1.2px', textTransform: 'uppercase',
        color: 'var(--ink3)', marginBottom: 20, display: 'flex', gap: 6,
      }}>
        <Link href="/" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Home</Link>
        <span>›</span>
        <Link href="/audit-reports" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Audit Reports</Link>
        <span>›</span>
        <span>Map</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontFamily: '"EB Garamond","Times New Roman",serif',
            fontSize: 30, fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px',
          }}>
            {label} Audit Reports — Map View
          </h1>
          <p style={{ fontFamily: 'system-ui', fontSize: 13, color: 'var(--ink3)', margin: 0 }}>
            {totalReports} report{totalReports !== 1 ? 's' : ''} across{' '}
            {covered} of {allIds.length} {label.toLowerCase()}{allIds.length !== 1 ? 's' : ''}{' '}
            · hover a region for details · click to view reports
          </p>
        </div>
        <Link href={`/audit-reports?jurisdiction=${jur}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
          color: 'var(--navy)', background: 'var(--navy-lt)',
          padding: '7px 16px', borderRadius: 20, textDecoration: 'none',
          border: '1px solid rgba(26,58,107,.2)', flexShrink: 0,
        }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
          List view
        </Link>
      </div>

      {/* Jurisdiction tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {([
          ['Union Territories', 'UT'],
          ['States',            'STATE'],
          ['Local Bodies',      'LG'],
        ] as [string, string][]).map(([lbl, j]) => (
          <Link key={j} href={`/audit-reports/map?jurisdiction=${j}`} style={{
            fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
            padding: '6px 18px', borderRadius: 20, textDecoration: 'none',
            border: '1px solid',
            borderColor: jur === j ? 'var(--navy)' : 'var(--rule)',
            background:  jur === j ? 'var(--navy)' : '#fff',
            color:       jur === j ? '#fff'        : 'var(--ink2)',
          }}>
            {lbl}
          </Link>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Map */}
        <div style={{ flex: '1 1 400px', minWidth: 0 }}>
          <IndiaMapClient jurisdiction={jur} reportCounts={reportCounts} />
        </div>

        {/* Right panel — ALL regions, count 0 if no reports */}
        <div style={{ flex: '0 0 270px', minWidth: 220 }}>
          <div style={{
            background: '#fff', border: '1px solid var(--rule)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {/* Panel header */}
            <div style={{ background: 'var(--navy)', padding: '11px 16px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)',
              }}>
                All {label}s
              </span>
              <span style={{
                fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,.5)', letterSpacing: '0.5px',
              }}>
                {covered}/{allIds.length} with reports
              </span>
            </div>

            {/* Scrollable list */}
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {allRegions.map(({ id, name, count }) => (
                <Link
                  key={id}
                  href={`/audit-reports?jurisdiction=${jur}&state=${id}`}
                  style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 16px',
                    borderBottom: '1px solid var(--rule-lt)',
                    textDecoration: 'none',
                    background: '#fff',
                    transition: 'background .1s',
                  }}
                  className="map-region-row"
                >
                  <span style={{
                    fontFamily: 'system-ui', fontSize: 12,
                    color: count > 0 ? 'var(--ink)' : 'var(--ink3)',
                    fontWeight: count > 0 ? 500 : 400,
                    flex: 1, marginRight: 8,
                    lineHeight: 1.35,
                  }}>
                    {name}
                  </span>
                  {count > 0 ? (
                    <span style={{
                      fontFamily: 'system-ui', fontSize: 11, fontWeight: 700,
                      background: 'var(--navy)', color: '#fff',
                      padding: '2px 9px', borderRadius: 10, flexShrink: 0,
                    }}>
                      {count}
                    </span>
                  ) : (
                    <span style={{
                      fontFamily: 'system-ui', fontSize: 10,
                      color: 'var(--ink3)', flexShrink: 0,
                    }}>
                      —
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {jur === 'LG' && (
            <div style={{
              marginTop: 16, background: 'var(--amber-lt)',
              border: '1px solid rgba(122,74,0,.2)',
              borderRadius: 8, padding: '12px 14px',
            }}>
              <p style={{ fontFamily: 'system-ui', fontSize: 12, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
                Local body data requires <code>state_id</code> in the catalog. Counts will populate after the next pipeline run.
              </p>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
