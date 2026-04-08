// CAG Portal — root layout with accessibility bar
import type { Metadata } from 'next'
import './globals.css'
import A11yBar from '@/components/home/A11yBar'
import NavigationProgress from '@/components/NavigationProgress'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'CAG Digital Repository',
    template: '%s | CAG Digital Repository',
  },
  description: 'Digital Repository of Audit Reports — Comptroller and Auditor General of India',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-nav">Skip to main content</a>

        {/* Top progress bar — wraps in Suspense because useSearchParams requires it */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>

        {/* ── Combined header: accessibility bar + site header ──────────────
            Wrapped in a single <header role="banner"> so the ReaderClient's
            ResizeObserver captures the combined height in --site-header-h.   */}
        <header
          role="banner"
          className="fixed top-0 left-0 right-0 z-50"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,.3)' }}
        >
          {/* ── Row 1: Accessibility bar ───────────────────────────────── */}
          <div
            id="a11y-bar"
            style={{
              background: '#0f2240',
              borderBottom: '1px solid rgba(255,255,255,.1)',
              padding: '0 20px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
            }}
          >
            {/* Accessibility controls — rendered on every page */}
            <A11yBar />
          </div>

          {/* ── Row 2: Main site header ─────────────────────────────────── */}
          <div
            style={{
              background: 'var(--navy)',
              height: '64px',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            {/* Emblem */}
            <div style={{ flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Emblem of India">
              <span style={{ fontSize: '28px' }} aria-hidden="true">🏛️</span>
            </div>

            <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,.2)', flexShrink: 0 }} aria-hidden="true"/>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '9.5px', fontFamily: 'system-ui', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', lineHeight: 1 }}>
                Comptroller and Auditor General of India
              </div>
              <a
                href="/"
                style={{
                  display: 'block',
                  color: '#fff',
                  fontFamily: '"EB Garamond", "Times New Roman", serif',
                  fontWeight: 600,
                  fontSize: '17px',
                  marginTop: '4px',
                  lineHeight: 1.2,
                  textDecoration: 'none',
                  letterSpacing: '.2px',
                }}
                className="hover:text-white/90 transition-colors"
              >
                Digital Repository of Audit Reports
              </a>
            </div>

            {/* Nav */}
            <nav aria-label="Site navigation" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <a href="/" style={{ color: 'rgba(255,255,255,.8)', fontSize: '13px', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', fontFamily: 'system-ui' }}
                className="hover:text-white hover:bg-white/10 transition-colors">
                Home
              </a>
              <a href="/audit-reports" style={{ color: 'rgba(255,255,255,.8)', fontSize: '13px', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', fontFamily: 'system-ui' }}
                className="hover:text-white hover:bg-white/10 transition-colors">
                Reports
              </a>
              <a href="/search"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  color: 'rgba(255,255,255,.8)', fontSize: '13px',
                  padding: '6px 14px', borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,.25)',
                  textDecoration: 'none', fontFamily: 'system-ui',
                }}
                className="hover:text-white hover:bg-white/10 hover:border-white/40 transition-all"
                aria-label="Search">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <span className="hidden sm:inline">Search</span>
              </a>
            </nav>
          </div>
        </header>

        {/* ── Page content — offset by combined header height (96px = 32 + 64) */}
        <div style={{ marginTop: '96px' }} id="page-content">
          {children}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer
          id="site-footer"
          role="contentinfo"
          style={{
            borderTop: '1px solid var(--rule)',
            background: 'var(--navy)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontFamily: 'system-ui', fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            CAG Digital Repository &nbsp;·&nbsp; Comptroller and Auditor General of India
          </span>
          <span style={{ fontFamily: 'system-ui', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
            GIGW 3.0 Compliant
          </span>
        </footer>
      </body>
    </html>
  )
}
