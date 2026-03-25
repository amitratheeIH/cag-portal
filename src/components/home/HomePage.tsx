'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Counts {
  audit: { total: number; union: number; state: number; ut: number; lg: number }
  accounts: { total: number; union: number; state: number }
  finance: { total: number; union: number; state: number }
  other: { total: number; study: number; compendium: number; impact_study: number }
  impact: { total: number }
}

interface ReportCard {
  product_id: string
  title: string
  year: number
  jurisdiction?: string
  portal_section: string
  report_number?: { number: number; year: number }
  state_ut?: string
  last_indexed: string
}

const EMPTY_COUNTS: Counts = {
  audit:    { total: 0, union: 0, state: 0, ut: 0, lg: 0 },
  accounts: { total: 0, union: 0, state: 0 },
  finance:  { total: 0, union: 0, state: 0 },
  other:    { total: 0, study: 0, compendium: 0, impact_study: 0 },
  impact:   { total: 0 },
}

// ── Accessibility bar (client-only component) ─────────────────
function A11yBar() {
  const [open, setOpen]         = useState(false)
  const [textSize, setTextSize] = useState(0)   // -1, 0, +1, +2
  const [contrast, setContrast] = useState(false)
  const [invert, setInvert]     = useState(false)
  const [dark, setDark]         = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Apply text size
  useEffect(() => {
    const sizes = [14, 16, 19, 22]
    document.documentElement.style.fontSize = sizes[textSize + 1] + 'px'
  }, [textSize])

  // Apply contrast / invert / dark
  useEffect(() => {
    const cl = document.documentElement.classList
    cl.toggle('a11y-high-contrast', contrast)
    cl.toggle('a11y-invert', invert)
    cl.toggle('a11y-dark', dark)
  }, [contrast, invert, dark])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
    color: '#fff', fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700,
    padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '4px',
    transition: 'background .15s',
  }
  const activeBtn: React.CSSProperties = { ...btnStyle, background: 'var(--saffron)', borderColor: 'var(--saffron)' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px' }}>
      {/* Quick controls always visible */}
      <button
        style={btnStyle}
        onClick={() => setTextSize(t => Math.max(-1, t - 1))}
        title="Decrease text size"
        aria-label="Decrease text size"
      >A−</button>
      <button
        style={btnStyle}
        onClick={() => setTextSize(0)}
        title="Reset text size"
        aria-label="Reset text size"
      >A</button>
      <button
        style={btnStyle}
        onClick={() => setTextSize(t => Math.min(2, t + 1))}
        title="Increase text size"
        aria-label="Increase text size"
      >A+</button>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,.2)' }}/>

      {/* More options button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ ...btnStyle, gap: '5px' }}
        aria-label="More accessibility options"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
        </svg>
        <span>Accessibility</span>
        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path d={open ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Accessibility options"
          style={{
            position: 'absolute', top: '32px', right: 0,
            background: '#fff', border: '1px solid var(--rule)',
            borderRadius: '8px', padding: '16px', width: '260px',
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
            zIndex: 100,
          }}
        >
          <div style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: '12px' }}>
            Accessibility Options
          </div>

          {/* Text size */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: 'system-ui', fontSize: '11px', color: 'var(--ink2)', marginBottom: '6px' }}>Text Size</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ label: 'A−', val: -1 }, { label: 'A', val: 0 }, { label: 'A+', val: 1 }, { label: 'A++', val: 2 }].map(({ label, val }) => (
                <button key={val}
                  onClick={() => setTextSize(val)}
                  style={{
                    flex: 1, padding: '6px 0', fontFamily: 'system-ui', fontWeight: 700,
                    fontSize: label === 'A−' ? '11px' : label === 'A' ? '13px' : label === 'A+' ? '15px' : '17px',
                    border: '1px solid', borderRadius: '5px', cursor: 'pointer',
                    borderColor: textSize === val ? 'var(--navy)' : 'var(--rule)',
                    background: textSize === val ? 'var(--navy-lt)' : '#fff',
                    color: textSize === val ? 'var(--navy)' : 'var(--ink)',
                  }}
                  aria-pressed={textSize === val}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          {[
            { label: 'High Contrast',  val: contrast, set: setContrast, desc: 'Increase colour contrast' },
            { label: 'Invert Colours', val: invert,   set: setInvert,   desc: 'Invert all colours' },
            { label: 'Dark Mode',      val: dark,     set: setDark,     desc: 'Switch to dark theme' },
          ].map(({ label, val, set, desc }) => (
            <button key={label}
              onClick={() => set((v: boolean) => !v)}
              aria-pressed={val}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', marginBottom: '6px', borderRadius: '6px',
                border: `1px solid ${val ? 'var(--navy)' : 'var(--rule)'}`,
                background: val ? 'var(--navy-lt)' : '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'system-ui', fontSize: '12px', fontWeight: 600, color: val ? 'var(--navy)' : 'var(--ink)' }}>{label}</div>
                <div style={{ fontFamily: 'system-ui', fontSize: '10px', color: 'var(--ink3)' }}>{desc}</div>
              </div>
              {/* Toggle pill */}
              <div style={{
                width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0,
                background: val ? 'var(--navy)' : 'var(--rule)',
                position: 'relative', transition: 'background .2s',
              }}>
                <div style={{
                  position: 'absolute', top: '2px',
                  left: val ? '18px' : '2px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: '#fff', transition: 'left .2s',
                }}/>
              </div>
            </button>
          ))}

          <button
            onClick={() => { setTextSize(0); setContrast(false); setInvert(false); setDark(false) }}
            style={{ width: '100%', padding: '7px', fontFamily: 'system-ui', fontSize: '11px', color: 'var(--ink3)', background: 'none', border: '1px solid var(--rule)', borderRadius: '5px', cursor: 'pointer', marginTop: '4px' }}
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  )
}

