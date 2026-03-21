import { getDb } from '@/lib/mongodb'
import { fetchJson, fetchNdjson } from '@/lib/github'
import { ml, type ReportStructure, type ContentUnit, type ContentBlock } from '@/types'
import { notFound } from 'next/navigation'
import { ReaderClient } from '@/components/reader/ReaderClient'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
  searchParams: { unit?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db = await getDb()
  const doc = await db.collection('catalog_index').findOne({ product_id: params.id })
  if (!doc) return { title: 'Report Not Found' }
  return {
    title: ml(doc.title as Record<string, string>),
    description: ml((doc.summary || {}) as Record<string, string>),
  }
}

export default async function ReportPage({ params, searchParams }: Props) {
  const db = await getDb()

  const meta = await db.collection('report_meta').findOne({ product_id: params.id })
  if (!meta) notFound()

  const folderPath = meta.folder_path as string

  // Fetch structure from GitHub
  let structure: ReportStructure
  try {
    structure = await fetchJson<ReportStructure>(`${folderPath}/structure.json`)
  } catch {
    return (
      <main id="main-content" className="max-w-3xl mx-auto px-6 py-16 text-center text-cag-text3">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="font-serif text-xl font-bold text-navy mb-2">Structure not found</h1>
        <p className="text-sm">Could not load structure.json from GitHub for {params.id}</p>
      </main>
    )
  }

  const allUnits: ContentUnit[] = [
    ...(structure.front_matter || []),
    ...(structure.content_units || []),
    ...(structure.back_matter || []),
  ]

  // Fetch all unit JSON files
  const unitFiles: Record<string, ContentUnit> = {}
  await Promise.allSettled(
    allUnits.map(async (u) => {
      try {
        unitFiles[u.unit_id] = await fetchJson<ContentUnit>(`${folderPath}/units/${u.unit_id}.json`)
      } catch {
        unitFiles[u.unit_id] = u
      }
    })
  )

  // Fetch all NDJSON block files
  const chapterUnits = allUnits.filter(u =>
    ['chapter', 'preface', 'executive_summary', 'appendix', 'annexure'].includes(u.unit_type)
  )
  const allBlocks: Record<string, ContentBlock[]> = {}
  await Promise.allSettled(
    chapterUnits.map(async (ch) => {
      try {
        const blocks = await fetchNdjson<ContentBlock>(
          `${folderPath}/blocks/content_block_${ch.unit_id}.ndjson`
        )
        blocks.forEach(b => {
          if (!allBlocks[b.unit_id]) allBlocks[b.unit_id] = []
          allBlocks[b.unit_id].push(b)
        })
      } catch { /* silent */ }
    })
  )
  Object.keys(allBlocks).forEach(uid => {
    allBlocks[uid].sort((a, b) => (a.seq || 0) - (b.seq || 0))
  })

  // Fetch footnote files — stored as footnotes/footnotes_{unit_id}.json
  const allFootnotes: Record<string, unknown[]> = {}
  await Promise.allSettled(
    allUnits.map(async (u) => {
      try {
        const fn = await fetchJson<{footnotes: unknown[]}>(`${folderPath}/footnotes/footnotes_${u.unit_id}.json`)
        if (fn?.footnotes?.length) allFootnotes[u.unit_id] = fn.footnotes
      } catch { /* footnotes optional */ }
    })
  )

  return (
    <ReaderClient
      productId={params.id}
      initialData={{
        structure,
        unitFiles,
        blocks: allBlocks,
        footnotes: allFootnotes,
        metadata: meta.metadata as { common: { title: Record<string, string>; year: number } },
      }}
      unitIdFromUrl={searchParams.unit}
      folderPath={folderPath}
    />
  )
}
