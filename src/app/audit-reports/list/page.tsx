import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'
import FiltersPanel, { type FilterDef, type FilterGroup } from '@/components/audit/FiltersPanel'

export const metadata: Metadata = { title: 'Audit Reports — CAG Digital Repository' }

const JUR_LABELS: Record<string, string> = {
  UNION: 'Union', STATE: 'State', UT: 'Union Territory', LG: 'Local Body',
}

const AT_LABELS: Record<string, string> = {
  'ATYPE-COMPLIANCE':   'Compliance Audit',
  'ATYPE-PERFORMANCE':  'Performance Audit',
  'ATYPE-FINANCIAL':    'Financial Audit',
  'ATYPE-IT-AUDIT':     'IT Audit',
  'ATYPE-CERTIFICATION':'Certification',
  'ATYPE-ENVIRONMENTAL':'Environmental Audit',
}

const LANG_NAMES: Record<string, string> = {
  en:'English', hi:'Hindi', mr:'Marathi', ta:'Tamil',
  te:'Telugu',  kn:'Kannada', ml:'Malayalam', gu:'Gujarati',
  pa:'Punjabi', bn:'Bengali', or:'Odia', as:'Assamese',
}

type SP = Record<string, string | string[] | undefined>

function getAll(sp: SP, key: string): string[] {
  const v = sp[key]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function parseParam(sp: SP, key: string) {
  const vals = getAll(sp, key)
  return {
    inc: vals.filter(v => !v.startsWith('-')),
    exc: vals.filter(v =>  v.startsWith('-')).map(v => v.slice(1)),
  }
}

/** Build a MongoDB filter from active searchParams */
function buildFilter(
  sp: SP,
  overrides: { excludeKey?: string } = {}
): Record<string, unknown> {
  const filter: Record<string, unknown> = { portal_section: 'audit_reports' }
  if (sp.jurisdiction) filter.jurisdiction = sp.jurisdiction
  if (sp.state)        filter.state_id     = sp.state

  function applyArray(field: string, key: string) {
    if (key === overrides.excludeKey) return
    const { inc, exc } = parseParam(sp, key)
    const conds: unknown[] = []
    if (inc.length) conds.push({ [field]: { $in: inc } })
    if (exc.length) conds.push({ [field]: { $nin: exc } })
    if (conds.length === 1) Object.assign(filter, conds[0])
    else if (conds.length > 1) {
      filter.$and = [...((filter.$and as unknown[]) || []), ...conds]
    }
  }

  function applyYear(key: string) {
    if (key === overrides.excludeKey) return
    const { inc, exc } = parseParam(sp, key)
    const toNum = (v: string) => parseInt(v)
    if (inc.length) filter.year = inc.length === 1 ? toNum(inc[0]) : { $in: inc.map(toNum) }
    if (exc.length) filter.year = { ...(filter.year as object || {}), $nin: exc.map(toNum) }
  }

  applyYear('year')
  applyArray('audit_type',    'audit_type')
  applyArray('report_sector', 'sector')
  applyArray('languages',     'language')

  return filter
}

function ml(obj: unknown): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  const o = obj as Record<string, string>
  return o.en || Object.values(o)[0] || ''
}