// ── Category postcard ─────────────────────────────────────────
interface PostcardProps {
  icon: string
  color: string
  colorLight: string
  title: string
  total: number | null
  items: { label: string; count: number | null; href?: string; placeholder?: boolean }[]
  placeholder?: boolean
}

function Postcard({ icon, color, colorLight, title, total, items, placeholder }: PostcardProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--rule)',
      borderRadius: '10px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 2px 8px rgba(26,58,107,.06)',
      minWidth: 0,
      flex: '1 1 0',
      transition: 'box-shadow .2s, transform .2s',
    }}
    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 8px 24px rgba(26,58,107,.12)'; el.style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 2px 8px rgba(26,58,107,.06)'; el.style.transform = 'none' }}
    >
      {/* Top colour band */}
      <div style={{ height: '5px', background: color }}/>

      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--rule-lt)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: colorLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
          }} aria-hidden="true">{icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'system-ui', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: '2px' }}>
              Category
            </div>
            <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '17px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
              {title}
            </div>
          </div>
          {/* Total count */}
          {!placeholder && (
            <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '32px', fontWeight: 700, color, lineHeight: 1 }}>
                {total ?? '—'}
              </div>
              <div style={{ fontFamily: 'system-ui', fontSize: '9px', color: 'var(--ink3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                total
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-items */}
      <div style={{ padding: '8px 0', flex: 1 }}>
        {items.map((item, i) => {
          const isClickable = !!item.href && !item.placeholder
          const content = (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 18px', gap: '8px',
              cursor: isClickable ? 'pointer' : 'default',
              transition: 'background .12s',
            }}
            onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLElement).style.background = colorLight }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                {/* Dot */}
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isClickable ? color : 'var(--rule)', flexShrink: 0 }}/>
                <span style={{
                  fontFamily: 'system-ui', fontSize: '12.5px',
                  color: isClickable ? 'var(--navy)' : 'var(--ink3)',
                  fontWeight: isClickable ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.label}
                  {item.placeholder && (
                    <span style={{ fontFamily: 'system-ui', fontSize: '10px', color: 'var(--ink3)', marginLeft: '6px', fontStyle: 'italic' }}>
                      (coming soon)
                    </span>
                  )}
                </span>
              </div>
              <div style={{
                fontFamily: 'system-ui', fontSize: '13px', fontWeight: 700,
                color: isClickable ? color : 'var(--ink3)',
                flexShrink: 0,
              }}>
                {item.placeholder ? '—' : (item.count ?? '—')}
              </div>
            </div>
          )
          return isClickable
            ? <a key={i} href={item.href} style={{ display: 'block', textDecoration: 'none' }}>{content}</a>
            : <div key={i}>{content}</div>
        })}
      </div>
    </div>
  )
}

