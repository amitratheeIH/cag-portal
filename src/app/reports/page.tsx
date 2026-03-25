import { getDb } from '@/lib/mongodb'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Reports' }

function ml(obj: Record<string, string> | string | null | undefined): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.en || Object.values(obj)[0] || ''
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { section?: string; jurisdiction?: string }
}) {
  const db  = await getDb()

  const filter: Record<string, unknown> = {}
  if (searchParams.section)      filter.portal_section = searchParams.section
  if (searchParams.jurisdiction) filter.jurisdiction   = searchParams.jurisdiction

  const docs = await db
    .collection('catalog_index')
    .find(filter, {
      projection: {
        product_id: 1, title: 1, year: 1,
        jurisdiction: 1, portal_section: 1,
        report_number: 1, summary: 1,
      },
    })
    .sort({ year: -1 })
    .limit(100)
    .toArray()

  const sectionLabel: Record<string, string> = {
    audit_reports:    'Audit Reports',
    accounts_reports: 'Accounts Reports',
    finance_reports:  'Finance Reports',
    study_reports:    'Study Reports',
    audit_impact:     'Audit Impact',
    compendium:       'Compendiums',
  }

  const heading = searchParams.section
    ? sectionLabel[searchParams.section] || 'Reports'
    : 'All Reports'

  return (
    <main id="main-content" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: '6px' }}>
          <Link href="/" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Home</Link>
          {' → '}Reports
        </div>
        <h1 style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '32px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
          {heading}
        </h1>
        <p style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'var(--ink3)', margin: 0 }}>
          {docs.length} report{docs.length !== 1 ? 's' : ''} found
          {searchParams.jurisdiction ? ` · ${searchParams.jurisdiction}` : ''}
        </p>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
        {[
          { label: 'All',       href: '/reports' },
          { label: 'Audit',     href: '/reports?section=audit_reports' },
          { label: 'Accounts',  href: '/reports?section=accounts_reports' },
          { label: 'Finance',   href: '/reports?section=finance_reports' },
          { label: 'Studies',   href: '/reports?section=study_reports' },
        ].map(({ label, href }) => {
          const isActive = href === `/reports${searchParams.section ? `?section=${searchParams.section}` : ''}`
          return (
            <Link key={label} href={href} style={{
              fontFamily: 'system-ui', fontSize: '12px', fontWeight: 600,
              padding: '5px 14px', borderRadius: '20px', textDecoration: 'none',
              border: '1px solid',
              borderColor: isActive ? 'var(--navy)' : 'var(--rule)',
              background:  isActive ? 'var(--navy)' : '#fff',
              color:       isActive ? '#fff' : 'var(--ink2)',
            }}>{label}</Link>
          )
        })}
      </div>

      {/* Report list */}
      {docs.length === 0 ? (
        <div style={{ fontFamily: 'system-ui', fontSize: '14px', color: 'var(--ink3)', padding: '40px 0', textAlign: 'center' }}>
          No reports found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {docs.map(doc => {
            const title = ml(doc.title as Record<string,string>)
            const summary = ml((doc.summary || {}) as Record<string,string>)
            const rn = doc.report_number as { number: number; year: number } | undefined
            return (
              <Link key={doc.product_id} href={`/report/${doc.product_id}`}
                style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  background: '#fff', border: '1px solid var(--rule)',
                  borderRadius: '8px', padding: '18px 22px',
                  boxShadow: '0 1px 3px rgba(26,58,107,.05)',
                  transition: 'box-shadow .15s, border-color .15s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.boxShadow = '0 4px 16px rgba(26,58,107,.1)'
                  el.style.borderColor = 'var(--navy)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.boxShadow = '0 1px 3px rgba(26,58,107,.05)'
                  el.style.borderColor = 'var(--rule)'
                }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {doc.year && (
                      <span style={{ fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700, background: 'var(--navy)', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>
                        {doc.year}
                      </span>
                    )}
                    {doc.jurisdiction && (
                      <span style={{ fontFamily: 'system-ui', fontSize: '10px', fontWeight: 600, background: 'var(--navy-lt)', color: 'var(--navy)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(26,58,107,.15)' }}>
                        {doc.jurisdiction}
                      </span>
                    )}
                    {rn && (
                      <span style={{ fontFamily: 'system-ui', fontSize: '10px', color: 'var(--ink3)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--rule)' }}>
                        Report No. {rn.number} of {rn.year}
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '18px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35, marginBottom: summary ? '6px' : 0 }}>
                    {title}
                  </div>
                  {/* Summary */}
                  {summary && (
                    <p style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'var(--ink3)', margin: 0, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
