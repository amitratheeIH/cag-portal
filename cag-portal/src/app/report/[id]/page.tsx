import { getDb } from '@/lib/mongodb'
import { ml } from '@/types'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const db = await getDb()
  const doc = await db.collection('catalog_index').findOne({ product_id: params.id })
  if (!doc) return { title: 'Report Not Found' }
  return { title: ml(doc.title as Record<string,string>) }
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const db = await getDb()
  const catalog = await db.collection('catalog_index').findOne({ product_id: params.id })
  if (!catalog) notFound()

  const title = ml(catalog.title as Record<string,string>)

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-6 py-10">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-cag-text3 mb-6 flex items-center gap-2">
        <Link href="/reports" className="hover:text-navy">Reports</Link>
        <span aria-hidden="true">›</span>
        <span className="text-cag-text2">{params.id}</span>
      </nav>

      {/* Report header */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="badge badge-navy">{catalog.year}</span>
          <span className="badge badge-gray">{catalog.jurisdiction}</span>
          {(catalog.audit_type as string[] | undefined)?.[0] && (
            <span className="badge bg-blue-100 text-blue-800">
              {(catalog.audit_type as string[])[0].replace('ATYPE-','')}
            </span>
          )}
        </div>
        <h1 className="font-serif text-2xl font-bold text-navy mb-3">{title}</h1>
        {catalog.summary && (
          <p className="text-sm text-cag-text2 leading-relaxed">
            {ml(catalog.summary as Record<string,string>)}
          </p>
        )}
      </div>

      {/* Reader placeholder */}
      <div className="card text-center py-16 text-cag-text3">
        <div className="text-5xl mb-4">📖</div>
        <div className="font-semibold text-base mb-1">Report Reader</div>
        <div className="text-sm">Coming in Step 3 — full unit-by-unit reader with TOC</div>
        <div className="mt-4 font-mono text-xs bg-cag-bg px-3 py-1 rounded inline-block">
          {params.id}
        </div>
      </div>
    </main>
  )
}
