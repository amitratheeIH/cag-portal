import { getDb } from '@/lib/mongodb'
import { fetchJson, fetchNdjson } from '@/lib/github'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReportStructure, ContentUnit } from '@/types'
import { getAfcMeta, getTopicMeta } from '@/lib/taxonomy-labels'
import ReportSidebar from '@/components/report/ReportSidebar'

interface Props { params: { id: string } }

function ml(obj: Record<string,string>|string|null|undefined): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.en || Object.values(obj)[0] || ''
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db  = await getDb()
  const doc = await db.collection('catalog_index').findOne({ product_id: params.id })
  if (!doc) return { title: 'Report Not Found' }
  return {
    title: ml(doc.title as Record<string,string>),
    description: ml((doc.summary||{}) as Record<string,string>),
  }
}

const CHAPTER_COLOURS = [
  '#1a3a6b','#245c36','#7a3a00','#5a1a6b','#8b1a1a',
  '#1a5a6b','#3a5a1a','#6b3a1a','#1a1a6b','#5a5a1a',
]

export default async function ReportLandingPage({ params }: Props) {
  const db = await getDb()

  const cat = await db.collection('catalog_index').findOne({ product_id: params.id })
  if (!cat) notFound()

  const meta       = await db.collection('report_meta').findOne({ product_id: params.id })
  const folderPath = meta?.folder_path as string|undefined

  // State/UT name from full metadata
  const fullMeta    = meta?.metadata as Record<string,unknown>|undefined
  const rl          = (fullMeta?.specific as Record<string,unknown>)?.report_level as Record<string,unknown>|undefined
  const stateUtObj  = rl?.state_ut as { id?:string; name?:Record<string,string> }|undefined
  const stateUtName = stateUtObj ? ml(stateUtObj.name) : undefined

  // Structure
  let structure: ReportStructure|null = null
  if (folderPath) {
    try { structure = await fetchJson<ReportStructure>(`${folderPath}/structure.json`) }
    catch { /* optional */ }
  }

  // Recommendations
  interface Rec { block_id:string; text:string }
  const recommendations: Rec[] = []
  if (folderPath && structure) {
    const allU = [...(structure.front_matter||[]),...(structure.content_units||[]),...(structure.back_matter||[])]
    const childSet = new Set(allU.flatMap(u=>u.children||[]))
    const topU = allU.filter(u=>!childSet.has(u.unit_id))
    await Promise.allSettled(topU.map(async ch => {
      try {
        const blocks = await fetchNdjson<{block_id:string;block_type:string;content:{text?:Record<string,string>}}>(
          `${folderPath}/blocks/content_block_${ch.unit_id}.ndjson`
        )
        blocks.filter(b=>b.block_type==='recommendation').forEach(b=>
          recommendations.push({ block_id:b.block_id, text:ml(b.content.text) })
        )
      } catch { /* silent */ }
    }))
    recommendations.sort((a,b)=>a.block_id.localeCompare(b.block_id))
  }

  // Build section→AFC map: afcId → [{ pnum, unit_id }]
  // Include both sections AND chapters (for chapters that have no child sections
  // but have AFC set directly on them, e.g. a standalone monitoring chapter)
  const sectionAfcMap: Record<string,{ pnum:string; unit_id:string }[]> = {}
  if (structure) {
    const allU = [...(structure.front_matter||[]),...(structure.content_units||[]),...(structure.back_matter||[])]
    for (const u of allU) {
      if (u.unit_type !== 'section' && u.unit_type !== 'chapter') continue
      const pnum = (u as ContentUnit & {para_number?:string}).para_number
      if (!pnum) continue
      const afcs = ((u as ContentUnit & {metadata?:{audit_findings_categories?:string[]}}).metadata?.audit_findings_categories)||[]
      for (const afc of afcs) {
        if (!sectionAfcMap[afc]) sectionAfcMap[afc] = []
        sectionAfcMap[afc].push({ pnum, unit_id: u.unit_id })
      }
    }
  }

  // Metadata fields
  const title       = ml(cat.title as Record<string,string>)
  const summary     = ml((cat.summary||{}) as Record<string,string>)
  const year        = cat.year as number
  const jurisdiction = cat.jurisdiction as string|undefined
  const rn          = cat.report_number as {number:number;year:number}|undefined
  const auditType   = (cat.audit_type as string[]|undefined)?.[0]
  const auditPeriod = cat.audit_period as {start_year:number;end_year:number}|undefined
  const topics      = (cat.topics as string[]|undefined)||[]
  const tablingDates = cat.tabling_dates as {lower_house?:string;upper_house?:string}|undefined
  const afcCats     = (cat.audit_findings_categories as string[]|undefined)||[]
  const hasAtn      = cat.has_atn as boolean
  const hasPdfs     = cat.has_pdfs as boolean

  // Chapter list
  const allUnits: ContentUnit[] = structure ? [
    ...(structure.front_matter||[]),
    ...(structure.content_units||[]),
    ...(structure.back_matter||[]),
  ] : []
  const childSet = new Set(allUnits.flatMap(u=>u.children||[]))
  const topUnits = allUnits.filter(u=>!childSet.has(u.unit_id))
  const chapters   = topUnits.filter(u=>u.unit_type==='chapter')
  const frontMatter = topUnits.filter(u=>['preface','executive_summary'].includes(u.unit_type))

  const jurLabel: Record<string,string> = { UNION:'Union', STATE:'State', UT:'Union Territory', LG:'Local Body' }
  const auditTypeLabel: Record<string,string> = {
    'ATYPE-PERFORMANCE':'Performance Audit','ATYPE-COMPLIANCE':'Compliance Audit','ATYPE-FINANCIAL':'Financial Audit',
  }

  const detailRows = [
    { label:'Year',          value: year?.toString() },
    { label:'Jurisdiction',  value: jurisdiction ? jurLabel[jurisdiction]||jurisdiction : undefined },
    { label:'State / UT',    value: stateUtName||undefined },
    { label:'Audit Type',    value: auditType ? auditTypeLabel[auditType]||auditType : undefined },
    { label:'Audit Period',  value: auditPeriod ? `${auditPeriod.start_year} – ${auditPeriod.end_year}` : undefined },
    { label:'Tabled',        value: tablingDates?.lower_house },
    { label:'Chapters',      value: chapters.length ? `${chapters.length}` : undefined },
    { label:'ATN Available', value: hasAtn ? 'Yes' : undefined },
  ].filter(r=>r.value) as {label:string;value:string}[]

  return (
    <main id="main-content" style={{ background:'var(--cream)', minHeight:'60vh' }}>

      {/* ── Hero ──────────────────────────────────────────── */}
      <div style={{ background:'var(--navy)', padding:'32px 20px 28px' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>

          {/* Breadcrumb */}
          <div style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(255,255,255,.4)', marginBottom:'12px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
            <Link href="/" style={{ color:'rgba(255,255,255,.4)', textDecoration:'none' }}>Home</Link>
            <span>›</span>
            <Link href={`/audit-reports${jurisdiction?`?jurisdiction=${jurisdiction}`:''}`}
              style={{ color:'rgba(255,255,255,.4)', textDecoration:'none' }}>
              {jurisdiction ? `${jurLabel[jurisdiction]||jurisdiction} Audit Reports` : 'Reports'}
            </Link>
            <span>›</span>
            <span style={{ color:'rgba(255,255,255,.65)' }}>Report</span>
          </div>

          <div style={{ display:'flex', gap:'20px', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              {/* Badges */}
              <div style={{ display:'flex', gap:'7px', flexWrap:'wrap', marginBottom:'12px' }}>
                {rn && <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, background:'var(--saffron)', color:'#fff', padding:'3px 10px', borderRadius:'12px' }}>
                  Report No. {rn.number} of {rn.year}
                </span>}
                {jurisdiction && <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, background:'rgba(255,255,255,.14)', color:'#fff', padding:'3px 10px', borderRadius:'12px' }}>
                  {jurLabel[jurisdiction]||jurisdiction}{stateUtName ? ` · ${stateUtName}` : ''}
                </span>}
                {auditType && <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, background:'rgba(255,255,255,.14)', color:'#fff', padding:'3px 10px', borderRadius:'12px' }}>
                  {auditTypeLabel[auditType]||auditType}
                </span>}
                {auditPeriod && <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, background:'rgba(255,255,255,.14)', color:'#fff', padding:'3px 10px', borderRadius:'12px' }}>
                  {auditPeriod.start_year}–{auditPeriod.end_year}
                </span>}
              </div>
              {/* Title */}
              <h1 style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'clamp(18px,3vw,26px)', fontWeight:700, color:'#fff', lineHeight:1.3, margin:'0 0 18px' }}>
                {title}
              </h1>
              {/* Actions */}
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                <Link href={`/report/${params.id}/read`} style={{
                  display:'inline-flex', alignItems:'center', gap:'7px',
                  background:'#fff', color:'var(--navy)',
                  fontFamily:'system-ui', fontSize:'13px', fontWeight:700,
                  padding:'9px 20px', borderRadius:'22px', textDecoration:'none',
                }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  Read Full Report
                </Link>
                {hasPdfs && <span style={{
                  display:'inline-flex', alignItems:'center', gap:'7px',
                  background:'rgba(255,255,255,.14)', color:'#fff',
                  fontFamily:'system-ui', fontSize:'13px', fontWeight:600,
                  padding:'9px 20px', borderRadius:'22px',
                  border:'1px solid rgba(255,255,255,.28)',
                }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>
                  </svg>
                  Download PDF
                </span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary band (full width) ──────────────────────── */}
      {summary && (
        <div style={{ background:'#fff', borderBottom:'1px solid var(--rule)' }}>
          <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'24px 20px' }}>
            <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
              <div style={{ width:'3px', borderRadius:'2px', background:'var(--navy)', alignSelf:'stretch', flexShrink:0 }}/>
              <div>
                <div style={{ fontFamily:'system-ui', fontSize:'9.5px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'var(--ink3)', marginBottom:'8px' }}>Executive Summary</div>
                <p style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'16.5px', color:'var(--ink)', lineHeight:1.7, margin:0, textAlign:'justify' }}>
                  {summary}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-column layout ──────────────────────────────── */}
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'28px 20px 48px', display:'flex', gap:'24px', alignItems:'flex-start' }}>

        {/* ── LEFT: Contents (chapters) — main focus ────────── */}
        <div style={{ flex:'1 1 0', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <h2 style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'22px', fontWeight:700, color:'var(--navy)', margin:0 }}>
              Contents
            </h2>
            <span style={{ fontFamily:'system-ui', fontSize:'11px', color:'var(--ink3)' }}>
              {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Front matter */}
          {frontMatter.length > 0 && (
            <div style={{ marginBottom:'16px', display:'flex', flexDirection:'column', gap:'6px' }}>
              {frontMatter.map(u => (
                <Link key={u.unit_id} href={`/report/${params.id}/read?unit=${u.unit_id}`} style={{ textDecoration:'none' }}>
                  <div className="report-card" style={{
                    background:'#fff', border:'1px solid var(--rule)', borderRadius:'8px',
                    padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--ink3)' }}/>
                      <span style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'15px', color:'var(--ink)' }}>
                        {ml(u.title)||u.unit_type}
                      </span>
                    </div>
                    <svg width="14" height="14" fill="none" stroke="var(--ink3)" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Chapters */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {chapters.map((ch, i) => {
              const colour = CHAPTER_COLOURS[i % CHAPTER_COLOURS.length]
              const execSum = ml(ch.executive_summary)
              const chNum = ch.para_number || `Chapter ${i+1}`
              const cleanTitle = ml(ch.title).replace(/^Chapter\s+\d+:\s*/i,'')
              // Sections of this chapter
              const chSections = allUnits.filter(u =>
                u.unit_type==='section' && (u as ContentUnit & {parent_id?:string}).parent_id === ch.unit_id ||
                (ch.children||[]).includes(u.unit_id)
              )
              return (
                <div key={ch.unit_id} style={{
                  background:'#fff', border:'1px solid var(--rule)',
                  borderRadius:'10px', overflow:'hidden',
                }}>
                  {/* Colour band */}
                  <div style={{ height:'3px', background:colour }}/>
                  <Link href={`/report/${params.id}/read?unit=${ch.unit_id}`} style={{ textDecoration:'none', display:'block' }}>
                    <div className="report-card" style={{ padding:'14px 18px', display:'flex', gap:'14px', alignItems:'flex-start' }}>
                      {/* Number badge */}
                      <div style={{
                        flexShrink:0, width:'40px', height:'40px', borderRadius:'8px',
                        background:colour+'18', display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'system-ui', fontSize:'10px', fontWeight:800,
                        color:colour, textAlign:'center', lineHeight:1.2,
                      }}>Ch<br/>{i+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:'system-ui', fontSize:'9px', fontWeight:700, letterSpacing:'.8px', textTransform:'uppercase', color:colour, marginBottom:'3px' }}>
                          {chNum}
                        </div>
                        <div style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'16px', fontWeight:700, color:'var(--ink)', lineHeight:1.3, marginBottom: execSum?'6px':0 }}>
                          {cleanTitle}
                        </div>
                        {execSum && (
                          <p style={{ fontFamily:'system-ui', fontSize:'12px', color:'var(--ink3)', margin:0, lineHeight:1.5,
                            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {execSum}
                          </p>
                        )}
                      </div>
                      <svg width="16" height="16" fill="none" stroke="var(--ink3)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:'4px' }}>
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </Link>

                  {/* Section list */}
                  {chSections.length > 0 && (
                    <div style={{ borderTop:'1px solid var(--rule-lt)', padding:'4px 0 6px' }}>
                      {chSections.map(sec => {
                        const secPnum = (sec as ContentUnit & {para_number?:string}).para_number
                        const secTitle = ml(sec.title)
                        return (
                          <Link key={sec.unit_id} href={`/report/${params.id}/read?unit=${sec.unit_id}`} style={{ textDecoration:'none', display:'block' }}>
                            <div className="section-row" style={{
                              display:'flex', alignItems:'center', gap:'10px',
                              padding:'5px 18px 5px 72px',
                            }}>
                              {secPnum && <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, color:colour, flexShrink:0, minWidth:'28px' }}>{secPnum}</span>}
                              <span style={{ fontFamily:'system-ui', fontSize:'12px', color:'var(--ink2)', lineHeight:1.4 }}>{secTitle}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: Sidebar ─────────────────────────────── */}
        <div style={{ flex:'0 0 300px', minWidth:'260px' }}>
          <ReportSidebar
            detailRows={detailRows}
            topics={topics}
            afcCats={afcCats}
            sectionAfcMap={sectionAfcMap as Record<string,{pnum:string;unit_id:string}[]>}
            recommendations={recommendations}
            reportId={params.id}
            afcMeta={getAfcMeta()}
            topicMeta={getTopicMeta()}
          />
        </div>

      </div>
    </main>
  )
}
