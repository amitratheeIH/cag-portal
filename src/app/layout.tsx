// CAG Portal v2025-03-21
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CAG Audit Reports Portal',
    template: '%s | CAG Portal',
  },
  description: 'Audit Reports of the Comptroller and Auditor General of India',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-nav">Skip to main content</a>

        {/* ── Site Header ─────────────────────────────────── */}
        <header
          className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center gap-3 px-5"
          style={{ background: 'var(--navy)', boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}
          role="banner"
        >
          {/* Emblem */}
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-content-center" aria-label="Emblem of India">
            <span className="text-2xl" aria-hidden="true">🇮🇳</span>
          </div>

          <div className="w-px h-8 flex-shrink-0 bg-white/20" aria-hidden="true" />

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="text-white/60 text-[10px] font-bold tracking-[1.2px] uppercase leading-none">
              Comptroller and Auditor General of India
            </div>
            <a
              href="/"
              className="block text-white font-serif font-semibold text-[13px] mt-1 leading-tight
                         hover:text-white/90 transition-colors"
            >
              Audit Reports Portal
            </a>
          </div>

          {/* Nav links */}
          <nav aria-label="Site navigation" className="hidden md:flex items-center gap-1">
            <a href="/" className="text-white/80 hover:text-white text-sm px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
              Reports
            </a>
            <a href="/search" className="text-white/80 hover:text-white text-sm px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
              Search
            </a>
          </nav>

          {/* Search button (mobile) */}
          <a
            href="/search"
            className="flex items-center gap-2 text-white/80 hover:text-white
                       bg-white/10 hover:bg-white/20 border border-white/20
                       rounded-full px-3 py-1.5 text-sm transition-colors"
            aria-label="Search"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span className="hidden sm:inline">Search</span>
          </a>
        </header>

        {/* ── Page content ────────────────────────────────── */}
        <div className="mt-16" id="page-content">
          {children}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
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
          <span style={{fontFamily:'system-ui',fontSize:'11px',color:'rgba(255,255,255,0.7)',fontWeight:500}}>
            CAG Audit Reports Portal &nbsp;·&nbsp; Comptroller and Auditor General of India
          </span>
          <span style={{fontFamily:'system-ui',fontSize:'10px',color:'rgba(255,255,255,0.4)'}}>
            GIGW 3.0 Compliant
          </span>
        </footer>
      </body>
    </html>
  )
}