// ── Latest report strip ───────────────────────────────────────
interface LatestStripProps {
  title: string
  color: string
  href: string
  reports: ReportCard[]
  loading: boolean
}

function LatestStrip({ title, color, href, reports, loading }: LatestStripProps) {
  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '4px', height: '20px', background: color, borderRadius: '2px' }}/>
          <h3 style={{ fontFamily: '"EB Garamond","Times New Roman",serif', fontSize: '19px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            {title}
          </h3>
        </div>
        <a href={href} style={{ fontFamily: 'system-ui', fontSize: '12px', color: 'var(--navy)', fontWeight: 600, textDecoration: 'none' }}
          className="hover:underline">
          View all →
        </a>
      </div>

      {/* Cards row */}
      <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                minWidth: '240px', height: '130px', borderRadius: '8px',
                background: 'linear-gradient(90deg, #f0ece4 25%, #e8e4dc 50%, #f0ece4 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
                flexShrink: 0,
              }}/>
            ))
          : reports.length === 0
            ? <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'var(--ink3)', padding: '20px 0' }}>
                No reports available yet.
              </div>
            : reports.map(r => (
                <a key={r.product_id} href={`/report/${r.product_id}`}
                  style={{ textDecoration: 'none', flexShrink: 0, minWidth: '240px', maxWidth: '280px' }}>
                  <div style={{
                    background: '#fff', border: '1px solid var(--rule)', borderRadius: '8px',
                    padding: '14px', height: '100%',
                    boxShadow: '0 1px 4px rgba(26,58,107,.06)',
                    transition: 'box-shadow .15s, transform .15s',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 4px 16px rgba(26,58,107,.12)'; el.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 1px 4px rgba(26,58,107,.06)'; el.style.transform = 'none' }}
                  >
                    {/* Year + jurisdiction badge */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700,
                        background: color, color: '#fff',
                        padding: '2px 7px', borderRadius: '10px',
                      }}>{r.year}</span>
                      {r.jurisdiction && (
                        <span style={{
                          fontFamily: 'system-ui', fontSize: '10px', fontWeight: 600,
                          background: 'var(--navy-lt)', color: 'var(--navy)',
                          padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(26,58,107,.15)',
                        }}>{r.jurisdiction}</span>
                      )}
                    </div>
                    {/* Title */}
                    <div style={{
                      fontFamily: '"EB Garamond","Times New Roman",serif',
                      fontSize: '14.5px', fontWeight: 600, color: 'var(--ink)',
                      lineHeight: 1.4, flex: 1,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {r.title}
                    </div>
                    {/* Report number */}
                    {r.report_number && (
                      <div style={{ fontFamily: 'system-ui', fontSize: '10.5px', color: 'var(--ink3)' }}>
                        Report No. {r.report_number.number} of {r.report_number.year}
                      </div>
                    )}
                  </div>
                </a>
              ))
        }
      </div>
    </div>
  )
}

