// src/app/report/[id]/section/[unit_id]/page.tsx
// Section viewer — shows a single section in context with search highlighting.
// Navigating here from search results shows just the matched section.

import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'

export async function generateMetadata({
  params,
}: {
  params: { id: string; unit_id: string }
}): Promise<Metadata> {
  return { title: `Section ${params.unit_id} — CAG Audit Reports` }
}

function ml(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  const o = v as Record<string, string>
  return o.en || Object.values(o)[0] || ''
}

function unitLabel(unit_id: string): string {
  const parts = unit_id.split('-')
  const last  = parts[parts.length - 1]
  const m     = last?.match(/^([A-Z]+)(\d+)$/)
  if (!m) return last || unit_id
  const labels: Record<string, string> = {
    CH:'Chapter', SEC:'Section', PRE:'Preface', ES:'Executive Summary',
    ANX:'Annexure', APP:'Appendix', INT:'Introduction', INTRO:'Introduction',
  }
  return (labels[m[1]] || m[1]) + ' ' + parseInt(m[2])
}

export default async function SectionViewerPage({
  params,
  searchParams,
}: {
  params:       { id: string; unit_id: string }
  searchParams: { q?: string }
}) {
  const { id: productId, unit_id } = params
  const db = await getDb()

  // ── Fetch report metadata ────────────────────────────────────────────────
  const cat = await db.collection('catalog_index')
    .findOne({ product_id: productId }) as Record<string, unknown> | null
  if (!cat) notFound()

  const meta = await db.collection('report_meta')
    .findOne({ product_id: productId }) as Record<string, unknown> | null
  const folderPath = (meta?.folder_path as string | undefined) || ''

  // ── Fetch unit metadata (title, para number etc.) ────────────────────────
  let unitTitle = unitLabel(unit_id)
  let unitPnum:  string | null = null

  if (folderPath) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_REPO_BASE_URL || ''
      if (baseUrl) {
        const unitRes = await fetch(`${baseUrl}/${folderPath}/units/${unit_id}.json`)
        if (unitRes.ok) {
          const unitData = await unitRes.json() as Record<string, unknown>
          unitTitle  = ml(unitData.title) || unitTitle
          unitPnum   = (unitData.para_number as string | null) || null
        }
      }
    } catch { /* unit file not accessible — use derived label */ }
  }

  // ── Fetch blocks for this section ────────────────────────────────────────
  const blockDocs = await db.collection('block_vectors')
    .find({ product_id: productId, unit_id }, { projection: { block_id:1, block_type:1, seq:1 } })
    .sort({ seq: 1 })
    .toArray() as unknown as { block_id:string; block_type:string; seq:number }[]

  // ── Fetch actual block content from NDJSON ───────────────────────────────
  let blocks: unknown[] = []
  if (folderPath) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_REPO_BASE_URL || ''
      if (baseUrl) {
        // Derive NDJSON filename from unit_id (e.g. CH01 → content_block_...-CH01.ndjson)
        const chapterId = unit_id.split('-').slice(0, -1).join('-') || unit_id
        const ndjsonUrl = `${baseUrl}/${folderPath}/blocks/content_block_${chapterId}.ndjson`
        const ndjsonRes = await fetch(ndjsonUrl)
        if (ndjsonRes.ok) {
          const text  = await ndjsonRes.text()
          const allBlocks = text.trim().split('\n')
            .filter(Boolean)
            .map(l => JSON.parse(l) as Record<string, unknown>)
          blocks = allBlocks.filter(b => b.unit_id === unit_id)
        }
      }
    } catch { /* blocks not accessible */ }
  }

  // Fall back to text snippets from block_vectors if full blocks unavailable
  const snippets = blockDocs.length > 0 && blocks.length === 0
    ? await db.collection('block_vectors')
        .find({ product_id: productId, unit_id }, { projection: { text_snippet:1, seq:1, block_type:1 } })
        .sort({ seq: 1 })
        .toArray() as unknown as { text_snippet:string; block_type:string; seq:number }[]
    : []

  const reportTitle = ml(cat.title)
  const q = searchParams.q || ''

  return (
    <main id="main-content" style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700, letterSpacing:'1.2px',
                    textTransform:'uppercase', color:'var(--ink3)', marginBottom:16,
                    display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <Link href="/" style={{ color:'var(--ink3)', textDecoration:'none' }}>Home</Link>
        <span>›</span>
        <Link href="/audit-reports/search" style={{ color:'var(--ink3)', textDecoration:'none' }}>Search</Link>
        <span>›</span>
        <Link href={'/report/' + productId} style={{ color:'var(--ink3)', textDecoration:'none' }}>
          {productId}
        </Link>
        <span>›</span>
        <span>{unitLabel(unit_id)}</span>
      </div>

      {/* Search query banner */}
      {q && (
        <div style={{
          display:'flex', alignItems:'center', gap:10, marginBottom:20,
          padding:'10px 14px', borderRadius:8,
          background:'#fff9e6', border:'1px solid #f0d060',
        }}>
          <span style={{ fontSize:14 }}>🔍</span>
          <span style={{ fontFamily:'system-ui', fontSize:12, color:'#7a5a00' }}>
            Showing section matching <strong>"{q}"</strong>
          </span>
          <Link href={'/report/' + productId} style={{
            marginLeft:'auto', fontFamily:'system-ui', fontSize:11, fontWeight:600,
            color:'var(--navy)', textDecoration:'none',
          }}>
            View full report →
          </Link>
        </div>
      )}

      {/* Section header */}
      <div style={{
        padding:'16px 20px', borderRadius:10,
        background:'var(--navy)', marginBottom:24,
      }}>
        <div style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700, letterSpacing:'1px',
                      textTransform:'uppercase', color:'rgba(255,255,255,.6)', marginBottom:4 }}>
          {reportTitle}
          {cat.year ? <span> · {String(cat.year)}</span> : null}
          {cat.jurisdiction ? <span> · {String(cat.jurisdiction)}</span> : null}
        </div>
        <div style={{ fontFamily:'"EB Garamond","Times New Roman",serif',
                      fontSize:22, fontWeight:700, color:'#fff', lineHeight:1.3 }}>
          {unitPnum && <span style={{ opacity:.7, marginRight:10 }}>¶{unitPnum}</span>}
          {unitTitle}
        </div>
      </div>

      {/* Section content */}
      <div style={{
        background:'#fff', border:'1px solid var(--rule)', borderRadius:10,
        padding:'28px 32px', lineHeight:1.7,
      }}>
        {blocks.length > 0 ? (
          /* Full block rendering if content available */
          (blocks as Record<string, unknown>[]).map((block, i) => (
            <BlockRenderer key={i} block={block} blockVersion="1.0" afcLabels={{}} />
          ))
        ) : snippets.length > 0 ? (
          /* Fallback: text snippets from block_vectors */
          <div style={{ fontFamily:'system-ui', fontSize:14, color:'var(--ink)', lineHeight:1.7 }}>
            {snippets.map((s, i) => (
              <p key={i} style={{ marginBottom:14 }}>{s.text_snippet}</p>
            ))}
          </div>
        ) : (
          <div style={{ fontFamily:'system-ui', fontSize:13, color:'var(--ink3)',
                        textAlign:'center', padding:'32px 0' }}>
            Section content not available. <Link href={'/report/' + productId + '/read?unit=' + unit_id}
              style={{ color:'var(--navy)' }}>
              Open in full reader →
            </Link>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display:'flex', gap:12, marginTop:20, flexWrap:'wrap' }}>
        <Link href={'/report/' + productId} style={{
          fontFamily:'system-ui', fontSize:12, fontWeight:600, color:'var(--navy)',
          background:'var(--navy-lt)', padding:'8px 18px', borderRadius:20,
          textDecoration:'none', border:'1px solid rgba(26,58,107,.2)',
        }}>
          ← Report overview
        </Link>
        <Link href={'/report/' + productId + '/read?unit=' + unit_id} style={{
          fontFamily:'system-ui', fontSize:12, fontWeight:600, color:'#fff',
          background:'var(--navy)', padding:'8px 18px', borderRadius:20,
          textDecoration:'none',
        }}>
          Open in full reader →
        </Link>
        {q && (
          <Link href={'/audit-reports/search?q=' + encodeURIComponent(q)} style={{
            fontFamily:'system-ui', fontSize:12, fontWeight:600, color:'var(--ink2)',
            background:'#fff', padding:'8px 18px', borderRadius:20,
            textDecoration:'none', border:'1px solid var(--rule)', marginLeft:'auto',
          }}>
            ← Back to search results
          </Link>
        )}
      </div>

    </main>
  )
}
