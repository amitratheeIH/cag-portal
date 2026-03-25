import { getDb } from '@/lib/mongodb'
import { fetchJson } from '@/lib/github'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReportStructure, ContentUnit } from '@/types'

interface Props {
  params: { id: string }
}

function ml(obj: Record<string, string> | string | null | undefined): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.en || Object.values(obj)[0] || ''
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db  = await getDb()
  const doc = await db.collection('catalog_index').findOne({ product_id: params.id })
  if (!doc) return { title: 'Report Not Found' }
  return {
    title: ml(doc.title as Record<string, string>),
    description: ml((doc.summary || {}) as Record<string, string>),
  }
}

// ── Colour per chapter index ──────────────────────────────────
const CHAPTER_COLOURS = [
  '#1a3a6b', '#245c36', '#7a3a00', '#5a1a6b', '#8b1a1a',
  '#1a5a6b', '#3a5a1a', '#6b3a1a', '#1a1a6b', '#5a5a1a',
]

export default async function ReportLandingPage({ params }: Props) {
  const db = await getDb()

  // ── Fetch from catalog_index (fast, pre-computed) ─────────
  const cat = await db.collection('catalog_index').findOne({ product_id: params.id })
  if (!cat) notFound()

  // ── Fetch from report_meta for full metadata + folder path ─
  const meta = await db.collection('report_meta').findOne({ product_id: params.id })
  const folderPath = meta?.folder_path as string | undefined

  // ── Fetch structure from GitHub to list chapters ───────────
  let structure: ReportStructure | null = null
  if (folderPath) {
    try {
      structure = await fetchJson<ReportStructure>(`${folderPath}/structure.json`)
    } catch { /* structure optional for landing page */ }
  }

  // ── Extract metadata fields ────────────────────────────────
  const title       = ml(cat.title as Record<string, string>)
  const summary     = ml((cat.summary || {}) as Record<string, string>)
  const year        = cat.year as number
  const jurisdiction = cat.jurisdiction as string | undefined
  const rn          = cat.report_number as { number: number; year: number } | undefined
  const auditType   = (cat.audit_type as string[] | undefined)?.[0]
  const auditPeriod = cat.audit_period as { start_year: number; end_year: number } | undefined
  const topics      = (cat.topics as string[] | undefined) || []
  const sectors     = (cat.report_sector as string[] | undefined) || []
  const tablingDates = cat.tabling_dates as { lower_house?: string; upper_house?: string } | undefined
  const afcCats     = (cat.audit_findings_categories as string[] | undefined) || []
  const hasAtn      = cat.has_atn as boolean
  const hasPdfs     = cat.has_pdfs as boolean

  // ── Build chapter list from structure ──────────────────────
  const allUnits: ContentUnit[] = structure ? [
    ...(structure.front_matter || []),
    ...(structure.content_units || []),
    ...(structure.back_matter || []),
  ] : []

  // Only top-level units (chapters, front matter, back matter)
  const childSet = new Set(allUnits.flatMap(u => u.children || []))
  const topUnits = allUnits.filter(u => !childSet.has(u.unit_id))
  const chapters  = topUnits.filter(u => u.unit_type === 'chapter')
  const frontMatter = topUnits.filter(u => ['preface', 'executive_summary'].includes(u.unit_type))

  const jurLabel: Record<string, string> = {
    UNION: 'Union', STATE: 'State', UT: 'Union Territory', LG: 'Local Body',
  }
  const auditTypeLabel: Record<string, string> = {
    'ATYPE-PERFORMANCE': 'Performance Audit',
    'ATYPE-COMPLIANCE':  'Compliance Audit',
    'ATYPE-FINANCIAL':   'Financial Audit',
  }

  return (
    <main id="main-content" style={{ background: 'var(--cream)', minHeight: '60vh' }}>

      {/* ── Hero band ──────────────────────────────────────── */}
      <div style={{ background: 'var(--navy)', padding: '36px 20px 32px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          {/* Breadcrumb */}
          <div style={{ fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,.45)', textDecoration: 'none' }}>Home</Link>
            <span>›</span>
            <Link href={`/reports?section=audit_reports${jurisdiction ? `&jurisdiction=${jurisdiction}` : ''}`}
              style={{ color: 'rgba(255,255,255,.45)', textDecoration: 'none' }}>
              {jurisdiction ? `${jurLabel[jurisdiction] || jurisdiction} Audit Reports` : 'Reports'}
            </Link>
            <span>›</span>
            <span style={{ color: 'rgba(255,255,255,.7)' }}>Report</span>
          </div>

          {/* Report number + type badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {rn && (
              <span style={{ fontFamily: 'system-ui', fontSize: '10.5px', fontWeight: 700, background: 'var(--saffron)', color: '#fff', padding: '3px 10px', borderRadius: '12px' }}>
                Report No. {rn.number} of {rn.year}
              </span>
            )}
            {jurisdiction && (
              <span style={{ fontFamily: 'system-ui', fontSize: '10.5px', fontWeight: 700, background: 'rgba(255,255,255,.15)', color: '#fff', padding: '3px 10px', borderRadius: '12px' }}>
                {jurLabel[jurisdiction] || jurisdiction}
              </span>
            )}
            {auditType && (
              <span style={{ fontFamily: 'system-ui', fontSize: '10.5px', fontWeight: 700, background: 'rgba(255,255,255,.15)', color: '#fff', padding: '3px 10px', borderRadius: '12px' }}>
                {auditTypeLabel[auditType] || auditType}
              </span>
            )}
            {auditPeriod && (
              <span style={{ fontFamily: 'system-ui', fontSize: '10.5px', fontWeight: 700, background: 'rgba(255,255,255,.15)', color: '#fff', padding: '3px 10px', borderRadius: '12px' }}>
                {auditPeriod.start_year}–{auditPeriod.end_year}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: '"EB Garamond","Times New Roman",serif',
            fontSize: 'clamp(20px, 3vw, 28px)',
            fontWeight: 700, color: '#fff', lineHeight: 1.3,
            margin: '0 0 16px',
          }}>
            {title}
          </h1>

          {/* Read report button */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link href={`/report/${params.id}/read`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#fff', color: 'var(--navy)',
                fontFamily: 'system-ui', fontSize: '13px', fontWeight: 700,
                padding: '10px 22px', borderRadius: '24px',
                textDecoration: 'none',
              }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Read Full Report
            </Link>
            {hasPdfs && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'rgba(255,255,255,.15)', color: '#fff',
                fontFamily: 'system-ui', fontSize: '13px', fontWeight: 600,
                padding: '10px 22px', borderRadius: '24px',
                border: '1px solid rgba(255,255,255,.3)',
              }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>
                </svg>
                Download PDF
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────── */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px', display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Left: Summary + Findings + Details ─────────── */}
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>

          {/* Executive Summary */}
          {summary && (
            <section style={{ background: '#fff', border: '1px solid var(--rule)', borderRadius: '10px', padding: '22px 24px', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)', margin: '0 0 12px' }}>
                Summary
              </h2>
              <p style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '16px', color: 'var(--ink)', lineHeight: 1.7, margin: 0, textAlign: 'justify' }}>
                {summary}
              </p>
            </section>
          )}

          {/* Audit Findings */}
          {afcCats.length > 0 && (
            <section style={{ background: '#fff', border: '1px solid var(--rule)', borderRadius: '10px', padding: '22px 24px', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)', margin: '0 0 14px' }}>
                Audit Finding Categories
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {afcCats.map(cat => (
                  <span key={cat} style={{
                    fontFamily: 'system-ui', fontSize: '11.5px', fontWeight: 600,
                    background: 'var(--navy-lt)', color: 'var(--navy)',
                    padding: '4px 12px', borderRadius: '12px',
                    border: '1px solid rgba(26,58,107,.15)',
                  }}>
                    {cat.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Topics */}
          {topics.length > 0 && (
            <section style={{ background: '#fff', border: '1px solid var(--rule)', borderRadius: '10px', padding: '22px 24px', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)', margin: '0 0 14px' }}>
                Topics
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {topics.map(t => (
                  <span key={t} style={{
                    fontFamily: 'system-ui', fontSize: '11.5px', fontWeight: 600,
                    background: 'var(--saffron-lt)', color: 'var(--amber)',
                    padding: '4px 12px', borderRadius: '12px',
                    border: '1px solid rgba(122,74,0,.15)',
                  }}>
                    {t.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Right: Report details card ──────────────────── */}
        <div style={{ flex: '0 0 280px', minWidth: '240px' }}>
          <section style={{ background: '#fff', border: '1px solid var(--rule)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ background: 'var(--navy)', padding: '12px 18px' }}>
              <span style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>
                Report Details
              </span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {[
                { label: 'Year',           value: year?.toString() },
                { label: 'Jurisdiction',   value: jurisdiction ? jurLabel[jurisdiction] || jurisdiction : undefined },
                { label: 'Audit Type',     value: auditType ? auditTypeLabel[auditType] || auditType : undefined },
                { label: 'Audit Period',   value: auditPeriod ? `${auditPeriod.start_year} – ${auditPeriod.end_year}` : undefined },
                { label: 'Tabled',         value: tablingDates?.lower_house },
                { label: 'Chapters',       value: chapters.length ? `${chapters.length} chapters` : undefined },
                { label: 'ATN Available',  value: hasAtn ? 'Yes' : undefined },
                { label: 'Report ID',      value: params.id },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', gap: '12px',
                  padding: '9px 18px', borderBottom: '1px solid var(--rule-lt)',
                }}>
                  <span style={{ fontFamily: 'system-ui', fontSize: '11.5px', color: 'var(--ink3)', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontFamily: 'system-ui', fontSize: '11.5px', color: 'var(--ink)', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Chapter listing ─────────────────────────────────── */}
      {(frontMatter.length > 0 || chapters.length > 0) && (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px 48px' }}>
          <h2 style={{
            fontFamily: '"EB Garamond","Times New Roman",serif',
            fontSize: '24px', fontWeight: 700, color: 'var(--navy)',
            margin: '0 0 20px', paddingBottom: '12px',
            borderBottom: '2px solid var(--navy)',
          }}>
            Contents
          </h2>

          {/* Front matter */}
          {frontMatter.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: '10px' }}>
                Front Matter
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {frontMatter.map(u => (
                  <Link key={u.unit_id}
                    href={`/report/${params.id}/read?unit=${u.unit_id}`}
                    style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: '#fff', border: '1px solid var(--rule)',
                      borderRadius: '8px', padding: '12px 18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                    className="report-card">
                      <span style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '16px', color: 'var(--ink)', fontWeight: 500 }}>
                        {ml(u.title) || u.unit_type}
                      </span>
                      <svg width="16" height="16" fill="none" stroke="var(--ink3)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Chapters */}
          {chapters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chapters.map((ch, i) => {
                const colour = CHAPTER_COLOURS[i % CHAPTER_COLOURS.length]
                const execSum = ml(ch.executive_summary)
                const chNum = ch.para_number ||
                  (ml(ch.title).match(/Chapter\s+(\d+)/i)?.[0] || `Chapter ${i + 1}`)

                return (
                  <Link key={ch.unit_id}
                    href={`/report/${params.id}/read?unit=${ch.unit_id}`}
                    style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: '#fff', border: '1px solid var(--rule)',
                      borderRadius: '10px', overflow: 'hidden',
                    }}
                    className="report-card">
                      {/* Colour band */}
                      <div style={{ height: '4px', background: colour }}/>
                      <div style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        {/* Chapter number */}
                        <div style={{
                          flexShrink: 0, width: '44px', height: '44px',
                          borderRadius: '8px', background: colour + '18',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'system-ui', fontSize: '11px', fontWeight: 800,
                          color: colour, textAlign: 'center', lineHeight: 1.2,
                        }}>
                          Ch<br/>{i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'system-ui', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: colour, marginBottom: '4px' }}>
                            {chNum}
                          </div>
                          <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '17px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: execSum ? '8px' : 0 }}>
                            {ml(ch.title).replace(/^Chapter\s+\d+:\s*/i, '')}
                          </div>
                          {execSum && (
                            <p style={{
                              fontFamily: 'system-ui', fontSize: '12.5px', color: 'var(--ink3)',
                              margin: 0, lineHeight: 1.5,
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                              {execSum}
                            </p>
                          )}
                        </div>
                        <svg width="18" height="18" fill="none" stroke="var(--ink3)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '4px' }}>
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

    </main>
  )
}
