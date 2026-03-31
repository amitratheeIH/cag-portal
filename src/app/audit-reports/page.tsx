import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Audit Reports — CAG Digital Repository' }

// ─── Jurisdiction card data ───────────────────────────────────────────────────
const JUR_CARDS = [
  {
    key:   'UNION',
    label: 'Union (Central)',
    sub:   'Departments, PSUs & autonomous bodies audited by CAG at the Union level',
    color: '#1a3a6b',
    light: '#e8f0fb',
    hasMap: true,
  },
  {
    key:   'UT',
    label: 'Union Territories',
    sub:   'All Union Territories — with and without legislature',
    color: '#1a6b3a',
    light: '#e8f8ee',
    hasMap: true,
  },
  {
    key:   'STATE',
    label: 'States',
    sub:   'State Government finances, departments and schemes',
    color: '#6b1a3a',
    light: '#f8e8ee',
    hasMap: true,
  },
  {
    key:   'LG',
    label: 'Local Bodies',
    sub:   'Panchayati Raj, Municipal and Urban Local Bodies',
    color: '#6b4a1a',
    light: '#f8f0e8',
    hasMap: false,
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
  let total = 0
  for (const r of jurRows) {
    if (r._id) { jurCounts[r._id] = r.count; total += r.count }
  }

  // ── Topic hierarchy from taxonomy ────────────────────────────────────────
  const topicEntries = await db.collection('taxonomy_topics')
    .find({}, { projection: { id: 1, level: 1, parent_id: 1, label: 1 } })
    .sort({ sort_order: 1 })
    .toArray()

  interface TopicEntry { id: string; level: string; parent_id?: string; label?: { en?: string } }

  const parents:  TopicEntry[] = (topicEntries as TopicEntry[]).filter(e => e.level === 'topic')
  const children: TopicEntry[] = (topicEntries as TopicEntry[]).filter(e => e.level === 'sub_topic')

  const byParent: Record<string, TopicEntry[]> = {}
  for (const p of parents) byParent[p.id] = []
  for (const c of children) {
    if (c.parent_id && byParent[c.parent_id]) byParent[c.parent_id].push(c)
  }

  const fmt = (n: number) => n.toLocaleString('en-IN')

  return (
    <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                    letterSpacing: '1.2px', textTransform: 'uppercase',
                    color: 'var(--ink3)', marginBottom: 20, display: 'flex', gap: 6 }}>
        <Link href="/" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Home</Link>
        <span>›</span><span>Audit Reports</span>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                     fontSize: 34, fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
          Audit Reports
        </h1>
        <p style={{ fontFamily: 'system-ui', fontSize: 14, color: 'var(--ink3)', margin: 0 }}>
          {fmt(total)} reports · browse by jurisdiction, view on India map, or explore by topic
        </p>
      </div>

      {/* ── Section 1: Jurisdiction cards ─────────────────────────────────── */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                     fontSize: 22, fontWeight: 700, color: 'var(--navy)', margin: '0 0 18px' }}>
          Browse by Jurisdiction
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {JUR_CARDS.map(j => {
            const count = jurCounts[j.key] || 0
            return (
              <div key={j.key} style={{
                background: '#fff', border: '1px solid var(--rule)', borderRadius: 12,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}>
                {/* Colour bar */}
                <div style={{ height: 4, background: j.color }}/>

                {/* Card body */}
                <div style={{ padding: '18px 20px 14px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                                  fontSize: 19, fontWeight: 700, color: j.color }}>
                      {j.label}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                                    fontSize: 28, fontWeight: 700, color: j.color, lineHeight: 1 }}>
                        {fmt(count)}
                      </div>
                      <div style={{ fontFamily: 'system-ui', fontSize: 9, color: 'var(--ink3)',
                                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        reports
                      </div>
                    </div>
                  </div>
                  <p style={{ fontFamily: 'system-ui', fontSize: 12, color: 'var(--ink3)',
                               margin: 0, lineHeight: 1.45 }}>
                    {j.sub}
                  </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: j.hasMap ? '1fr 1fr' : '1fr',
                               borderTop: '1px solid var(--rule-lt)' }}>
                  <Link href={'/audit-reports?jurisdiction=' + j.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '10px 8px', textDecoration: 'none',
                    fontFamily: 'system-ui', fontSize: 11.5, fontWeight: 600, color: j.color,
                    background: j.light, transition: 'filter .12s',
                    borderRight: j.hasMap ? '1px solid var(--rule-lt)' : 'none',
                  }}>
                    <span>☰</span> List view
                  </Link>
                  {j.hasMap && (
                    <Link href={'/audit-reports/map?jurisdiction=' + j.key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '10px 8px', textDecoration: 'none',
                      fontFamily: 'system-ui', fontSize: 11.5, fontWeight: 600, color: j.color,
                      background: j.light, transition: 'filter .12s',
                    }}>
                      <IndiaMapIcon color={j.color}/> Map view
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 2: Browse by Topic ────────────────────────────────────── */}
      <section style={{ marginBottom: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                       fontSize: 22, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
            Browse by Topic
          </h2>
          <span style={{ fontFamily: 'system-ui', fontSize: 12, color: 'var(--ink3)' }}>
            {parents.length} topic areas · {children.length} sub-topics
          </span>
        </div>

        {parents.length === 0 ? (
          <div style={{ padding: '20px 24px', borderRadius: 8, background: '#f8f9fa',
                        border: '1px solid var(--rule)', fontFamily: 'system-ui',
                        fontSize: 13, color: 'var(--ink3)', fontStyle: 'italic' }}>
            Run <code>sync_taxonomies.py</code> to populate topic data.
          </div>
        ) : (
          <div style={{ columns: '280px 3', gap: 16 }}>
            {parents.map(p => {
              const subs = byParent[p.id] || []
              const pLabel = p.label?.en || p.id
              return (
                <div key={p.id} style={{
                  breakInside: 'avoid', marginBottom: 16,
                  background: '#fff', border: '1px solid var(--rule)', borderRadius: 10, overflow: 'hidden',
                }}>
                  {/* Parent topic header */}
                  <Link href={'/audit-reports?topic=' + p.id} style={{
                    display: 'block', padding: '10px 14px',
                    background: 'var(--navy-lt)', textDecoration: 'none',
                    borderBottom: '1px solid var(--rule-lt)',
                  }}>
                    <span style={{ fontFamily: 'system-ui', fontSize: 12.5, fontWeight: 700,
                                   color: 'var(--navy)', lineHeight: 1.3 }}>
                      {pLabel}
                    </span>
                  </Link>

                  {/* Sub-topics */}
                  <div>
                    {subs.map((s, i) => (
                      <Link key={s.id} href={'/audit-reports?topic=' + s.id} style={{
                        display: 'block', padding: '7px 14px 7px 20px',
                        borderBottom: i < subs.length - 1 ? '1px solid var(--rule-lt)' : 'none',
                        textDecoration: 'none',
                        fontFamily: 'system-ui', fontSize: 12, color: 'var(--ink2)',
                        lineHeight: 1.35,
                        transition: 'background .1s, color .1s',
                      }}
                        onMouseEnter={undefined}
                        className="sub-topic-row"
                      >
                        {s.label?.en || s.id}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Full Text Search (coming soon) ─────────────────────── */}
      <section>
        <h2 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                     fontSize: 22, fontWeight: 700, color: 'var(--navy)', margin: '0 0 18px' }}>
          Full Text Search
          <span style={{ fontFamily: 'system-ui', fontSize: 11, fontWeight: 600,
                         color: 'var(--ink3)', marginLeft: 12, verticalAlign: 'middle',
                         background: '#f0f4fa', padding: '3px 10px', borderRadius: 20,
                         border: '1px solid var(--rule)' }}>
            Coming soon
          </span>
        </h2>
        <div style={{
          padding: '32px 24px', borderRadius: 10, border: '2px dashed var(--rule)',
          background: '#fafbfc', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 36 }}>🔍</div>
          <div>
            <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                          fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
              Search across all audit report content
            </div>
            <p style={{ fontFamily: 'system-ui', fontSize: 13, color: 'var(--ink3)', margin: 0 }}>
              Full text search across findings, recommendations and report text will be available here.
            </p>
          </div>
        </div>
      </section>

      <style>{`
        .sub-topic-row:hover { background: var(--navy-lt) !important; color: var(--navy) !important; }
      `}</style>

    </main>
  )
}

// Small India outline icon (simplified silhouette)
function IndiaMapIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="14" viewBox="0 0 52 58" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M26 2 L38 6 L46 14 L48 24 L44 32 L36 38 L38 44 L34 50 L26 56 L18 50 L14 44 L16 38 L8 32 L4 24 L6 14 L14 6 Z"
        fill={color} opacity="0.18" stroke={color} strokeWidth="2.5" strokeLinejoin="round"
      />
      <circle cx="26" cy="24" r="3" fill={color}/>
    </svg>
  )
}
