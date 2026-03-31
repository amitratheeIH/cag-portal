// src/app/api/search/route.ts
// Hybrid search: keyword ($search) + semantic ($vectorSearch) merged via RRF.
//
// Indexes (db: cag_audit):
//   block_search       — Atlas Search text index on block_vectors
//   block_vector_index — Atlas Vector Search on block_vectors.embedding (1024 dims, Cohere)
//   report_search      — Atlas Search text index on catalog_index
//
// Requires: COHERE_API_KEY in Vercel environment variables.
// Falls back to keyword-only if key missing or embedding fails.

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

const COHERE_EMBED_MODEL = 'embed-english-v3.0'   // 1024 dims
const VECTOR_DIMS        = 1024

// ── Embed query via Cohere ────────────────────────────────────────────────────
// input_type MUST be "search_query" at query time
// (documents were indexed with "search_document")
async function embedQuery(text: string): Promise<number[] | null> {
  const key = process.env.COHERE_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.cohere.ai/v1/embed', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${key}`,
        'Cohere-Version': '2022-12-06',
      },
      body: JSON.stringify({
        model:      COHERE_EMBED_MODEL,
        texts:      [text],
        input_type: 'search_query',   // ← critical: different from indexing
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('Cohere embed error:', res.status, err)
      return null
    }
    const data = await res.json() as { embeddings: number[][] }
    return data.embeddings[0] ?? null
  } catch (e) {
    console.error('Cohere embed exception:', e)
    return null
  }
}

