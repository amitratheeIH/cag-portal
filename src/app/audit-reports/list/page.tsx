import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'
import FiltersPanel, { type FilterDef } from '@/components/audit/FiltersPanel'

export const metadata: Metadata = { title: 'Audit Reports — CAG Digital Repository' }

const JUR_LABELS: Record<string, string> = {
  UNION: 'Union', STATE: 'State', UT: 'Union Territory', LG: 'Local Body',
}

// Maps URL param to MongoDB field + decode logic
const FILTER_FIELD: Record<string, string> = {
  year:        'year',
  audit_type:  'audit_type',    // array field — use $elemMatch / $in
  sector:      'report_sector', // array field
  language:    'languages',     // array field
}

function ml(obj: Record<string, string> | string | null | undefined): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.en || Object.values(obj)[0] || ''
}

type SP = {
  jurisdiction?: string; state?: string; topic?: string; year?: string | string[]
  audit_type?: string | string[]; sector?: string | string[]; language?: string | string[]
}

function parseFilterParam(val: string | string[] | undefined): { inc: string[]; exc: string[] } {
  const vals = val ? (Array.isArray(val) ? val : [val]) : []
  const inc = vals.filter(v => !v.startsWith('-'))
  const exc = vals.filter(v => v.startsWith('-')).map(v => v.slice(1))
  return { inc, exc }
}

