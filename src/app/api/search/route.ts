// src/app/api/search/route.ts
// Hybrid search: keyword (regex always + Atlas Search if available) +
// semantic ($vectorSearch) merged via RRF.
//
// Strategy: ALWAYS run regex as baseline. Atlas Search and vector search
// add ranking quality on top. This way results always appear even if
// Atlas Search indexes have missing fields or aren't fully built.

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

// ── Cohere query embedding (1024 dims) ────────────────────────────────────────
async function embedQuery(text: string): Promise<number[] | null> {
  const key = process.env.COHERE_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'Cohere-Version': '2022-12-06',
      },
      body: JSON.stringify({
        model: 'embed-english-v3.0',
        texts: [text],
        input_type: 'search_query',
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { embeddings: number[][] }
    return data.embeddings[0] ?? null
  } catch { return null }
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
    .map(([id, score]) => ({ ...docs[id], rrf_score: score }))
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
    CH: 'Chapter', SEC: 'Section', PRE: 'Preface',
    ES: 'Executive Summary', ANX: 'Annexure', APP: 'Appendix', INT: 'Introduction',
  }
  return (names[m[1]] || m[1]) + ' ' + parseInt(m[2])
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const type = req.nextUrl.searchParams.get('type') ?? 'all'
  const mode = req.nextUrl.searchParams.get('mode') ?? 'hybrid'
  // mode: 'hybrid' = keyword+vector, 'text' = keyword only, 'semantic' = vector only

  if (q.length < 2) {
    return NextResponse.json({ reports: [], sections: [], query: q, mode: 'empty' })
  }

  const db = await getDb()

  // ── 1. Reports: ALWAYS regex + try Atlas Search, merge both ─────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reportHits: any[] = []
  if (type !== 'section') {

    // 1a. Regex — always runs, covers all possible field structures.
    // Searches nested title.en/summary.en AND flat title/summary strings
    // and also pulls reports whose sections mention the query (join via block_vectors).
    const regexHits = await db.collection('catalog_index').find(
      {
        portal_section: 'audit_reports',
        $or: [
          { 'title.en':    { $regex: q, $options: 'i' } },  // {en:"..."} object
          { 'title':       { $regex: q, $options: 'i' } },  // plain string
          { 'summary.en':  { $regex: q, $options: 'i' } },
          { 'summary':     { $regex: q, $options: 'i' } },
          { 'topics':      { $regex: q, $options: 'i' } },
          { 'search_text': { $regex: q, $options: 'i' } },  // flat keyword bag
        ]
      },
      { projection: { product_id:1, title:1, year:1, jurisdiction:1,
                      summary:1, report_number:1, state_id:1 } }
    ).limit(20).toArray()

    // Also surface reports whose block content mentions the query
    // (catches cases where title/summary don't match but sections do)
    const blockProductIds = await db.collection('block_vectors').distinct(
      'product_id',
      { text_snippet: { $regex: q, $options: 'i' } }
    )
    const existingIds = new Set(regexHits.map((r: Record<string,unknown>) => String(r.product_id)))
    const extraReports = blockProductIds.length > 0
      ? await db.collection('catalog_index').find(
          { product_id: { $in: blockProductIds.filter((id: string) => !existingIds.has(id)) },
            portal_section: 'audit_reports' },
          { projection: { product_id:1, title:1, year:1, jurisdiction:1,
                          summary:1, report_number:1, state_id:1 } }
        ).limit(10).toArray()
      : []

    // 1b. Atlas Search — adds relevance ranking, may return 0 if fields not indexed
    let atlasHits: typeof regexHits = []
    try {
      atlasHits = await db.collection('catalog_index').aggregate([
        { $search: {
            index: 'report_search',
            compound: { should: [
              { text: { query: q, path: 'title.en',    score: { boost: { value: 4 } } } },
              { text: { query: q, path: 'summary.en',  score: { boost: { value: 2 } } } },
              { text: { query: q, path: 'search_text', score: { boost: { value: 2 } } } },
              { text: { query: q, path: 'topics',      score: { boost: { value: 1 } } } },
            ]},
          },
        },
        { $match: { portal_section: 'audit_reports' } },
        { $limit: 15 },
        { $project: { product_id:1, title:1, year:1, jurisdiction:1,
                       summary:1, report_number:1, state_id:1 } },
      ]).toArray() as typeof regexHits
    } catch { /* Atlas Search not available or misconfigured — regex covers us */ }

    // Merge: Atlas first (best ranked), then regex title/summary matches,
    // then reports surfaced from block content
    const seen = new Set<string>()
    for (const r of [...atlasHits, ...regexHits, ...extraReports]) {
      const id = String(r.product_id)
      if (!seen.has(id)) { seen.add(id); reportHits.push(r) }
    }
    reportHits = reportHits.slice(0, 15)
  }

  // ── 2. Blocks: ALWAYS regex + try Atlas Search keyword ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let keywordBlocks: any[] = []
  if (type !== 'report') {

    // 2a. Regex on text_snippet — skip in semantic-only mode
    const regexBlocks = mode !== 'semantic' ? await db.collection('block_vectors').find(
      { text_snippet: { $regex: q.split(/\s+/).join('|'), $options: 'i' } },
      { projection: { product_id:1, unit_id:1, block_type:1, para_number:1, text_snippet:1 } }
    ).limit(60).toArray() : []

    // 2b. Atlas Search keyword — better ranking (skip in semantic mode)
    let atlasBlocks: typeof regexBlocks = []
    if (mode !== 'semantic') {
      try {
        atlasBlocks = await db.collection('block_vectors').aggregate([
          { $search: { index: 'block_search',
                       text: { query: q, path: 'text_snippet' } } },
          { $limit: 60 },
          { $project: { product_id:1, unit_id:1, block_type:1,
                         para_number:1, text_snippet:1 } },
        ]).toArray() as typeof regexBlocks
      } catch { /* use regex only */ }
    }

    // Merge
    const seen = new Set<string>()
    for (const b of [...atlasBlocks, ...regexBlocks]) {
      const id = String(b.unit_id)
      if (!seen.has(id)) { seen.add(id); keywordBlocks.push({ ...b, id }) }
    }
  }

  // ── 3. Vector search ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vectorBlocks: any[] = []
  if (type !== 'report' && mode !== 'text') {
    const queryVec = await embedQuery(q)
    if (queryVec) {
      try {
        vectorBlocks = await db.collection('block_vectors').aggregate([
          { $vectorSearch: {
              index:         'block_vector_index',
              path:          'embedding',
              queryVector:   queryVec,
              numCandidates: 300,
              limit:         60,
            },
          },
          { $project: { product_id:1, unit_id:1, block_type:1,
                         para_number:1, text_snippet:1,
                         vector_score: { $meta: 'vectorSearchScore' } } },
        ]).toArray()
        vectorBlocks = vectorBlocks.map((b: Record<string,unknown>) => ({ ...b, id: String(b.unit_id) }))
      } catch (e) { console.error('vectorSearch failed:', e) }
    }
  }

  // ── 4. RRF merge of block results ────────────────────────────────────────
  const merged = rrf([keywordBlocks, vectorBlocks])

  // One result per unit_id
  const seenUnits = new Set<string>()
  const topSections = merged
    .filter(b => { if (seenUnits.has(b.unit_id)) return false; seenUnits.add(b.unit_id); return true })
    .slice(0, 20)

  // ── 5. Enrich sections with report metadata ──────────────────────────────
  const productIds = Array.from(new Set(topSections.map(b => String(b.product_id))))
  const reportMetaMap: Record<string, unknown> = {}
  if (productIds.length) {
    const metas = await db.collection('catalog_index')
      .find({ product_id: { $in: productIds } },
            { projection: { product_id:1, title:1, year:1, jurisdiction:1 } })
      .toArray()
    for (const m of metas)
      reportMetaMap[String((m as unknown as { product_id: string }).product_id)] = m
  }

  return NextResponse.json({
    query:   q,
    mode:    vectorBlocks.length > 0 ? 'hybrid' : 'keyword',
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
