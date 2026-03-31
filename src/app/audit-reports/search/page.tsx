'use client'
// src/app/audit-reports/search/page.tsx
// Full-text search page for audit reports.
// Client component — search runs live as user types (debounced).

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

const JUR_COLOURS: Record<string, string> = {
  UNION: '#1a3a6b', STATE: '#6b1a3a', UT: '#1a6b3a', LG: '#6b4a1a',
}

interface ReportResult {
  type: 'report'
  product_id: string; title: string; year: number; jurisdiction: string
  summary: string; report_number?: { number:number; year:number }
  state_id?: string; score?: number; href: string
}
interface SectionResult {
  type: 'section'
  product_id: string; unit_id: string; unit_label: string
  para_number?: string; snippet: string; score?: number
  report?: { title?: unknown; year?: number; jurisdiction?: string; [key: string]: unknown }
  href: string
}
type SearchResult = ReportResult | SectionResult

function ml(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  const o = v as Record<string,string>
  return o.en || Object.values(o)[0] || ''
}

export default function SearchPage() {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<{ reports: ReportResult[]; sections: SectionResult[]; mode?: string } | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [filter,     setFilter]     = useState<'all'|'report'|'section'>('all')
  const [searchMode, setSearchMode] = useState<'hybrid'|'text'|'semantic'>('hybrid')
  const [mode,     setMode]     = useState<'hybrid'|'text'|'semantic'>('hybrid')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string, type: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${type}&mode=${mode}`)
      const data = await res.json()
      setResults(data)
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query, filter), 320)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, filter, mode, search])

  const total = (results?.reports.length || 0) + (results?.sections.length || 0)

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700, letterSpacing:'1.2px',
                    textTransform:'uppercase', color:'var(--ink3)', marginBottom:20,
                    display:'flex', gap:6 }}>
        <Link href="/" style={{ color:'var(--ink3)', textDecoration:'none' }}>Home</Link>
        <span>›</span>
        <Link href="/audit-reports" style={{ color:'var(--ink3)', textDecoration:'none' }}>Audit Reports</Link>
        <span>›</span>
        <span>Search</span>
      </div>

      <h1 style={{ fontFamily:'"EB Garamond","Times New Roman",serif',
                   fontSize:32, fontWeight:700, color:'var(--navy)', margin:'0 0 24px' }}>
        Search Audit Reports
      </h1>

      {/* Search box */}
      <div style={{ position:'relative', marginBottom:20 }}>
        <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
                      color:'var(--ink3)', fontSize:16, pointerEvents:'none' }}>
          🔍
        </div>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search report titles, findings, sections…"
          style={{
            width:'100%', boxSizing:'border-box',
            padding:'13px 16px 13px 42px',
            fontFamily:'system-ui', fontSize:15,
            border:'2px solid ' + (query ? 'var(--navy)' : 'var(--rule)'),
            borderRadius:10, outline:'none',
            transition:'border-color .15s',
            background:'#fff', color:'var(--ink)',
          }}
        />
        {loading && (
          <div style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                        width:16, height:16, border:'2px solid var(--navy)',
                        borderTopColor:'transparent', borderRadius:'50%',
                        animation:'spin .6s linear infinite' }}/>
        )}
      </div>

      {/* Search mode + result type rows */}
      <div style={{ display:'flex', gap:16, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        {/* Search mode */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontFamily:'system-ui', fontSize:10.5, fontWeight:700,
                         letterSpacing:'.6px', textTransform:'uppercase', color:'var(--ink3)' }}>
            Mode
          </span>
          {([
            ['Hybrid', 'hybrid', '✦'],
            ['Text',   'text',   '🔤'],
            ['Semantic','semantic','🧠'],
          ] as [string,'hybrid'|'text'|'semantic',string][]).map(([label, val, icon]) => (
            <button key={val} onClick={() => setSearchMode(val)} style={{
              fontFamily:'system-ui', fontSize:11.5, fontWeight:600,
              padding:'4px 12px', borderRadius:20, cursor:'pointer',
              display:'flex', alignItems:'center', gap:4,
              border:'1px solid',
              borderColor: searchMode===val ? 'var(--navy)' : 'var(--rule)',
              background:  searchMode===val ? 'var(--navy)' : '#fff',
              color:       searchMode===val ? '#fff' : 'var(--ink2)',
            }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width:1, height:20, background:'var(--rule)' }}/>

        {/* Result type */}
        <div style={{ display:'flex', gap:6 }}>
          {([
            ['All', 'all'],
            ['Reports', 'report'],
            ['Sections', 'section'],
          ] as [string, 'all'|'report'|'section'][]).map(([label, val]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              fontFamily:'system-ui', fontSize:11.5, fontWeight:600,
              padding:'4px 12px', borderRadius:20, cursor:'pointer',
              border:'1px solid',
              borderColor: filter===val ? 'var(--navy)' : 'var(--rule)',
              background:  filter===val ? '#fff' : '#fff',
              color:       filter===val ? 'var(--navy)' : 'var(--ink3)',
              fontStyle:   filter===val ? 'normal' : 'normal',
              textDecoration: filter===val ? 'underline' : 'none',
            }}>
              {label}
              {results && (
                <span style={{ marginLeft:4, fontSize:10, opacity:.7 }}>
                  {val==='all' ? total : val==='report' ? results.reports.length : results.sections.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search mode */}
      <div style={{ display:'flex', gap:6, marginBottom:28, alignItems:'center' }}>
        <span style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700, letterSpacing:'1px',
                       textTransform:'uppercase', color:'var(--ink3)', marginRight:4 }}>
          Search mode
        </span>
        {([
          ['Hybrid', 'hybrid', 'Text + Semantic (recommended)'],
          ['Text',   'text',   'Keyword matching only'],
          ['Semantic','semantic','Meaning-based matching'],
        ] as [string, 'hybrid'|'text'|'semantic', string][]).map(([label, val, tip]) => (
          <button key={val} onClick={() => setMode(val)} title={tip} style={{
            fontFamily:'system-ui', fontSize:11, fontWeight:600,
            padding:'4px 14px', borderRadius:20, cursor:'pointer',
            border:'1px solid',
            borderColor: mode===val ? 'var(--navy)' : 'var(--rule)',
            background:  mode===val ? 'var(--navy)' : '#fff',
            color:       mode===val ? '#fff' : 'var(--ink2)',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!query && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--ink3)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
          <div style={{ fontFamily:'"EB Garamond","Times New Roman",serif',
                        fontSize:18, fontWeight:600, color:'var(--navy)', marginBottom:6 }}>
            Search across all audit reports
          </div>
          <p style={{ fontFamily:'system-ui', fontSize:13, margin:0 }}>
            Search report titles, summaries, findings, sections and paragraphs.
            Results show relevant reports and specific sections within reports.
          </p>
        </div>
      )}

      {/* No results */}
      {query.length >= 2 && !loading && results && total === 0 && (
        <div style={{ padding:'32px 24px', textAlign:'center', borderRadius:10,
                      border:'1px solid var(--rule)', fontFamily:'system-ui',
                      fontSize:13, color:'var(--ink3)' }}>
          No results for <strong>"{query}"</strong>. Try different keywords.
        </div>
      )}

      {/* Results */}
      {results && total > 0 && (
        <div>
          <div style={{ fontFamily:'system-ui', fontSize:12, color:'var(--ink3)',
                        marginBottom:16, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span>{total} result{total!==1?'s':''} for <strong style={{color:'var(--ink)'}}>"{query}"</strong></span>

          </div>

          {/* Report results */}
          {(filter==='all' || filter==='report') && results.reports.length > 0 && (
            <div style={{ marginBottom:32 }}>
              {filter==='all' && (
                <div style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700,
                               letterSpacing:'1px', textTransform:'uppercase',
                               color:'var(--ink3)', marginBottom:10 }}>
                  Reports ({results.reports.length})
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {results.reports.map(r => (
                  <ReportCard key={r.product_id} result={r} query={query} />
                ))}
              </div>
            </div>
          )}

          {/* Section results */}
          {(filter==='all' || filter==='section') && results.sections.length > 0 && (
            <div>
              {filter==='all' && (
                <div style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700,
                               letterSpacing:'1px', textTransform:'uppercase',
                               color:'var(--ink3)', marginBottom:10 }}>
                  Sections ({results.sections.length})
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {results.sections.map(s => (
                  <SectionCard key={s.unit_id} result={s} query={query} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .search-card:hover {
          box-shadow: 0 4px 16px rgba(26,58,107,.1) !important;
          border-color: rgba(26,58,107,.25) !important;
        }
      `}</style>
    </main>
  )
}

