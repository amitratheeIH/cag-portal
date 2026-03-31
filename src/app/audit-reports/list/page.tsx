import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'
import FiltersPanel, { type FilterDef } from '@/components/audit/FiltersPanel'

export const metadata: Metadata = { title: 'Audit Reports — CAG Digital Repository' }

const JUR_LABELS: Record<string, string> = {
  UNION: 'Union', STATE: 'State', UT: 'Union Territory', LG: 'Local Body',
}
const AT_LABELS: Record<string, string> = {
  'ATYPE-COMPLIANCE':    'Compliance Audit',
  'ATYPE-PERFORMANCE':   'Performance Audit',
  'ATYPE-FINANCIAL':     'Financial Audit',
  'ATYPE-IT-AUDIT':      'IT Audit',
  'ATYPE-CERTIFICATION': 'Certification',
  'ATYPE-ENVIRONMENTAL': 'Environmental Audit',
}
const LANG_NAMES: Record<string, string> = {
  en:'English', hi:'Hindi', mr:'Marathi', ta:'Tamil',
  te:'Telugu', kn:'Kannada', ml:'Malayalam', gu:'Gujarati',
  pa:'Punjabi', bn:'Bengali', or:'Odia', as:'Assamese',
}

type SP = Record<string, string | string[] | undefined>

function getAll(sp: SP, key: string): string[] {
  const v = sp[key]; if (!v) return []
  return Array.isArray(v) ? v : [v]
}

/** Decode ?key=val&key=-val → { inc: [], exc: [] } */
function parse(sp: SP, key: string) {
  const vals = getAll(sp, key)
  return {
    inc: vals.filter(v => !v.startsWith('-')),
    exc: vals.filter(v =>  v.startsWith('-')).map(v => v.slice(1)),
  }
}

/** Build the full MongoDB filter from all active URL params */
function buildMongoFilter(sp: SP, topicIds?: string[]): Record<string, unknown> {
  const f: Record<string, unknown> = { portal_section: 'audit_reports' }
  if (sp.jurisdiction) f.jurisdiction = sp.jurisdiction
  if (sp.state)        f.state_id     = sp.state
  if (topicIds)        f.topics        = { $in: topicIds }

  function applyArray(field: string, key: string) {
    const { inc, exc } = parse(sp, key)
    const conds: unknown[] = []
    if (inc.length) conds.push({ [field]: { $in: inc } })
    if (exc.length) conds.push({ [field]: { $nin: exc } })
    if (conds.length === 1) Object.assign(f, conds[0])
    else if (conds.length > 1) f.$and = [...((f.$and as unknown[]) || []), ...conds]
  }

  // Year scalar
  const { inc: yi, exc: ye } = parse(sp, 'year')
  if (yi.length) f.year = yi.length === 1 ? +yi[0] : { $in: yi.map(Number) }
  if (ye.length) f.year = { ...(f.year as object || {}), $nin: ye.map(Number) }

  applyArray('audit_type',    'audit_type')
  applyArray('report_sector', 'sector')
  applyArray('languages',     'language')

  return f
}

function ml(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  const o = v as Record<string, string>
  return o.en || Object.values(o)[0] || ''
}

