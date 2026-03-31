import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'
import IndiaMapClient, { type Region } from '@/components/map/IndiaMapClient'

export const metadata: Metadata = { title: 'Browse by Map — CAG Audit Reports' }

const REGION_NAMES: Record<string, string> = {
  'IN-AN': 'Andaman & Nicobar Islands',
  'IN-AP': 'Andhra Pradesh',    'IN-AR': 'Arunachal Pradesh',
  'IN-AS': 'Assam',             'IN-BR': 'Bihar',
  'IN-CH': 'Chandigarh',        'IN-CT': 'Chhattisgarh',
  'IN-DD': 'Dadra, Nagar Haveli & Daman-Diu',
  'IN-DL': 'Delhi (NCT)',       'IN-GA': 'Goa',
  'IN-GJ': 'Gujarat',           'IN-HR': 'Haryana',
  'IN-HP': 'Himachal Pradesh',  'IN-JK': 'Jammu & Kashmir',
  'IN-JH': 'Jharkhand',         'IN-KA': 'Karnataka',
  'IN-KL': 'Kerala',            'IN-LA': 'Ladakh',
  'IN-LD': 'Lakshadweep',       'IN-MP': 'Madhya Pradesh',
  'IN-MH': 'Maharashtra',       'IN-MN': 'Manipur',
  'IN-ML': 'Meghalaya',         'IN-MZ': 'Mizoram',
  'IN-NL': 'Nagaland',          'IN-OD': 'Odisha',
  'IN-PY': 'Puducherry',        'IN-PB': 'Punjab',
  'IN-RJ': 'Rajasthan',         'IN-SK': 'Sikkim',
  'IN-TN': 'Tamil Nadu',        'IN-TG': 'Telangana',
  'IN-TR': 'Tripura',           'IN-UP': 'Uttar Pradesh',
  'IN-UK': 'Uttarakhand',       'IN-WB': 'West Bengal',
}

const ALL_UTS: string[] = [
  'IN-AN','IN-CH','IN-DD','IN-DL','IN-JK','IN-LA','IN-LD','IN-PY',
]
const ALL_STATES: string[] = [
  'IN-AP','IN-AR','IN-AS','IN-BR','IN-CT','IN-GA','IN-GJ','IN-HR',
  'IN-HP','IN-JH','IN-KA','IN-KL','IN-MP','IN-MH','IN-MN','IN-ML',
  'IN-MZ','IN-NL','IN-OD','IN-PB','IN-RJ','IN-SK','IN-TN','IN-TG',
  'IN-TR','IN-UP','IN-UK','IN-WB',
]

type Jur = 'UT' | 'STATE' | 'UNION' | 'LG'

const JUR_LABEL: Record<Jur, string> = {
  UT:    'Union Territory',
  STATE: 'State',
  UNION: 'Union',
  LG:    'Local Body',
}

export default async function AuditReportsMapPage({
  searchParams,
}: {
  searchParams: { jurisdiction?: string }
}) {
  const jur   = ((searchParams.jurisdiction || 'UT') as Jur)
  const label = JUR_LABEL[jur] ?? jur

  const panelIds =
    jur === 'STATE' ? ALL_STATES :
    jur === 'UT'    ? ALL_UTS    : []  // UNION + LG: sidebar handled by component

  const db = await getDb()

  const rows = await db
    .collection('catalog_index')
    .aggregate([
      { $match: { portal_section: 'audit_reports', jurisdiction: jur, state_id: { $exists: true, $ne: null } } },
      { $group: { _id: '$state_id', count: { $sum: 1 } } },
    ])
    .toArray()

  const reportCounts: Record<string, number> = {}
  for (const row of rows) {
    if (row._id) reportCounts[row._id] = row.count
  }

  const totalReports = Object.values(reportCounts).reduce((s, n) => s + n, 0)

  // Build allRegions for the sidebar (empty for UNION — component shows single row)
  const allRegions: Region[] = panelIds.map(id => ({
    id,
    name:  REGION_NAMES[id] ?? id,
    count: reportCounts[id] ?? 0,
  }))
  allRegions.sort((a, b) =>
    b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)
  )

  const heading =
    jur === 'UNION' ? 'Union Audit Reports — Map View' :
    jur === 'STATE' ? 'State Audit Reports — Map View' :
    jur === 'UT'    ? 'Union Territory Audit Reports — Map View' :
                     'Local Body Audit Reports — Map View'

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
          <h1 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                       fontSize: 30, fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
            {heading}
          </h1>
          <p style={{ fontFamily: 'system-ui', fontSize: 13, color: 'var(--ink3)', margin: 0 }}>
            {jur === 'UNION'
              ? (totalReports > 0
                  ? totalReports + ' Union report' + (totalReports !== 1 ? 's' : '') + ' · click the map to view all'
                  : 'No Union reports ingested yet')
              : (allRegions.filter(r => r.count > 0).length + ' of ' + allRegions.length + ' ' +
                 label.toLowerCase() + (allRegions.length !== 1 ? 's' : '') + ' have reports · hover to preview · click to view')
            }
          </p>
        </div>
        <Link href={'/audit-reports?jurisdiction=' + jur} style={{
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
          ['Union (Central)',    'UNION'],
          ['Union Territories', 'UT'],
          ['States',            'STATE'],
          ['Local Bodies',      'LG'],
        ] as [string, string][]).map(([lbl, j]) => (
          <Link key={j} href={'/audit-reports/map?jurisdiction=' + j} style={{
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

      {/* Map + sidebar (client component owns layout, hover state, and sidebar) */}
      <IndiaMapClient
        jurisdiction={jur}
        reportCounts={reportCounts}
        allRegions={allRegions}
        totalReports={totalReports}
      />

    </main>
  )
}