// ─── Report result card ───────────────────────────────────────────────────────
function ReportCard({ result: r, query }: { result: ReportResult; query: string }) {
  const jColor = JUR_COLOURS[r.jurisdiction] || 'var(--navy)'
  return (
    <Link href={r.href} style={{ display:'block', textDecoration:'none',
      padding:'16px 18px', borderRadius:10, border:'1px solid var(--rule)',
      background:'#fff', transition:'box-shadow .12s, border-color .12s' }}
      className="search-card">
      <div style={{ display:'flex', alignItems:'flex-start',
                    justifyContent:'space-between', gap:12, marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700,
                         background:jColor+'18', color:jColor, padding:'2px 8px', borderRadius:10,
                         border:'1px solid '+jColor+'30' }}>
            {r.jurisdiction}
          </span>
          {r.report_number && (
            <span style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700,
                           background:'var(--navy)', color:'#fff',
                           padding:'2px 8px', borderRadius:10 }}>
              No. {r.report_number.number}/{r.report_number.year}
            </span>
          )}
        </div>
        <span style={{ fontFamily:'system-ui', fontSize:11, color:'var(--ink3)', flexShrink:0 }}>
          {r.year}
        </span>
      </div>
      <div style={{ fontFamily:'"EB Garamond","Times New Roman",serif',
                    fontSize:16, fontWeight:600, color:'var(--navy)',
                    lineHeight:1.35, marginBottom:6 }}>
        <Highlight text={r.title} query={query} />
      </div>
      {r.summary && (
        <div style={{ fontFamily:'system-ui', fontSize:12, color:'var(--ink3)', lineHeight:1.5 }}>
          <Highlight text={r.summary} query={query} />
        </div>
      )}
    </Link>
  )
}

