export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { fetchJson, fetchNdjson } from '@/lib/github'
import type { ReportStructure, ContentUnit, ContentBlock } from '@/types'

// Returns structure + all blocks for all units in one call
// Used by the reader to bootstrap without N+1 requests
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb()

    // 1. Get report_meta (has folder_path)
    const meta = await db.collection('report_meta').findOne(
      { product_id: params.id },
      { projection: { folder_path: 1, metadata: 1, structure_summary: 1 } }
    )
    if (!meta) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const folderPath = meta.folder_path as string

    // 2. Fetch structure from GitHub
    const structure = await fetchJson<ReportStructure>(`${folderPath}/structure.json`)

    // 3. Build flat unit list to know which NDJSON files to fetch
    const allUnits: ContentUnit[] = [
      ...(structure.front_matter || []),
      ...(structure.content_units || []),
      ...(structure.back_matter || []),
    ]

    // 4. Fetch all unit JSON files from GitHub (for title, exec summary, metadata)
    const unitFiles: Record<string, ContentUnit> = {}
    await Promise.allSettled(
      allUnits.map(async (u) => {
        try {
          const uf = await fetchJson<ContentUnit>(`${folderPath}/units/${u.unit_id}.json`)
          unitFiles[u.unit_id] = uf
        } catch {
          // Unit file missing — use structure data
          unitFiles[u.unit_id] = u
        }
      })
    )

    // 5. Find chapter-level units (they have NDJSON files)
    const chapterUnits = allUnits.filter(u =>
      ['chapter', 'preface', 'executive_summary', 'appendix', 'annexure'].includes(u.unit_type)
    )

    // 6. Fetch all block NDJSON files from GitHub
    const allBlocks: Record<string, ContentBlock[]> = {} // unit_id → blocks
    await Promise.allSettled(
      chapterUnits.map(async (ch) => {
        try {
          const blocks = await fetchNdjson<ContentBlock>(
            `${folderPath}/blocks/content_block_${ch.unit_id}.ndjson`
          )
          // Group by unit_id
          blocks.forEach(b => {
            if (!allBlocks[b.unit_id]) allBlocks[b.unit_id] = []
            allBlocks[b.unit_id].push(b)
          })
        } catch {
          // NDJSON missing — skip silently
        }
      })
    )

    // Sort each unit's blocks by seq
    Object.keys(allBlocks).forEach(uid => {
      allBlocks[uid].sort((a, b) => (a.seq || 0) - (b.seq || 0))
    })

    return NextResponse.json({
      structure,
      unitFiles,
      blocks: allBlocks,
      folderPath,
      metadata: meta.metadata,
    })

  } catch (err) {
    console.error('GET /api/reader/[id] error:', err)
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 })
  }
}
