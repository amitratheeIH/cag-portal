'use client'
// TopicsSection.tsx — collapsible topic browser
// Receives pre-fetched topic data as props (server fetches, client renders)

import React, { useState } from 'react'
import Link from 'next/link'

interface TopicEntry { id: string; label: string; subs: { id: string; label: string }[] }

export default function TopicsSection({ topics }: { topics: TopicEntry[] }) {
  // All expanded by default if few topics, collapsed if many
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    // Expand first 6 by default
    topics.slice(0, 6).forEach(t => { init[t.id] = true })
    return init
  })

  const toggle = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const expandAll  = () => setExpanded(Object.fromEntries(topics.map(t => [t.id, true])))
  const collapseAll = () => setExpanded({})

  return (
    <section style={{ marginBottom: 56 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{ fontFamily: '"EB Garamond","Times New Roman",serif',
                       fontSize: 22, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
            Browse by Topic
          </h2>
          <span style={{ fontFamily: 'system-ui', fontSize: 12, color: 'var(--ink3)' }}>
            {topics.length} topics
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={expandAll} style={{
            fontFamily: 'system-ui', fontSize: 11, fontWeight: 600, color: 'var(--navy)',
            background: 'var(--navy-lt)', border: '1px solid rgba(26,58,107,.2)',
            padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
          }}>
            Expand all
          </button>
          <button onClick={collapseAll} style={{
            fontFamily: 'system-ui', fontSize: 11, fontWeight: 600, color: 'var(--ink3)',
            background: '#fff', border: '1px solid var(--rule)',
            padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
          }}>
            Collapse all
          </button>
        </div>
      </div>

      {topics.length === 0 ? (
        <div style={{ padding: '20px 24px', borderRadius: 8, background: '#f8f9fa',
                      border: '1px solid var(--rule)', fontFamily: 'system-ui',
                      fontSize: 13, color: 'var(--ink3)', fontStyle: 'italic' }}>
          Run <code>sync_taxonomies.py</code> to populate topic data.
        </div>
      ) : (
        <div style={{ columns: '260px 3', gap: 14 }}>
          {topics.map(t => {
            const open = !!expanded[t.id]
            return (
              <div key={t.id} style={{
                breakInside: 'avoid', marginBottom: 12,
                background: '#fff', border: '1px solid var(--rule)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                {/* Header row: toggle button + topic link */}
                <div style={{ display: 'flex', alignItems: 'stretch',
                               borderBottom: open ? '1px solid var(--rule-lt)' : 'none' }}>
                  {/* Toggle chevron */}
                  <button
                    onClick={() => toggle(t.id)}
                    aria-expanded={open}
                    style={{
                      background: open ? 'var(--navy)' : 'var(--navy-lt)',
                      border: 'none', cursor: 'pointer',
                      padding: '0 12px', flexShrink: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid var(--rule-lt)',
                      transition: 'background .12s',
                    }}
                    title={open ? 'Collapse' : 'Expand'}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                         style={{ transition: 'transform .2s',
                                  transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <path d="M1 3l4 4 4-4" stroke={open ? '#fff' : 'var(--navy)'}
                            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {/* Topic title — clicking goes to list */}
                  <Link href={'/audit-reports/list?topic=' + t.id} style={{
                    flex: 1, padding: '10px 14px',
                    fontFamily: 'system-ui', fontSize: 12.5, fontWeight: 700,
                    color: 'var(--navy)', textDecoration: 'none', lineHeight: 1.3,
                    background: open ? 'var(--navy-lt)' : '#fff',
                    transition: 'background .12s',
                    display: 'flex', alignItems: 'center',
                  }}>
                    {t.label}
                  </Link>
                </div>

                {/* Sub-topics — visible when expanded */}
                {open && (
                  <div>
                    {t.subs.map((s, i) => (
                      <Link key={s.id} href={'/audit-reports/list?topic=' + s.id} style={{
                        display: 'block', padding: '7px 14px 7px 22px',
                        borderBottom: i < t.subs.length - 1 ? '1px solid var(--rule-lt)' : 'none',
                        textDecoration: 'none',
                        fontFamily: 'system-ui', fontSize: 11.5, color: 'var(--ink2)',
                        lineHeight: 1.35, transition: 'background .1s, color .1s',
                      }}
                      className="sub-topic-row"
                      >
                        <span style={{ color: 'var(--ink3)', marginRight: 6, fontSize: 10 }}>›</span>
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .sub-topic-row:hover { background: var(--navy-lt) !important; color: var(--navy) !important; }
      `}</style>
    </section>
  )
}
