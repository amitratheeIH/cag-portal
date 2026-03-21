import { getDb } from '@/lib/mongodb'
import { ml, type CatalogEntry } from '@/types'
import Link from 'next/link'

export const metadata = { title: 'Audit Reports' }
export const dynamic = 'force-dynamic'

async function getReports(): Promise<CatalogEntry[]> {
  try {
    const db = await getDb()
    const docs = await db
      .collection('catalog_index')
      .find({})
      .sort({ year: -1, 'report_number.number': 1 })
      .project({
        product_id: 1, product_type: 1, year: 1,
        jurisdiction: 1, slug: 1, title: 1, summary: 1,
        audit_type: 1, report_sector: 1, audit_period: 1,
        audit_findings_categories: 1, state_ut_id: 1,
        audit_status: 1, report_number: 1, tabling_dates: 1,
      })
      .toArray()
    return docs as CatalogEntry[]
  } catch (err) {
    console.error('getReports error:', err)
    return []
  }
}

function JurisdictionBadge({ j }: { j: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    UT:    { label: 'Union Territory', cls: 'bg-purple-100 text-purple-800' },
    STATE: { label: 'State', cls: 'bg-blue-100 text-blue-800' },
    UNION: { label: 'Union', cls: 'bg-orange-100 text-orange-800' },
    LG:    { label: 'Local Government', cls: 'bg-green-100 text-green-800' },
  }
  const { label, cls } = map[j] || { label: j, cls: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`badge ${cls}`}>{label}</span>
  )
}

function AuditTypeBadge({ types }: { types?: string[] }) {
  if (!types?.length) return null
  const first = types[0].replace('ATYPE-', '')
  return (
    <span className="badge badge-navy">{first}</span>
  )
}

export default async function ReportsPage() {
  const reports = await getReports()

  return (
    <main id="main-content" className="min-h-screen">

      {/* ── Page header ────────────────────────────────── */}
      <div className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <p className="section-label mb-2">Repository</p>
          <h1 className="font-serif text-3xl font-bold text-navy">
            Audit Reports
          </h1>
          <p className="text-cag-text2 mt-2 text-sm">
            {reports.length} report{reports.length !== 1 ? 's' : ''} published
          </p>
        </div>
      </div>

      {/* ── Reports grid ───────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {reports.length === 0 ? (
          <div className="text-center py-20 text-cag-text3">
            <div className="text-4xl mb-4">📋</div>
            <div className="font-semibold">No reports found</div>
            <div className="text-sm mt-1">Run the ingest pipeline to populate the database.</div>
          </div>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <ReportCard key={report.product_id} report={report} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function ReportCard({ report }: { report: CatalogEntry }) {
  const title   = ml(report.title)
  const summary = ml(report.summary)
  const period  = report.audit_period
    ? `${report.audit_period.start_year}–${report.audit_period.end_year}`
    : null
  const tablingDate = report.tabling_dates?.lower_house
  const repNum = report.report_number
    ? `Report No. ${report.report_number.number}/${report.report_number.year}`
    : null

  return (
    <Link
      href={`/report/${report.product_id}`}
      className="card group hover:border-navy hover:shadow-md transition-all block"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">

        {/* Year badge */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center
                        text-white font-bold font-serif text-lg"
             style={{ background: 'var(--navy)' }}>
          {report.year}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2 mb-2">
            <JurisdictionBadge j={report.jurisdiction} />
            <AuditTypeBadge types={report.audit_type} />
            {report.audit_status === 'tabled' && (
              <span className="badge bg-green-100 text-green-800">Tabled</span>
            )}
          </div>

          {/* Title */}
          <h2 className="font-serif font-semibold text-navy group-hover:text-blue
                         text-base leading-snug mb-1 transition-colors">
            {title}
          </h2>

          {/* Summary */}
          {summary && (
            <p className="text-sm text-cag-text2 line-clamp-2 mb-3">
              {summary}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-cag-text3">
            {repNum && <span>{repNum}</span>}
            {period && <span>Audit period: {period}</span>}
            {tablingDate && <span>Tabled: {tablingDate}</span>}
            <span className="font-mono">{report.product_id}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 self-center text-cag-border group-hover:text-navy transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
      </div>
    </Link>
  )
}