// ── Main home page ────────────────────────────────────────────
export default function HomePage() {
  const [counts, setCounts]   = useState<Counts>(EMPTY_COUNTS)
  const [latest, setLatest]   = useState<Record<string, ReportCard[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Wire the A11y bar controls into the header slot
    const slot = document.getElementById('a11y-controls')
    if (slot) {
      // A11yBar renders separately — this is just a marker
      slot.setAttribute('data-mounted', 'true')
    }

    // Fetch counts + latest from API
    async function load() {
      try {
        const [countsRes, latestRes] = await Promise.allSettled([
          fetch('/api/home/counts').then(r => r.ok ? r.json() : null),
          fetch('/api/home/latest').then(r => r.ok ? r.json() : null),
        ])
        if (countsRes.status === 'fulfilled' && countsRes.value) setCounts(countsRes.value)
        if (latestRes.status === 'fulfilled' && latestRes.value) setLatest(latestRes.value)
      } catch {
        // Silently fail — UI still renders with zeros
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const c = counts

  return (
    <>
      <main id="main-content">

        {/* ── Section 1: Category postcards ─────────────────── */}
        <section aria-labelledby="categories-heading" style={{ background: 'var(--cream)', padding: '40px 20px 36px', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

            <div style={{ marginBottom: '24px' }}>
              <h2 id="categories-heading" style={{
                fontFamily: '"EB Garamond","Times New Roman",serif',
                fontSize: '28px', fontWeight: 700, color: 'var(--navy)',
                margin: '0 0 4px',
              }}>
                Audit and Accountability Repository
              </h2>
              <p style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'var(--ink3)', margin: 0 }}>
                Browse reports by category · counts reflect the live database
              </p>
            </div>

            {/* Five postcards */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>

              {/* 1. Audit Reports */}
              <Postcard
                icon="📋" color="var(--navy)" colorLight="var(--navy-lt)"
                title="Audit Reports"
                total={c.audit.total}
                items={[
                  { label: 'Union Audit Reports',  count: c.audit.union,  href: '/reports?section=audit_reports&jurisdiction=UNION' },
                  { label: 'State Audit Reports',  count: c.audit.state,  href: '/reports?section=audit_reports&jurisdiction=STATE' },
                  { label: 'UT Audit Reports',     count: c.audit.ut,     href: '/reports?section=audit_reports&jurisdiction=UT'    },
                  { label: 'Local Body Reports',   count: c.audit.lg,     href: '/reports?section=audit_reports&jurisdiction=LG'    },
                ]}
              />

              {/* 2. Accounts */}
              <Postcard
                icon="📒" color="#5a3f8a" colorLight="#f3eeff"
                title="Accounts Reports"
                total={c.accounts.total || null}
                placeholder
                items={[
                  { label: 'Union Accounts', count: c.accounts.union, placeholder: true },
                  { label: 'State Accounts', count: c.accounts.state, placeholder: true },
                ]}
              />

              {/* 3. Finance Reports */}
              <Postcard
                icon="📊" color="var(--green)" colorLight="var(--green-lt)"
                title="Finance Reports"
                total={c.finance.total || null}
                placeholder
                items={[
                  { label: 'Union Finance Reports', count: c.finance.union, placeholder: true },
                  { label: 'State Finance Reports', count: c.finance.state, placeholder: true },
                ]}
              />

              {/* 4. Other Reports */}
              <Postcard
                icon="📚" color="var(--saffron)" colorLight="var(--saffron-lt)"
                title="Other Reports"
                total={c.other.total || null}
                items={[
                  { label: 'Study Reports',    count: c.other.study,       href: '/reports?section=study_reports' },
                  { label: 'Compendiums',      count: c.other.compendium,  href: '/reports?section=compendium'    },
                  { label: 'Impact Studies',   count: c.other.impact_study, href: '/reports?section=compendium'   },
                ]}
              />

              {/* 5. Audit Impact */}
              <Postcard
                icon="⚖️" color="var(--red)" colorLight="var(--red-lt)"
                title="Audit Impact"
                total={c.impact.total || null}
                placeholder
                items={[
                  { label: 'Audit Impact Reports', count: c.impact.total, placeholder: true },
                  { label: 'Recoveries & Savings',  count: null, placeholder: true },
                ]}
              />

            </div>
          </div>
        </section>

        {/* ── Section 2: Latest in each category ─────────────── */}
        <section aria-labelledby="latest-heading" style={{ padding: '40px 20px 60px', background: '#fff' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '28px' }}>
              <h2 id="latest-heading" style={{
                fontFamily: '"EB Garamond","Times New Roman",serif',
                fontSize: '26px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px',
              }}>
                Latest Reports
              </h2>
              <p style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'var(--ink3)', margin: 0 }}>
                Most recently added to the repository
              </p>
            </div>

            <LatestStrip
              title="Audit Reports"
              color="var(--navy)"
              href="/reports?section=audit_reports"
              reports={latest.audit_reports || []}
              loading={loading}
            />
            <LatestStrip
              title="Accounts Reports"
              color="#5a3f8a"
              href="/reports?section=accounts_reports"
              reports={latest.accounts_reports || []}
              loading={loading}
            />
            <LatestStrip
              title="Finance Reports"
              color="var(--green)"
              href="/reports?section=finance_reports"
              reports={latest.finance_reports || []}
              loading={loading}
            />
            <LatestStrip
              title="Study Reports &amp; Compendiums"
              color="var(--saffron)"
              href="/reports?section=study_reports"
              reports={latest.study_reports || []}
              loading={loading}
            />

          </div>
        </section>

      </main>

    </>
  )
}