export default async function AuditReportsListPage({ searchParams }: { searchParams: SP }) {
  const db  = await getDb()
  const jur = searchParams.jurisdiction

  // ── Build MongoDB filter ────────────────────────────────────────────────
  const filter: Record<string, unknown> = { portal_section: 'audit_reports' }
  if (jur)                   filter.jurisdiction = jur
  if (searchParams.state)    filter.state_id     = searchParams.state

  // Topic filter (include sub-topics of parent)
  if (searchParams.topic) {
    const subTopics = await db.collection('taxonomy_topics')
      .distinct('id', { parent_id: searchParams.topic, level: 'sub_topic' })
    const topicIds = subTopics.length > 0
      ? [searchParams.topic, ...subTopics] : [searchParams.topic]
    filter.topics = { $in: topicIds }
  }

  // Apply include/exclude for each filter param
  function applyArrayFilter(field: string, param: string | string[] | undefined) {
    const { inc, exc } = parseFilterParam(param)
    const conditions: unknown[] = []
    if (inc.length > 0) conditions.push({ [field]: { $in: inc } })
    if (exc.length > 0) conditions.push({ [field]: { $nin: exc } })
    if (conditions.length === 1) Object.assign(filter, conditions[0])
    else if (conditions.length > 1) {
      const existing = (filter.$and as unknown[]) || []
      filter.$and = [...existing, ...conditions]
    }
  }

  function applyScalarFilter(field: string, param: string | string[] | undefined) {
    const { inc, exc } = parseFilterParam(param)
    if (inc.length > 0) filter[field] = inc.length === 1 ? Number(inc[0]) || inc[0] : { $in: inc.map(v => Number(v) || v) }
    if (exc.length > 0) filter[field] = { ...(filter[field] as object || {}), $nin: exc.map(v => Number(v) || v) }
  }

  applyScalarFilter('year',       searchParams.year)
  applyArrayFilter('audit_type',  searchParams.audit_type)
  applyArrayFilter('report_sector', searchParams.sector)
  applyArrayFilter('languages',   searchParams.language)

  // ── Fetch matching reports ──────────────────────────────────────────────
  const docs = await db
    .collection('catalog_index')
    .find(filter, {
      projection: {
        product_id: 1, title: 1, year: 1, jurisdiction: 1,
        report_number: 1, summary: 1, state_id: 1, audit_type: 1,
        report_sector: 1, topics: 1, tabling_dates: 1,
      },
    })
    .sort({ year: -1, 'report_number.number': 1 })
    .limit(200)
    .toArray()

  const totalCount = docs.length

  // ── Fetch filter options from DB (counts within current jur) ────────────
  const baseMatch: Record<string, unknown> = { portal_section: 'audit_reports' }
  if (jur) baseMatch.jurisdiction = jur

  const [yearAgg, auditTypeAgg, sectorAgg, langAgg] = await Promise.all([
    db.collection('catalog_index').aggregate([
      { $match: baseMatch },
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]).toArray(),
    db.collection('catalog_index').aggregate([
      { $match: { ...baseMatch, audit_type: { $exists: true } } },
      { $unwind: '$audit_type' },
      { $group: { _id: '$audit_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('catalog_index').aggregate([
      { $match: { ...baseMatch, report_sector: { $exists: true } } },
      { $unwind: '$report_sector' },
      { $group: { _id: '$report_sector', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('catalog_index').aggregate([
      { $match: { ...baseMatch, languages: { $exists: true } } },
      { $unwind: '$languages' },
      { $group: { _id: '$languages', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
  ])

  // Get labels from taxonomy collections
  const [atLabels, secLabels] = await Promise.all([
    db.collection('taxonomy_afc').find({}, { projection: { id: 1, label: 1 } }).toArray()
      .then(() => db.collection('taxonomy_types') // fallback handled below
        .find({}, { projection: { id: 1, label: 1 } }).toArray()
        .catch(() => [])),
    db.collection('taxonomy_sectors')
      .find({}, { projection: { id: 1, label: 1 } }).toArray()
      .catch(() => []),
  ])
  // Use hardcoded fallbacks for audit_type if taxonomy_types not available
  const AT_LABELS: Record<string, string> = {
    'ATYPE-COMPLIANCE': 'Compliance Audit',   'ATYPE-PERFORMANCE': 'Performance Audit',
    'ATYPE-FINANCIAL':  'Financial Audit',    'ATYPE-IT-AUDIT':    'IT Audit',
    'ATYPE-CERTIFICATION': 'Certification',   'ATYPE-ENVIRONMENTAL': 'Environmental Audit',
  }
  const secLabelMap: Record<string, string> = {}
  for (const e of secLabels as { id?: string; label?: { en?: string } }[]) {
    if (e.id) secLabelMap[e.id] = e.label?.en || e.id
  }
  // Fallback: load from taxonomy_report_sector if available
  const sectorEntries = await db.collection('taxonomy_report_sector')
    .find({}, { projection: { id: 1, label: 1 } }).toArray().catch(() => [])
  for (const e of sectorEntries as { id?: string; label?: { en?: string } }[]) {
    if (e.id) secLabelMap[e.id] = e.label?.en || e.id
  }

  const LANG_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil',
    te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', gu: 'Gujarati',
    pa: 'Punjabi', bn: 'Bengali', or: 'Odia', as: 'Assamese',
  }

  // Build FilterDef array
  const filterDefs: FilterDef[] = [
    {
      key: 'year', label: 'Year',
      options: yearAgg.map(r => ({ value: String(r._id), label: String(r._id), count: r.count })),
      maxShown: 8,
    },
    ...(auditTypeAgg.length > 0 ? [{
      key: 'audit_type', label: 'Audit Type',
      options: auditTypeAgg.map(r => ({
        value: String(r._id),
        label: AT_LABELS[String(r._id)] || String(r._id),
        count: r.count,
      })),
    }] : []),
    ...(sectorAgg.length > 0 ? [{
      key: 'sector', label: 'Sector',
      options: sectorAgg.map(r => ({
        value: String(r._id),
        label: secLabelMap[String(r._id)] || String(r._id).replace(/^SECT-\w+-?/, '').replace(/-/g,' '),
        count: r.count,
      })),
      maxShown: 6,
    }] : []),
    ...(langAgg.length > 1 ? [{
      key: 'language', label: 'Language',
      options: langAgg.map(r => ({
        value: String(r._id),
        label: LANG_NAMES[String(r._id)] || String(r._id).toUpperCase(),
        count: r.count,
      })),
    }] : []),
  ]

  // ── Heading ─────────────────────────────────────────────────────────────
  const heading = jur
    ? (JUR_LABELS[jur] || jur) + ' Audit Reports'
    : 'All Audit Reports'

  // ── Tabs ────────────────────────────────────────────────────────────────
  const tabs = [
    { label: 'All',             href: '/audit-reports/list' },
    { label: 'Union',           href: '/audit-reports/list?jurisdiction=UNION' },
    { label: 'State',           href: '/audit-reports/list?jurisdiction=STATE' },
    { label: 'Union Territory', href: '/audit-reports/list?jurisdiction=UT' },
    { label: 'Local Body',      href: '/audit-reports/list?jurisdiction=LG' },
  ]

  return (
    <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                    letterSpacing: '1.2px', textTransform: 'uppercase',
                    color: 'var(--ink3)', marginBottom: 20, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Link href="/" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Home</Link>
        <span>›</span>
        <Link href="/audit-reports" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Audit Reports</Link>
        <span>›</span>
        <span>{heading}</span>
      </div>

      <h1 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                   fontSize: 28, fontWeight: 700, color: 'var(--navy)', margin: '0 0 20px' }}>
        {heading}
      </h1>

      {/* Jurisdiction tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const active = jur
            ? t.href === '/audit-reports/list?jurisdiction=' + jur
            : t.href === '/audit-reports/list'
          return (
            <Link key={t.href} href={t.href} style={{
              fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
              padding: '5px 16px', borderRadius: 20, textDecoration: 'none',
              border: '1px solid',
              borderColor: active ? 'var(--navy)' : 'var(--rule)',
              background:  active ? 'var(--navy)' : '#fff',
              color:       active ? '#fff' : 'var(--ink2)',
            }}>
              {t.label}
            </Link>
          )
        })}
        {jur && (
          <Link href={'/audit-reports/map?jurisdiction=' + jur} style={{
            fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
            padding: '5px 16px', borderRadius: 20, textDecoration: 'none',
            border: '1px solid var(--rule)', background: '#fff', color: 'var(--ink2)',
            display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
          }}>
            🗾 Map view
          </Link>
        )}
      </div>

      {/* Two-column: filters + results */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* Filters sidebar */}
        <FiltersPanel filters={filterDefs} totalCount={totalCount} />

        {/* Results */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {docs.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', borderRadius: 10,
                          border: '1px solid var(--rule)', fontFamily: 'system-ui',
                          fontSize: 13, color: 'var(--ink3)' }}>
              No reports match the current filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {docs.map(doc => {
                const title = ml(doc.title as Record<string,string>)
                const rn    = doc.report_number as { number: number; year: number } | undefined
                const tdate = (doc.tabling_dates as Record<string,string> | undefined)?.lower_house
                const atypes = (doc.audit_type as string[] | undefined) || []
                const sectors = (doc.report_sector as string[] | undefined) || []

                return (
                  <Link key={doc.product_id} href={'/report/' + doc.product_id} style={{
                    display: 'block', textDecoration: 'none',
                    padding: '14px 18px', borderRadius: 10,
                    border: '1px solid var(--rule)', background: '#fff',
                    transition: 'box-shadow .12s, border-color .12s',
                  }}
                  className="report-row"
                  >
                    {/* Report number + year badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start',
                                  justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {rn && (
                          <span style={{ fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                                         background: 'var(--navy)', color: '#fff',
                                         padding: '2px 8px', borderRadius: 10 }}>
                            No. {rn.number}/{rn.year}
                          </span>
                        )}
                        {atypes.map(at => (
                          <span key={at} style={{ fontFamily: 'system-ui', fontSize: 10, fontWeight: 600,
                                                   background: 'var(--navy-lt)', color: 'var(--navy)',
                                                   padding: '2px 7px', borderRadius: 10 }}>
                            {AT_LABELS[at] || at}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontFamily: 'system-ui', fontSize: 11, color: 'var(--ink3)',
                                     flexShrink: 0 }}>
                        {tdate ? tdate.slice(0, 7) : doc.year}
                      </span>
                    </div>

                    {/* Title */}
                    <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                                  fontSize: 16, fontWeight: 600, color: 'var(--navy)',
                                  lineHeight: 1.35, marginBottom: 6 }}>
                      {title}
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {sectors.slice(0, 2).map(s => (
                        <span key={s} style={{ fontFamily: 'system-ui', fontSize: 10,
                                               color: 'var(--ink3)', background: '#f4f6f8',
                                               padding: '2px 7px', borderRadius: 8,
                                               border: '1px solid var(--rule-lt)' }}>
                          {secLabelMap[s] || s.replace(/^SECT-\w+-?/, '').replace(/-/g,' ')}
                        </span>
                      ))}
                      {doc.state_id && (
                        <span style={{ fontFamily: 'system-ui', fontSize: 10, color: 'var(--ink3)' }}>
                          {doc.state_id as string}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .report-row:hover {
          box-shadow: 0 4px 16px rgba(26,58,107,.1);
          border-color: rgba(26,58,107,.25) !important;
        }
      `}</style>
    </main>
  )
}

const AT_LABELS: Record<string, string> = {
  'ATYPE-COMPLIANCE': 'Compliance Audit',   'ATYPE-PERFORMANCE': 'Performance Audit',
  'ATYPE-FINANCIAL':  'Financial Audit',    'ATYPE-IT-AUDIT':    'IT Audit',
  'ATYPE-CERTIFICATION': 'Certification',   'ATYPE-ENVIRONMENTAL': 'Environmental Audit',
}
