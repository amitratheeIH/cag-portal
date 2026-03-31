import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'

function ml(obj: Record<string,string>|string|null|undefined): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.en || Object.values(obj)[0] || ''
}

const JUR_LABELS: Record<string,string> = {
  UNION: 'Union', STATE: 'State', UT: 'Union Territory', LG: 'Local Body',
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { jurisdiction?: string; state?: string; topic?: string }
}): Promise<Metadata> {
  const jur = searchParams.jurisdiction
  const label = jur ? JUR_LABELS[jur] || jur : 'All'
  return { title: `${label} Audit Reports — CAG Digital Repository` }
}

export default async function AuditReportsPage({
  searchParams,
}: {
  searchParams: { jurisdiction?: string; state?: string; year?: string; topic?: string }
}) {
  const db = await getDb()

  // Build filter
  const filter: Record<string,unknown> = { portal_section: 'audit_reports' }
  if (searchParams.jurisdiction) filter.jurisdiction = searchParams.jurisdiction
  if (searchParams.state)        filter.state_id     = searchParams.state
  if (searchParams.year)         filter.year         = parseInt(searchParams.year)
  if (searchParams.topic) {
    // If a parent topic is clicked, also match all its sub-topics
    // so reports tagged with sub-topics appear under the parent
    const db2 = await getDb()
    const subTopics = await db2.collection('taxonomy_topics')
      .distinct('id', { parent_id: searchParams.topic, level: 'sub_topic' })
    const topicIds = subTopics.length > 0
      ? [searchParams.topic, ...subTopics]   // parent + all subs
      : [searchParams.topic]                 // leaf topic (sub_topic itself)
    filter.topics = { $in: topicIds }
  }

  const docs = await db
    .collection('catalog_index')
    .find(filter, {
      projection: {
        product_id: 1, title: 1, year: 1,
        jurisdiction: 1, report_number: 1, summary: 1,
        state_id: 1, portal_section: 1,
      },
    })
    .sort({ year: -1 })
    .limit(100)
    .toArray()

  // Get available years for filter
  const years = await db
    .collection('catalog_index')
    .distinct('year', { portal_section: 'audit_reports' })
  years.sort((a, b) => b - a)

  const jur        = searchParams.jurisdiction
  const stateId    = searchParams.state
  const yearFilter = searchParams.year
  const topicFilter = searchParams.topic

  // Heading
  let heading = 'Audit Reports'
  if (jur)          heading = (JUR_LABELS[jur] || jur) + ' Audit Reports'
  if (topicFilter)  heading = 'Audit Reports — Topic'

  // Breadcrumb
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Audit Reports', href: '/audit-reports' },
    ...(jur         ? [{ label: JUR_LABELS[jur] || jur, href: '/audit-reports/list?jurisdiction=' + jur }] : []),
    ...(topicFilter ? [{ label: 'Topic filter', href: '/audit-reports/list?topic=' + topicFilter }] : []),
  ]

  return (
    <main id="main-content" style={{ maxWidth:'1100px', margin:'0 auto', padding:'36px 20px 60px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, letterSpacing:'1.2px', textTransform:'uppercase', color:'var(--ink3)', marginBottom:'20px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {crumbs.map((c, i) => (
          <span key={c.href} style={{ display:'flex', gap:'6px' }}>
            {i > 0 && <span style={{ color:'var(--rule)' }}>›</span>}
            {i < crumbs.length - 1
              ? <Link href={c.href} style={{ color:'var(--ink3)', textDecoration:'none' }}>{c.label}</Link>
              : <span>{c.label}</span>
            }
          </span>
        ))}
      </div>

      {/* Page header */}
      <div style={{ marginBottom:'28px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'16px', flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'32px', fontWeight:700, color:'var(--navy)', margin:'0 0 6px' }}>
            {heading}
          </h1>
          <p style={{ fontFamily:'system-ui', fontSize:'13px', color:'var(--ink3)', margin:0 }}>
            {docs.length} report{docs.length !== 1 ? 's' : ''}
            {jur ? ` · ${JUR_LABELS[jur] || jur}` : ''}
          </p>
        </div>
        {/* Map view link — will go to /audit-reports/map */}
        <Link href={`/audit-reports/map${jur ? `?jurisdiction=${jur}` : ''}`}
          style={{
            display:'inline-flex', alignItems:'center', gap:'7px',
            fontFamily:'system-ui', fontSize:'12px', fontWeight:600,
            color:'var(--navy)', background:'var(--navy-lt)',
            padding:'8px 16px', borderRadius:'20px', textDecoration:'none',
            border:'1px solid rgba(26,58,107,.2)', flexShrink:0,
          }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13 6-3m-6 3V7m6 10 4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"/>
          </svg>
          Browse by Map
        </Link>
      </div>

      {/* Filter row */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'28px', alignItems:'center' }}>
        {/* Jurisdiction chips */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {[
            { label:'All',             href:'/audit-reports/list' },
            { label:'Union',           href:'/audit-reports/list?jurisdiction=UNION' },
            { label:'State',           href:'/audit-reports/list?jurisdiction=STATE' },
            { label:'Union Territory', href:'/audit-reports/list?jurisdiction=UT' },
            { label:'Local Body',      href:'/audit-reports/list?jurisdiction=LG' },
          ].map(({ label, href }) => {
            const active = jur ? href === `/audit-reports/list?jurisdiction=${jur}` : href === '/audit-reports/list'
            return (
              <Link key={label} href={href} style={{
                fontFamily:'system-ui', fontSize:'12px', fontWeight:600,
                padding:'5px 14px', borderRadius:'20px', textDecoration:'none',
                border:'1px solid',
                borderColor: active ? 'var(--navy)' : 'var(--rule)',
                background:  active ? 'var(--navy)' : '#fff',
                color:       active ? '#fff'       : 'var(--ink2)',
              }}>{label}</Link>
            )
          })}
        </div>

        {/* Year filter */}
        {years.length > 0 && (
          <div style={{ marginLeft:'auto', display:'flex', gap:'6px', alignItems:'center' }}>
            <span style={{ fontFamily:'system-ui', fontSize:'11px', color:'var(--ink3)' }}>Year:</span>
            <Link href={jur ? `/audit-reports?jurisdiction=${jur}` : '/audit-reports'}
              style={{
                fontFamily:'system-ui', fontSize:'12px', fontWeight:600, padding:'4px 10px',
                borderRadius:'12px', textDecoration:'none', border:'1px solid',
                borderColor: !yearFilter ? 'var(--navy)' : 'var(--rule)',
                background:  !yearFilter ? 'var(--navy)' : '#fff',
                color:       !yearFilter ? '#fff'        : 'var(--ink2)',
              }}>All</Link>
            {years.slice(0, 8).map(y => {
              const yStr = y.toString()
              const href = `/audit-reports/list?${jur ? `jurisdiction=${jur}&` : ''}year=${yStr}`
              const active = yearFilter === yStr
              return (
                <Link key={yStr} href={href} style={{
                  fontFamily:'system-ui', fontSize:'12px', fontWeight:600, padding:'4px 10px',
                  borderRadius:'12px', textDecoration:'none', border:'1px solid',
                  borderColor: active ? 'var(--saffron)' : 'var(--rule)',
                  background:  active ? 'var(--saffron)' : '#fff',
                  color:       active ? '#fff'           : 'var(--ink2)',
                }}>{yStr}</Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Report list */}
      {docs.length === 0 ? (
        <div style={{ fontFamily:'system-ui', fontSize:'14px', color:'var(--ink3)', padding:'60px 0', textAlign:'center' }}>
          No reports found.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {docs.map(doc => {
            const title   = ml(doc.title as Record<string,string>)
            const summary = ml((doc.summary||{}) as Record<string,string>)
            const rn      = doc.report_number as {number:number;year:number}|undefined
            const docJur  = doc.jurisdiction as string|undefined
            return (
              <Link key={doc.product_id} href={`/report/${doc.product_id}`}
                style={{ textDecoration:'none', display:'block' }}
                className="report-card-link">
                <div className="report-card" style={{
                  background:'#fff', border:'1px solid var(--rule)',
                  borderRadius:'8px', padding:'16px 20px',
                  boxShadow:'0 1px 3px rgba(26,58,107,.05)',
                }}>
                  {/* Badges */}
                  <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap' }}>
                    {doc.year && (
                      <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, background:'var(--navy)', color:'#fff', padding:'2px 8px', borderRadius:'10px' }}>
                        {doc.year}
                      </span>
                    )}
                    {docJur && !jur && (
                      <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:600, background:'var(--navy-lt)', color:'var(--navy)', padding:'2px 8px', borderRadius:'10px', border:'1px solid rgba(26,58,107,.15)' }}>
                        {JUR_LABELS[docJur] || docJur}
                      </span>
                    )}
                    {rn && (
                      <span style={{ fontFamily:'system-ui', fontSize:'10px', color:'var(--ink3)', padding:'2px 8px', borderRadius:'10px', border:'1px solid var(--rule)' }}>
                        Report No. {rn.number} of {rn.year}
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <div style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'18px', fontWeight:700, color:'var(--ink)', lineHeight:1.35, marginBottom: summary ? '6px' : 0 }}>
                    {title}
                  </div>
                  {/* Summary */}
                  {summary && (
                    <p style={{ fontFamily:'system-ui', fontSize:'13px', color:'var(--ink3)', margin:0, lineHeight:1.55,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {summary}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