// ── RRF merge ─────────────────────────────────────────────────────────────────
function rrf<T extends { id: string }>(lists: T[][], k = 60): (T & { rrf_score: number })[] {
  const scores: Record<string, number> = {}
  const docs:   Record<string, T>      = {}
  for (const list of lists) {
    list.forEach((item, rank) => {
      scores[item.id] = (scores[item.id] || 0) + 1 / (k + rank + 1)
      if (!docs[item.id]) docs[item.id] = item
    })
  }
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([id, rrf_score]) => ({ ...docs[id], rrf_score }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ml(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  const o = v as Record<string, string>
  return o.en || Object.values(o)[0] || ''
}

function highlight(text: string, query: string): string {
  if (!text) return ''
  const words = query.trim().split(/\s+/).filter(w => w.length > 2)
  const lower = text.toLowerCase()
  let best = 0
  for (const w of words) {
    const idx = lower.indexOf(w.toLowerCase())
    if (idx >= 0) { best = Math.max(0, idx - 80); break }
  }
  const win = text.slice(best, best + 300)
  return (best > 0 ? '…' : '') + win + (best + 300 < text.length ? '…' : '')
}

function unitLabel(unit_id: string): string {
  const last = unit_id.split('-').at(-1) ?? ''
  const m = last.match(/^([A-Z]+)(\d+)$/)
  if (!m) return last || unit_id
  const names: Record<string, string> = {
    CH:'Chapter', SEC:'Section', PRE:'Preface',
    ES:'Executive Summary', ANX:'Annexure', APP:'Appendix', INT:'Introduction',
  }
  return (names[m[1]] || m[1]) + ' ' + parseInt(m[2])
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const type = req.nextUrl.searchParams.get('type') ?? 'all'

  if (q.length < 2) {
    return NextResponse.json({ reports: [], sections: [], query: q, mode: 'empty' })
  }

  const db = await getDb()

  // ── 1. Report keyword search ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reportHits: any[] = []
  if (type !== 'section') {
    try {
      reportHits = await db.collection('catalog_index').aggregate([
        { $search: {
            index: 'report_search',
            compound: { should: [
              { text: { query: q, path: 'title',   score: { boost: { value: 4 } } } },
              { text: { query: q, path: 'summary', score: { boost: { value: 2 } } } },
              { text: { query: q, path: 'topics',  score: { boost: { value: 1 } } } },
            ]},
          },
        },
        { $match: { portal_section: 'audit_reports' } },
        { $limit: 10 },
        { $project: { product_id:1, title:1, year:1, jurisdiction:1,
                       summary:1, report_number:1, state_id:1 } },
      ]).toArray()
    } catch {
      // Atlas Search not ready — regex fallback
      reportHits = await db.collection('catalog_index').find(
        { portal_section: 'audit_reports',
          $or: [{ 'title.en':   { $regex: q, $options: 'i' } },
                { 'summary.en': { $regex: q, $options: 'i' } }] },
        { projection: { product_id:1, title:1, year:1, jurisdiction:1,
                        summary:1, report_number:1, state_id:1 } }
      ).limit(10).toArray()
    }
  }

  // ── 2. Block keyword search ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let keywordBlocks: any[] = []
  if (type !== 'report') {
    try {
      keywordBlocks = await db.collection('block_vectors').aggregate([
        { $search: { index: 'block_search',
                     text: { query: q, path: 'text_snippet' } } },
        { $limit: 50 },
        { $project: { product_id:1, unit_id:1, block_type:1,
                       para_number:1, text_snippet:1 } },
      ]).toArray()
    } catch {
      keywordBlocks = await db.collection('block_vectors').find(
        { text_snippet: { $regex: q, $options: 'i' } },
        { projection: { product_id:1, unit_id:1, block_type:1,
                        para_number:1, text_snippet:1 } }
      ).limit(50).toArray()
    }
    // Normalise id to unit_id for RRF merging
    keywordBlocks = keywordBlocks.map((b: Record<string,unknown>) => ({ ...b, id: String(b.unit_id) }))
  }

  // ── 3. Block vector (semantic) search ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vectorBlocks: any[] = []
  if (type !== 'report') {
    const queryVec = await embedQuery(q)
    if (queryVec && queryVec.length === VECTOR_DIMS) {
      try {
        vectorBlocks = await db.collection('block_vectors').aggregate([
          { $vectorSearch: {
              index:         'block_vector_index',
              path:          'embedding',
              queryVector:   queryVec,
              numCandidates: 200,   // search wider, return fewer
              limit:         50,
            },
          },
          { $project: { product_id:1, unit_id:1, block_type:1,
                         para_number:1, text_snippet:1,
                         vector_score: { $meta: 'vectorSearchScore' } } },
        ]).toArray()
        vectorBlocks = vectorBlocks.map((b: Record<string,unknown>) => ({ ...b, id: String(b.unit_id) }))
      } catch (e) {
        console.error('$vectorSearch failed:', e)
      }
    } else if (queryVec && queryVec.length !== VECTOR_DIMS) {
      console.error(`Embedding dim mismatch: expected ${VECTOR_DIMS}, got ${queryVec.length}`)
    }
  }

  // ── 4. Merge blocks via RRF ──────────────────────────────────────────────
  const merged = rrf([keywordBlocks, vectorBlocks])

  // One result per unit_id (highest-scored block per section)
  const seen = new Set<string>()
  const topSections = merged
    .filter(b => { if (seen.has(b.unit_id)) return false; seen.add(b.unit_id); return true })
    .slice(0, 20)

  // ── 5. Enrich sections with report metadata ──────────────────────────────
  const productIds = Array.from(new Set(topSections.map(b => String(b.product_id))))
  const reportMetaMap: Record<string, unknown> = {}
  if (productIds.length) {
    const metas = await db.collection('catalog_index')
      .find({ product_id: { $in: productIds } },
            { projection: { product_id:1, title:1, year:1, jurisdiction:1 } })
      .toArray()
    for (const m of metas) reportMetaMap[String((m as { product_id:string }).product_id)] = m
  }

  const usedVector = vectorBlocks.length > 0

  return NextResponse.json({
    query:   q,
    mode:    usedVector ? 'hybrid' : 'keyword',

    reports: reportHits.map(r => ({
      type:          'report',
      product_id:    r.product_id,
      title:         ml(r.title),
      year:          r.year,
      jurisdiction:  r.jurisdiction,
      summary:       highlight(ml(r.summary), q),
      report_number: r.report_number,
      state_id:      r.state_id,
      href:          `/report/${r.product_id}`,
    })),

    sections: topSections.map(b => ({
      type:        'section',
      product_id:  b.product_id,
      unit_id:     b.unit_id,
      unit_label:  unitLabel(String(b.unit_id)),
      para_number: b.para_number,
      snippet:     highlight(String(b.text_snippet || ''), q),
      rrf_score:   b.rrf_score,
      report:      reportMetaMap[String(b.product_id)],
      href:        `/report/${b.product_id}/section/${b.unit_id}?q=${encodeURIComponent(q)}`,
    })),
  })
}
