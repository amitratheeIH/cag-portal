import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Audit Reports — CAG Digital Repository' }

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('en-IN') }

// ─── Jurisdiction card data ───────────────────────────────────────────────────
const JUR_CARDS = [
  {
    key:   'UNION',
    label: 'Union (Central)',
    sub:   'Reports on Union Government departments, PSUs and autonomous bodies audited by CAG',
    icon:  '🏛️',
    color: '#1a3a6b',
    light: '#e8f0fb',
  },
  {
    key:   'UT',
    label: 'Union Territory',
    sub:   'Reports on Union Territories — with and without legislature',
    icon:  '🗺️',
    color: '#1a6b3a',
    light: '#e8f8ee',
  },
  {
    key:   'STATE',
    label: 'State',
    sub:   'Reports on State Government finances, departments and schemes',
    icon:  '📍',
    color: '#6b1a3a',
    light: '#f8e8ee',
  },
  {
    key:   'LG',
    label: 'Local Body',
    sub:   'Reports on Panchayati Raj, Municipal and Urban Local Bodies',
    icon:  '🏘️',
    color: '#6b4a1a',
    light: '#f8f0e8',
  },
]

export default async function AuditReportsLandingPage() {
  const db = await getDb()

  // ── Jurisdiction counts ──────────────────────────────────────────────────
  const jurRows = await db.collection('catalog_index').aggregate([
    { $match: { portal_section: 'audit_reports' } },
    { $group: { _id: '$jurisdiction', count: { $sum: 1 } } },
  ]).toArray()

  const jurCounts: Record<string, number> = {}
  let totalAudit = 0
  for (const r of jurRows) {
    if (r._id) { jurCounts[r._id] = r.count; totalAudit += r.count }
  }

  // ── Topic counts (top-level topics from taxonomy_topics) ─────────────────
  // Unwind the topics array and count per topic id, then join with taxonomy
  const topicRows = await db.collection('catalog_index').aggregate([
    { $match: { portal_section: 'audit_reports', topics: { $exists: true, $ne: [] } } },
    { $unwind: '$topics' },
    { $group: { _id: '$topics', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray()

  // Get topic labels from taxonomy collection
  const topicEntries = await db.collection('taxonomy_topics')
    .find({ level: 'topic' }, { projection: { id: 1, label: 1 } })
    .toArray()

  const topicLabelMap: Record<string, string> = {}
  const topicParentMap: Record<string, string> = {}
  for (const e of topicEntries) {
    topicLabelMap[e.id] = e.label?.en || e.id
  }
  // Also load sub_topics to map them up to parent
  const subTopicEntries = await db.collection('taxonomy_topics')
    .find({ level: 'sub_topic' }, { projection: { id: 1, parent_id: 1 } })
    .toArray()
  for (const e of subTopicEntries) {
    topicParentMap[e.id] = e.parent_id
  }

  // Roll up sub_topic counts to parent topic
  const topicCountsByParent: Record<string, number> = {}
  for (const r of topicRows) {
    const id = r._id as string
    const parentId = topicParentMap[id] || (topicLabelMap[id] ? id : null)
    if (parentId) {
      topicCountsByParent[parentId] = (topicCountsByParent[parentId] || 0) + r.count
    }
  }

  const topicList = Object.entries(topicCountsByParent)
    .map(([id, count]) => ({ id, label: topicLabelMap[id] || id, count }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)

  // ── AFC counts ───────────────────────────────────────────────────────────
  const afcRows = await db.collection('catalog_index').aggregate([
    { $match: { portal_section: 'audit_reports', audit_findings_categories: { $exists: true, $ne: [] } } },
    { $unwind: '$audit_findings_categories' },
    { $group: { _id: '$audit_findings_categories', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray()

  const afcEntries = await db.collection('taxonomy_afc')
    .find({ level: 'category' }, { projection: { id: 1, label: 1 } })
    .toArray()

  const afcLabelMap: Record<string, string> = {}
  for (const e of afcEntries) afcLabelMap[e.id] = e.label?.en || e.id

  const afcSubEntries = await db.collection('taxonomy_afc')
    .find({ level: { $in: ['sub_category', 'detail'] } }, { projection: { id: 1, parent_id: 1, level: 1 } })
    .toArray()

  // Build sub→category map (2-level: detail→sub_category→category)
  const afcDirectParent: Record<string, string> = {}
  for (const e of afcSubEntries) {
    if (e.parent_id) afcDirectParent[e.id] = e.parent_id
  }
  function afcRootParent(id: string, depth = 0): string {
    if (depth > 5 || !afcDirectParent[id]) return id
    const p = afcDirectParent[id]
    return afcLabelMap[p] ? p : afcRootParent(p, depth + 1)
  }

  const afcCountsByCategory: Record<string, number> = {}
  for (const r of afcRows) {
    const id = r._id as string
    const rootId = afcRootParent(id)
    if (rootId) {
      afcCountsByCategory[rootId] = (afcCountsByCategory[rootId] || 0) + r.count
    }
  }

  const afcList = Object.entries(afcCountsByCategory)
    .map(([id, count]) => ({ id, label: afcLabelMap[id] || id, count }))
    .filter(a => a.count > 0)
    .sort((a, b) => b.count - a.count)

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                    letterSpacing: '1.2px', textTransform: 'uppercase',
                    color: 'var(--ink3)', marginBottom: 20, display: 'flex', gap: 6 }}>
        <Link href="/" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Home</Link>
        <span>›</span>
        <span>Audit Reports</span>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                     fontSize: 34, fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>
          Audit Reports
        </h1>
        <p style={{ fontFamily: 'system-ui', fontSize: 14, color: 'var(--ink3)', margin: 0 }}>
          {fmt(totalAudit)} reports across Union, States and Union Territories
        </p>
      </div>

      {/* ── Section 1: Browse by Jurisdiction ─────────────────────────────── */}
      <section style={{ marginBottom: 52 }}>
        <SectionHeading title="Browse by Jurisdiction" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {JUR_CARDS.map(j => {
            const count = jurCounts[j.key] || 0
            return (
              <div key={j.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href={'/audit-reports?jurisdiction=' + j.key} style={{
                  display: 'block', textDecoration: 'none',
                  background: '#fff', border: '1px solid var(--rule)', borderRadius: 10,
                  overflow: 'hidden', transition: 'box-shadow .15s, transform .15s',
                }}
                  className="jur-card"
                >
                  <div style={{ height: 4, background: j.color }}/>
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{j.icon}</div>
                        <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                                      fontSize: 18, fontWeight: 700, color: j.color, marginBottom: 4 }}>
                          {j.label}
                        </div>
                        <div style={{ fontFamily: 'system-ui', fontSize: 11.5, color: 'var(--ink3)', lineHeight: 1.4 }}>
                          {j.sub}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                                      fontSize: 30, fontWeight: 700, color: j.color, lineHeight: 1 }}>
                          {fmt(count)}
                        </div>
                        <div style={{ fontFamily: 'system-ui', fontSize: 9, fontWeight: 700,
                                      textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--ink3)' }}>
                          reports
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Map link */}
                  {(j.key === 'UT' || j.key === 'STATE' || j.key === 'UNION') && (
                    <div style={{ borderTop: '1px solid var(--rule-lt)', padding: '8px 18px',
                                  background: j.light, display: 'flex', alignItems: 'center',
                                  gap: 6 }}>
                      <span style={{ fontFamily: 'system-ui', fontSize: 11, fontWeight: 600,
                                     color: j.color }}>
                        🗺 View on map
                      </span>
                      <span style={{ fontFamily: 'system-ui', fontSize: 10, color: 'var(--ink3)', marginLeft: 'auto' }}>
                        →
                      </span>
                    </div>
                  )}
                </Link>
                {(j.key === 'UT' || j.key === 'STATE' || j.key === 'UNION') && (
                  <Link href={'/audit-reports/map?jurisdiction=' + j.key} style={{
                    textDecoration: 'none', fontFamily: 'system-ui', fontSize: 11,
                    fontWeight: 600, color: j.color, textAlign: 'center',
                    padding: '6px', borderRadius: 6, border: '1px solid',
                    borderColor: j.color + '40', background: j.light,
                  }}>
                    🗺 Browse {j.label} map
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 2: Browse by Topic ─────────────────────────────────────── */}
      <section style={{ marginBottom: 52 }}>
        <SectionHeading
          title="Browse by Topic"
          sub={topicList.length > 0 ? topicList.length + ' topic areas' : ''}
        />
        {topicList.length === 0 ? (
          <EmptyState text="Topic data will appear here once reports are ingested with topic tags." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {topicList.map(t => (
              <Link
                key={t.id}
                href={'/audit-reports?topic=' + t.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8,
                  background: '#fff', border: '1px solid var(--rule)',
                  textDecoration: 'none', gap: 8, transition: 'background .12s',
                }}
                className="browse-pill"
              >
                <span style={{ fontFamily: 'system-ui', fontSize: 12.5, fontWeight: 500,
                               color: 'var(--ink)', lineHeight: 1.3 }}>
                  {t.label}
                </span>
                <span style={{ fontFamily: 'system-ui', fontSize: 11, fontWeight: 700,
                               color: '#fff', background: 'var(--navy)',
                               padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
                  {fmt(t.count)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Browse by Audit Findings Category ──────────────────── */}
      <section style={{ marginBottom: 52 }}>
        <SectionHeading
          title="Browse by Audit Findings Category"
          sub={afcList.length > 0 ? afcList.length + ' finding categories' : ''}
        />
        {afcList.length === 0 ? (
          <EmptyState text="Audit findings data will appear here once reports are ingested with AFC tags." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {afcList.map(a => (
              <Link
                key={a.id}
                href={'/audit-reports?afc=' + a.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8,
                  background: '#fff', border: '1px solid var(--rule)',
                  textDecoration: 'none', gap: 8, transition: 'background .12s',
                }}
                className="browse-pill"
              >
                <span style={{ fontFamily: 'system-ui', fontSize: 12.5, fontWeight: 500,
                               color: 'var(--ink)', lineHeight: 1.3 }}>
                  {a.label}
                </span>
                <span style={{ fontFamily: 'system-ui', fontSize: 11, fontWeight: 700,
                               color: '#fff', background: '#6b1a3a',
                               padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
                  {fmt(a.count)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4: Full Text Search (coming soon) ─────────────────────── */}
      <section>
        <SectionHeading title="Full Text Search" sub="Coming soon" />
        <div style={{
          padding: '28px 24px', borderRadius: 10, border: '2px dashed var(--rule)',
          background: '#fafbfc', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
          <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                        fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
            Search across all audit reports
          </div>
          <p style={{ fontFamily: 'system-ui', fontSize: 13, color: 'var(--ink3)',
                      margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Full text search across report content, findings, and recommendations is being implemented.
          </p>
        </div>
      </section>

      <style>{`
        .jur-card:hover  { box-shadow: 0 6px 20px rgba(26,58,107,.12); transform: translateY(-2px); }
        .browse-pill:hover { background: var(--navy-lt) !important; }
      `}</style>

    </main>
  )
}

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 18, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                   fontSize: 22, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
        {title}
      </h2>
      {sub && (
        <span style={{ fontFamily: 'system-ui', fontSize: 12, color: 'var(--ink3)' }}>{sub}</span>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '20px 24px', borderRadius: 8, background: '#f8f9fa',
                  border: '1px solid var(--rule)', fontFamily: 'system-ui',
                  fontSize: 13, color: 'var(--ink3)', fontStyle: 'italic' }}>
      {text}
    </div>
  )
}
