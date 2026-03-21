'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ml, buildFlatUnitList, type FlatUnit, type ContentUnit, type ContentBlock, type ReportStructure } from '@/types'
import { TOCSidebar } from './TOCSidebar'
import { UnitPanel } from './UnitPanel'

interface ReaderData {
  structure: ReportStructure
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
  metadata: {
    common: { title: Record<string, string>; year: number }
  }
}

interface ReaderClientProps {
  productId: string
  initialData: ReaderData
  unitIdFromUrl?: string
}

export function ReaderClient({ productId, initialData, unitIdFromUrl }: ReaderClientProps) {
  const [flatUnits, setFlatUnits] = useState<FlatUnit[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [tocOpen, setTocOpen] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  // Build flat unit list once on mount
  useEffect(() => {
    const units = buildFlatUnitList(initialData.structure)
    setFlatUnits(units)

    // Navigate to unit from URL if specified
    if (unitIdFromUrl) {
      const idx = units.findIndex(u => u.unit_id === unitIdFromUrl)
      if (idx >= 0) setCurrentIndex(idx)
    }
  }, [initialData.structure, unitIdFromUrl])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') navigateTo(currentIndex + 1)
      if (e.key === 'ArrowLeft')  navigateTo(currentIndex - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, flatUnits.length])

  const navigateTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= flatUnits.length) return
    setCurrentIndex(idx)
    // Scroll content to top
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    // Update URL without reload
    const unit = flatUnits[idx]
    if (unit) {
      window.history.replaceState(null, '', `/report/${productId}?unit=${unit.unit_id}`)
    }
  }, [flatUnits, productId])

  if (flatUnits.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-cag-text3">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cag-border border-t-navy rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm">Loading report…</div>
        </div>
      </div>
    )
  }

  const current = flatUnits[currentIndex]
  const currentBlocks = current ? (initialData.blocks[current.unit_id] || []) : []
  const currentUnitFile = current ? initialData.unitFiles[current.unit_id] : undefined
  const reportTitle = ml(initialData.metadata?.common?.title) || productId

  return (
    <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── TOC Sidebar ──────────────────────────────── */}
      <aside
        className={`flex-shrink-0 border-r overflow-hidden transition-all duration-300 ${
          tocOpen ? 'w-[300px]' : 'w-0'
        }`}
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
        }}
        aria-label="Table of contents"
        aria-hidden={!tocOpen}
      >
        {tocOpen && (
          <TOCSidebar
            units={flatUnits}
            currentIndex={currentIndex}
            onNavigate={navigateTo}
          />
        )}
      </aside>

      {/* ── Main content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Unit nav bar */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-6 border-b"
          style={{
            height: '44px',
            borderColor: 'var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 1px 4px rgba(26,58,107,.06)',
          }}
        >
          {/* Left: TOC toggle + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setTocOpen(v => !v)}
              className="flex-shrink-0 p-1.5 rounded hover:bg-cag-bg transition-colors"
              aria-label={tocOpen ? 'Close table of contents' : 'Open table of contents'}
              title={tocOpen ? 'Hide contents' : 'Show contents'}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
            <div className="flex items-center gap-1.5 text-[12px] text-cag-text3 min-w-0">
              <span className="truncate max-w-[120px]">{reportTitle}</span>
              <span aria-hidden="true">›</span>
              <span className="text-cag-text2 font-medium truncate">
                {current ? (ml(current.title) || current.unit_id) : '—'}
              </span>
            </div>
          </div>

          {/* Right: Prev / Next */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigateTo(currentIndex - 1)}
              disabled={currentIndex <= 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-medium border
                         transition-colors disabled:opacity-30 disabled:pointer-events-none
                         hover:border-navy hover:text-navy hover:bg-blue-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              aria-label="Previous unit"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Previous
            </button>
            <button
              onClick={() => navigateTo(currentIndex + 1)}
              disabled={currentIndex >= flatUnits.length - 1}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-medium border
                         transition-colors disabled:opacity-30 disabled:pointer-events-none
                         hover:border-navy hover:text-navy hover:bg-blue-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              aria-label="Next unit"
            >
              Next
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>

            {/* Unit counter */}
            <span className="text-[11px] text-cag-text3 ml-1 tabular-nums">
              {currentIndex + 1} / {flatUnits.length}
            </span>
          </div>
        </div>

        {/* Scrollable unit content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--bg)' }}
          id="main-content"
          tabIndex={-1}
        >
          {current && (
            <div style={{ background: 'var(--surface)' }} className="min-h-full">
              <UnitPanel
                unit={current}
                unitFile={currentUnitFile}
                blocks={currentBlocks}
                prevUnit={flatUnits[currentIndex - 1]}
                nextUnit={flatUnits[currentIndex + 1]}
                onNavigate={navigateTo}
                reportTitle={reportTitle}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