export default async function AuditReportsListPage({ searchParams }: { searchParams: SP }) {
  const db  = await getDb()
  const jur = searchParams.jurisdiction as string | undefined

  // ── Topic expansion ─────────────────────────────────────────────────────
  let topicFilter: unknown = undefined
  if (searchParams.topic) {
    const subs = await db.collection('taxonomy_topics')
      .distinct('id', { parent_id: searchParams.topic, level: 'sub_topic' })
    const ids = subs.length > 0 ? [searchParams.topic as string, ...subs] : [searchParams.topic as string]
    topicFilter = { topics: { $in: ids } }
  }

  // ── Main results with all filters ───────────────────────────────────────
  const filter = buildFilter(searchParams)
  if (topicFilter) Object.assign(filter, topicFilter)

  const docs = await db.collection('catalog_index')
    .find(filter, {
      projection: {
        product_id:1, title:1, year:1, jurisdiction:1, report_number:1,
        summary:1, state_id:1, audit_type:1, report_sector:1,
        topics:1, tabling_dates:1, languages:1,
      },
    })
    .sort({ year: -1, 'report_number.number': 1 })
    .limit(200)
    .toArray()

  const totalCount = docs.length

  // ── Load sector taxonomy ────────────────────────────────────────────────
  const sectorEntries = await db.collection('taxonomy_report_sector')
    .find({}, { projection: { id:1, label:1, level:1, parent_id:1 } })
    .toArray() as { id:string; label?:{en?:string}; level?:string; parent_id?:string }[]

  const sectorLabelMap: Record<string,string> = {}
  for (const e of sectorEntries) sectorLabelMap[e.id] = e.label?.en || e.id

  const sectorParents = sectorEntries.filter(e => e.level === 'sector')
  const sectorChildren = sectorEntries.filter(e => e.level === 'sub_sector')
  const childrenByParent: Record<string, typeof sectorChildren> = {}
  for (const s of sectorParents) childrenByParent[s.id] = []
  for (const c of sectorChildren) {
    if (c.parent_id && childrenByParent[c.parent_id]) childrenByParent[c.parent_id].push(c)
  }

  // ── Compute inter-dependent filter counts ───────────────────────────────
  // For each filter dimension, count results using all OTHER active filters
  // so that available options reflect what remains after other constraints.
  async function countByField(
    field: string,
    excludeKey: string,
    unwrap: boolean,
  ): Promise<Record<string, number>> {
    const f = { ...buildFilter(searchParams, { excludeKey }), ...(topicFilter || {}) }
    const pipeline = unwrap
      ? [{ $match: f }, { $unwind: { path: `$${field}`, preserveNullAndEmpty: false } },
         { $group: { _id: `$${field}`, count: { $sum: 1 } } }]
      : [{ $match: f }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]
    const rows = await db.collection('catalog_index').aggregate(pipeline).toArray()
    const out: Record<string, number> = {}
    for (const r of rows) if (r._id != null) out[String(r._id)] = r.count
    return out
  }

  const [yearCounts, atCounts, secCounts, langCounts] = await Promise.all([
    countByField('year',          'year',     false),
    countByField('audit_type',    'audit_type', true),
    countByField('report_sector', 'sector',   true),
    countByField('languages',     'language', true),
  ])

  // ── Build FilterDefs ────────────────────────────────────────────────────
  // A value is 'disabled' if count=0 AND it isn't currently selected
  function makeOpts(
    counts: Record<string, number>,
    labelFn: (v: string) => string,
    activeKey: string,
    sortDesc = true,
  ) {
    const { inc, exc } = parseParam(searchParams, activeKey)
    const active = new Set([...inc, ...exc])
    const entries = Object.entries(counts)
    if (sortDesc) entries.sort((a, b) => b[1] - a[1])
    return entries
      .map(([value, count]) => ({
        value,
        label: labelFn(value),
        count,
        disabled: count === 0 && !active.has(value),
      }))
      .filter(o => !o.disabled || active.has(o.value)) // hide truly irrelevant options
  }

  const yearOpts = makeOpts(yearCounts, v => v, 'year', true)
  const atOpts   = makeOpts(atCounts,   v => AT_LABELS[v] || v, 'audit_type', true)
  const langOpts = makeOpts(langCounts, v => LANG_NAMES[v] || v.toUpperCase(), 'language', true)

  // Sector — hierarchical groups
  const { inc: secInc, exc: secExc } = parseParam(searchParams, 'sector')
  const activeSectors = new Set([...secInc, ...secExc])

  const sectorGroups: FilterGroup[] = sectorParents
    .filter(p => {
      const parentCount = secCounts[p.id] || 0
      const subCounts = childrenByParent[p.id]?.reduce((s, c) => s + (secCounts[c.id] || 0), 0) || 0
      return parentCount + subCounts > 0 || activeSectors.has(p.id)
    })
    .map(p => ({
      parentValue: p.id,
      parentLabel: p.label?.en || p.id,
      options: (childrenByParent[p.id] || [])
        .filter(c => (secCounts[c.id] || 0) > 0 || activeSectors.has(c.id))
        .map(c => ({
          value:    c.id,
          label:    c.label?.en || c.id,
          count:    secCounts[c.id] || 0,
          disabled: (secCounts[c.id] || 0) === 0 && !activeSectors.has(c.id),
        })),
    }))

  const filterDefs: FilterDef[] = [
    { key: 'year',       label: 'Year',       options: yearOpts, maxShown: 8 },
    ...(atOpts.length   ? [{ key: 'audit_type', label: 'Audit Type', options: atOpts }]   : []),
    ...(sectorGroups.length ? [{ key: 'sector',  label: 'Sector',     groups: sectorGroups }] : []),
    ...(langOpts.length > 1 ? [{ key: 'language', label: 'Language',  options: langOpts }]   : []),
  ]

  // ── Heading + tabs ──────────────────────────────────────────────────────
  const heading = jur ? (JUR_LABELS[jur] || jur) + ' Audit Reports' : 'All Audit Reports'

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

      {/* Tabs */}
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
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            🗾 Map
          </Link>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

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
                const title  = ml(doc.title)
                const rn     = doc.report_number as { number: number; year: number } | undefined
                const tdate  = (doc.tabling_dates as Record<string,string>|undefined)?.lower_house
                const atypes = (doc.audit_type as string[]|undefined) || []
                const sects  = (doc.report_sector as string[]|undefined) || []

                return (
                  <Link key={doc.product_id} href={'/report/' + doc.product_id} style={{
                    display: 'block', textDecoration: 'none',
                    padding: '14px 18px', borderRadius: 10,
                    border: '1px solid var(--rule)', background: '#fff',
                    transition: 'box-shadow .12s, border-color .12s',
                  }}
                  className="report-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start',
                                  justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                      <span style={{ fontFamily: 'system-ui', fontSize: 11,
                                     color: 'var(--ink3)', flexShrink: 0 }}>
                        {tdate ? tdate.slice(0, 7) : doc.year}
                      </span>
                    </div>

                    <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                                  fontSize: 16, fontWeight: 600, color: 'var(--navy)',
                                  lineHeight: 1.35, marginBottom: 6 }}>
                      {title}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {sects.slice(0, 2).map(s => (
                        <span key={s} style={{ fontFamily: 'system-ui', fontSize: 10,
                                               color: 'var(--ink3)', background: '#f4f6f8',
                                               padding: '2px 7px', borderRadius: 8,
                                               border: '1px solid var(--rule-lt)' }}>
                          {sectorLabelMap[s] || s.replace(/^SECT-\w+-?/,'').replace(/-/g,' ')}
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