export default async function AuditReportsListPage({ searchParams }: { searchParams: SP }) {
  const db  = await getDb()
  const jur = searchParams.jurisdiction as string | undefined

  // ── Topic expansion ────────────────────────────────────────────────────
  let topicIds: string[] | undefined
  if (searchParams.topic) {
    const subs = await db.collection('taxonomy_topics')
      .distinct('id', { parent_id: searchParams.topic, level: 'sub_topic' })
    topicIds = subs.length > 0
      ? [searchParams.topic as string, ...subs]
      : [searchParams.topic as string]
  }

  // ── Build filter and fetch results ─────────────────────────────────────
  const filter = buildMongoFilter(searchParams, topicIds)

  const docs = await db.collection('catalog_index')
    .find(filter, {
      projection: {
        product_id:1, title:1, year:1, jurisdiction:1,
        report_number:1, state_id:1, audit_type:1,
        report_sector:1, topics:1, tabling_dates:1, languages:1,
      },
    })
    .sort({ year: -1, 'report_number.number': 1 })
    .limit(200)
    .toArray()

  // ── Facet counts: all from the SAME filtered result set ────────────────
  // This is the archive.org model — counts always reflect current results.
  const [yearFacet, atFacet, secFacet, langFacet] = await Promise.all([
    db.collection('catalog_index').aggregate([
      { $match: filter },
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]).toArray(),

    db.collection('catalog_index').aggregate([
      { $match: filter },
      { $unwind: { path: '$audit_type', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$audit_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),

    db.collection('catalog_index').aggregate([
      { $match: filter },
      { $unwind: { path: '$report_sector', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$report_sector', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),

    db.collection('catalog_index').aggregate([
      { $match: filter },
      { $unwind: { path: '$languages', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$languages', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
  ])

  // Convert to maps: value → count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toMap = (rows: any[]) => {
    const m: Record<string, number> = {}
    for (const r of rows) if (r._id != null) m[String(r._id)] = r.count
    return m
  }
  const yearMap = toMap(yearFacet)
  const atMap   = toMap(atFacet)
  const secMap  = toMap(secFacet)
  const langMap = toMap(langFacet)

  // ── Sector taxonomy (hierarchical) ────────────────────────────────────
  const sectorEntries = await db.collection('taxonomy_report_sector')
    .find({}, { projection: { id:1, label:1, level:1, parent_id:1, sort_order:1 } })
    .sort({ sort_order: 1 })
    .toArray() as unknown as { id:string; label?:{en?:string}; level?:string; parent_id?:string }[]

  const secLabelMap: Record<string,string> = {}
  for (const e of sectorEntries) secLabelMap[e.id] = e.label?.en || e.id

  const sectorParents  = sectorEntries.filter(e => e.level === 'sector')
  const sectorChildren = sectorEntries.filter(e => e.level === 'sub_sector')
  const byParent: Record<string, typeof sectorChildren> = {}
  for (const p of sectorParents) byParent[p.id] = []
  for (const c of sectorChildren) if (c.parent_id && byParent[c.parent_id]) byParent[c.parent_id].push(c)

  // ── Build FilterDefs ───────────────────────────────────────────────────
  // Options = all values that appear in current results.
  // count = how many current results have that value.
  // Zero-count options are hidden (they can't be in results anyway).

  const filterDefs: FilterDef[] = [
    {
      key: 'year', label: 'Year', maxShown: 8,
      options: yearFacet.map(r => ({
        value: String(r._id),
        label: String(r._id),
        count: r.count,
      })),
    },
    ...(atFacet.length ? [{
      key: 'audit_type', label: 'Audit Type',
      options: atFacet.map(r => ({
        value: String(r._id),
        label: AT_LABELS[String(r._id)] || String(r._id),
        count: r.count,
      })),
    }] : []),
    ...(secFacet.length ? [{
      key: 'sector', label: 'Sector',
      // Hierarchical: group sub-sectors under parents
      groups: sectorParents
        .filter(p => secMap[p.id] || byParent[p.id]?.some(c => secMap[c.id]))
        .map(p => ({
          parentValue: p.id,
          parentLabel: p.label?.en || p.id,
          parentCount: secMap[p.id],
          options: byParent[p.id]
            .filter(c => secMap[c.id] > 0)
            .map(c => ({
              value: c.id,
              label: c.label?.en || c.id,
              count: secMap[c.id] || 0,
            })),
        })),
    }] : []),
    ...(langFacet.length > 1 ? [{
      key: 'language', label: 'Language',
      options: langFacet.map(r => ({
        value: String(r._id),
        label: LANG_NAMES[String(r._id)] || String(r._id).toUpperCase(),
        count: r.count,
      })),
    }] : []),
  ]

  const heading = jur ? (JUR_LABELS[jur] || jur) + ' Audit Reports' : 'All Audit Reports'

  return (
    <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                    letterSpacing: '1.2px', textTransform: 'uppercase',
                    color: 'var(--ink3)', marginBottom: 20, display: 'flex', gap: 6 }}>
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
        {([
          ['All',             '/audit-reports/list'],
          ['Union',           '/audit-reports/list?jurisdiction=UNION'],
          ['State',           '/audit-reports/list?jurisdiction=STATE'],
          ['Union Territory', '/audit-reports/list?jurisdiction=UT'],
          ['Local Body',      '/audit-reports/list?jurisdiction=LG'],
        ] as [string,string][]).map(([label, href]) => {
          const active = jur
            ? href === '/audit-reports/list?jurisdiction=' + jur
            : href === '/audit-reports/list'
          return (
            <Link key={href} href={href} style={{
              fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
              padding: '5px 16px', borderRadius: 20, textDecoration: 'none',
              border: '1px solid',
              borderColor: active ? 'var(--navy)' : 'var(--rule)',
              background:  active ? 'var(--navy)' : '#fff',
              color:       active ? '#fff'        : 'var(--ink2)',
            }}>
              {label}
            </Link>
          )
        })}
        {jur && (
          <Link href={'/audit-reports/map?jurisdiction=' + jur} style={{
            fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
            padding: '5px 16px', borderRadius: 20, textDecoration: 'none',
            border: '1px solid var(--rule)', background: '#fff', color: 'var(--ink2)',
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            🗾 Map
          </Link>
        )}
      </div>

      {/* Filters + results */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        <FiltersPanel filters={filterDefs} totalCount={docs.length} />

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
                const title  = ml(doc.title)
                const rn     = doc.report_number as { number:number; year:number } | undefined
                const tdate  = (doc.tabling_dates as Record<string,string>|undefined)?.lower_house
                const atypes = (doc.audit_type as string[]|undefined) || []
                const sects  = (doc.report_sector as string[]|undefined) || []
                return (
                  <Link key={doc.product_id} href={'/report/' + doc.product_id} style={{
                    display: 'block', textDecoration: 'none',
                    padding: '14px 18px', borderRadius: 10,
                    border: '1px solid var(--rule)', background: '#fff',
                    transition: 'box-shadow .12s, border-color .12s',
                  }} className="report-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
                      <span style={{ fontFamily: 'system-ui', fontSize: 11, color: 'var(--ink3)', flexShrink: 0 }}>
                        {tdate ? tdate.slice(0, 7) : doc.year}
                      </span>
                    </div>
                    <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                                  fontSize: 16, fontWeight: 600, color: 'var(--navy)',
                                  lineHeight: 1.35, marginBottom: 6 }}>
                      {title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {sects.slice(0, 2).map(s => (
                        <span key={s} style={{ fontFamily: 'system-ui', fontSize: 10,
                                               color: 'var(--ink3)', background: '#f4f6f8',
                                               padding: '2px 7px', borderRadius: 8,
                                               border: '1px solid var(--rule-lt)' }}>
                          {secLabelMap[s] || s.replace(/^SECT-\w+-?/,'').replace(/-/g,' ')}
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