// ─── Section result card ──────────────────────────────────────────────────────
function SectionCard({ result: s, query }: { result: SectionResult; query: string }) {
  const reportTitle = ml(s.report?.['title' as keyof typeof s.report])
  const jur = s.report?.['jurisdiction' as keyof typeof s.report] as string | undefined
  const jColor = JUR_COLOURS[jur || ''] || 'var(--navy)'

  return (
    <Link href={s.href} style={{ display:'block', textDecoration:'none',
      padding:'16px 18px', borderRadius:10,
      border:'1px solid var(--rule)', borderLeft:'3px solid var(--navy)',
      background:'#fff', transition:'box-shadow .12s, border-color .12s' }}
      className="search-card">
      {/* Section label */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        <span style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700,
                       background:'var(--navy-lt)', color:'var(--navy)',
                       padding:'2px 8px', borderRadius:10 }}>
          📄 {s.unit_label}
          {s.para_number && <span style={{opacity:.7}}> · ¶{s.para_number}</span>}
        </span>
        {jur && (
          <span style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700,
                         background:jColor+'18', color:jColor,
                         padding:'2px 8px', borderRadius:10, border:'1px solid '+jColor+'30' }}>
            {jur}
          </span>
        )}
      </div>
      {/* Parent report */}
      {reportTitle && (
        <div style={{ fontFamily:'system-ui', fontSize:11.5, color:'var(--ink3)',
                      marginBottom:6, fontStyle:'italic' }}>
          {reportTitle}{s.report?.year ? ` (${s.report.year})` : ''}
        </div>
      )}
      {/* Snippet */}
      <div style={{ fontFamily:'system-ui', fontSize:12.5, color:'var(--ink)',
                    lineHeight:1.6 }}>
        <Highlight text={s.snippet} query={query} />
      </div>
    </Link>
  )
}

// ─── Inline highlight ─────────────────────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!text || !query) return <>{text}</>
  const words = query.trim().split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return <>{text}</>
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part)
          ? <mark key={i} style={{ background:'#fff176', padding:'0 1px', borderRadius:2, color:'inherit' }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}
