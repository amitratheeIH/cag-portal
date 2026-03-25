'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ml, buildFlatUnitList, type FlatUnit, type ContentUnit, type ContentBlock, type ReportStructure } from '@/types'
import { BlockRenderer, setFolderPath, setFnIndex, setInlineFnText, setAnnIndex, setAnnVisible, getAnnVisible, setRefIndex, setNavCallback } from '@/components/blocks/BlockRenderer'
import { afcLabel } from '@/lib/taxonomy-labels'

// ── Footnote types ────────────────────────────────────────────
interface Fn {
  footnote_id?: string
  marker: string
  text?: Record<string,string> | string
  anchor_block_id?: string
  display_scope?: string
}

// ── Module-level footnote state ───────────────────────────────
let _fnMap: Record<string, Fn[]> = {}  // uid → footnotes

export function setFootnotes(raw: Record<string, unknown[]>) {
  _fnMap = {}
  // Also build inline fn text map for richbox inline footnotes
  const inlineTextMap: Record<string, string> = {}
  Object.entries(raw).forEach(([uid, list]) => {
    _fnMap[uid] = list as Fn[]
    ;(list as Fn[]).forEach(fn => {
      const key = fn.footnote_id || fn.marker
      const text = typeof fn.text === 'string' ? fn.text
        : (fn.text as Record<string,string>)?.en || Object.values(fn.text || {})[0] as string || ''
      inlineTextMap[key] = text
    })
  })
  setInlineFnText(inlineTextMap)
}

function buildFnIndexForChapter(chapterUid: string, sectionUids: string[]): Record<string, Fn[]> {
  // Returns: block_id → footnotes anchored to that block
  const idx: Record<string, Fn[]> = {}
  ;[chapterUid, ...sectionUids].forEach(uid => {
    (_fnMap[uid] || []).forEach(fn => {
      const bid = fn.anchor_block_id
      if (bid) {
        if (!idx[bid]) idx[bid] = []
        idx[bid].push(fn)
      }
    })
  })
  return idx
}

function collectChapterFn(chapterUid: string, sectionUids: string[]): Fn[] {
  const all: Fn[] = []
  const seen = new Set<string>()
  ;[chapterUid, ...sectionUids].forEach(uid => {
    (_fnMap[uid] || []).forEach(fn => {
      const key = fn.footnote_id || `${uid}-${fn.marker}`
      if (!seen.has(key)) { seen.add(key); all.push(fn) }
    })
  })
  return all.sort((a,b) => (parseInt(a.marker)||0) - (parseInt(b.marker)||0))
}

// ── Top-level: depth 0 in the flat list ──────────────────────
function isTopLevel(u: FlatUnit): boolean {
  return u.depth === 0
}

// ── Direct children of a unit, sorted by seq ─────────────────
function getSections(parentUid: string, flatUnits: FlatUnit[]): FlatUnit[] {
  return flatUnits
    .filter(u => u.parent_id === parentUid)
    .sort((a,b) => (a.seq||0) - (b.seq||0))
}

// ── ALL descendants of a unit recursively (for footnote collection) ──
function getDescendantUids(parentUid: string, flatUnits: FlatUnit[]): string[] {
  const direct = flatUnits.filter(u => u.parent_id === parentUid)
  return direct.flatMap(u => [u.unit_id, ...getDescendantUids(u.unit_id, flatUnits)])
}

// ── ReaderData ────────────────────────────────────────────────
interface ReaderData {
  structure: ReportStructure
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
  footnotes?: Record<string, unknown[]>
  metadata: { common: { title: Record<string, string>; year: number } }
}

// ── Main ──────────────────────────────────────────────────────
export function ReaderClient({ productId, initialData, unitIdFromUrl, folderPath }: {
  productId: string; initialData: ReaderData; unitIdFromUrl?: string; folderPath?: string
}) {
  // Set module-level state synchronously — these are plain variable assignments, not React state
  if (folderPath) setFolderPath(folderPath)
  if (initialData.footnotes) setFootnotes(initialData.footnotes)

  const [flatUnits, setFlatUnits] = useState<FlatUnit[]>([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [annVisible, setAnnVisibleState] = useState(false)
  const [blockVersion, setBlockVersion] = useState(0)
  const [readerMode, setReaderMode] = useState(false)

  const toggleAnnotations = () => {
    const next = !annVisible
    setAnnVisible(next)
    setAnnVisibleState(next)
  }

  const toggleReaderMode = () => {
    const next = !readerMode
    setReaderMode(next)
    if (next) {
      // Enter reader mode: close TOC, hide site header
      setTocOpen(false)
      document.documentElement.classList.add('reader-fullscreen')
    } else {
      // Exit: restore TOC on desktop, show header
      if (!isMobile) setTocOpen(true)
      document.documentElement.classList.remove('reader-fullscreen')
    }
  }
  const [isMobile, setIsMobile] = useState(false)
  // Lazy init: start closed on mobile so TOC never flashes open on load
  const [tocOpen, setTocOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setTocOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const contentRef        = useRef<HTMLDivElement>(null)
  const spyLockedRef       = useRef(false)
  const spyTimerRef        = useRef<ReturnType<typeof setTimeout>>()

  const chapters = useMemo(() => flatUnits.filter(isTopLevel), [flatUnits])



  useEffect(() => {
    const units = buildFlatUnitList(initialData.structure)
    setFlatUnits(units)
    const tops = units.filter(isTopLevel)
    if (unitIdFromUrl) {
      const u = units.find(x => x.unit_id === unitIdFromUrl)
      if (u) {
        const rootUid = u.parent_id || u.unit_id
        const ri = tops.findIndex(t => t.unit_id === rootUid)
        if (ri >= 0) {
          setChapterIdx(ri)
          // If it's a section (not the chapter itself), set initialSectionId
          if (u.parent_id) setInitialSectionId(unitIdFromUrl)
          return
        }
      }
    }
    setChapterIdx(0)
  }, [initialData.structure, unitIdFromUrl])

  // Lock scroll-spy so the IntersectionObserver cannot overwrite activeSectionId
  // during our scroll animation or while async content is loading above the target.
  const lockSpy = useCallback((ms: number) => {
    spyLockedRef.current = true
    clearTimeout(spyTimerRef.current)
    spyTimerRef.current = setTimeout(() => { spyLockedRef.current = false }, ms)
  }, [])

  // Scroll a section to ~25% down the content pane using direct
  // position calculation — more reliable than scrollIntoView which
  // can scroll the wrong container on some browsers/OS combinations.
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById('sec-' + sectionId)
    const c  = contentRef.current
    if (!el || !c) return
    lockSpy(2500)

    const getTarget = () => {
      const elRect = el.getBoundingClientRect()
      const cRect  = c.getBoundingClientRect()
      return Math.max(0, c.scrollTop + (elRect.top - cRect.top) - c.clientHeight * 0.4)
    }

    c.scrollTo({ top: getTarget(), behavior: 'smooth' })

    // Wait for smooth animation to finish before watching for image shifts
    let debounce: ReturnType<typeof setTimeout>
    let started = false
    const ro = new ResizeObserver(() => {
      if (!started) return
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        c.scrollTo({ top: getTarget(), behavior: 'instant' as ScrollBehavior })
      }, 100)
    })
    const startTimer = setTimeout(() => { started = true; ro.observe(c) }, 400)
    const kill = setTimeout(() => { ro.disconnect(); clearTimeout(debounce) }, 5000)
    const mo = new MutationObserver(() => {
      if (!document.contains(el)) {
        ro.disconnect(); clearTimeout(debounce); clearTimeout(startTimer)
        clearTimeout(kill); mo.disconnect()
        clearTimeout(spyTimerRef.current); spyLockedRef.current = false
      }
    })
    mo.observe(document.body, { childList: true, subtree: false })
  }, [lockSpy])

  const goTo = useCallback((idx: number, sectionId?: string) => {
    if (idx < 0 || idx >= chapters.length) return
    const chapterChanged = idx !== chapterIdx
    setChapterIdx(idx)
    setInitialSectionId(sectionId || null)
    if (sectionId) { setActiveSectionId(sectionId); lockSpy(2500) }
    else setActiveSectionId(null)
    if (chapterChanged) {
      // Always reset to top when changing chapters — scroll container preserves
      // its scrollTop across React re-renders so we must reset it explicitly.
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    } else if (sectionId) {
      scrollToSection(sectionId)
      setInitialSectionId(null)
    } else {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    const uid = sectionId || chapters[idx]?.unit_id
    if (uid) window.history.replaceState(null, '', `/report/${productId}?unit=${uid}`)
    if (window.innerWidth < 768) setTocOpen(false)
  }, [chapters, chapterIdx, productId, scrollToSection, lockSpy])

  // Wire global nav callback so inline ref links can navigate chapters
  useEffect(() => {
    const nav = (uid: string) => {
      // First try: exact unit_id match
      const unit = flatUnits.find(u => u.unit_id === uid)
      if (unit) {
        const rootUid = unit.parent_id || unit.unit_id
        const idx = chapters.findIndex(ch => ch.unit_id === rootUid)
        if (idx >= 0) { goTo(idx, uid !== rootUid ? uid : undefined); return }
      }
      // Second try: uid is a block_id like SEC12-L001 — extract unit by stripping block suffix
      // Block IDs follow pattern: {unit_id}-{BLOCKTYPE}{NNN}
      // Strip last segment (e.g. -L001, -P002, -T001) to get unit_id
      const unitFromBlock = uid.replace(/-[A-Z]+\d+$/, '')
      if (unitFromBlock !== uid) {
        const u2 = flatUnits.find(u => u.unit_id === unitFromBlock)
        if (u2) {
          const rootUid = u2.parent_id || u2.unit_id
          const idx = chapters.findIndex(ch => ch.unit_id === rootUid)
          if (idx >= 0) { goTo(idx, u2.unit_id !== rootUid ? u2.unit_id : undefined); return }
        }
      }
      // Fallback: chapter that contains uid as prefix
      const chIdx = chapters.findIndex(ch => {
        const allDesc = [ch.unit_id, ...getDescendantUids(ch.unit_id, flatUnits)]
        return allDesc.some(duid => uid.startsWith(duid))
      })
      if (chIdx >= 0) goTo(chIdx)
    }
    setNavCallback(nav)
    ;(window as unknown as Record<string,unknown>).__cagNav = nav
  }, [flatUnits, chapters, goTo])

  // Update fn/annotation indexes when chapter changes
  useEffect(() => {
    const cur = chapters[chapterIdx]
    if (!cur || flatUnits.length === 0) return
    const allDesc = getDescendantUids(cur.unit_id, flatUnits)
    setFnIndex(buildFnIndexForChapter(cur.unit_id, allDesc))
    const chapterUids = [cur.unit_id, ...allDesc]
    const annIdx: Record<string, {annotation_id:string;annotation_type:string;start:number;end:number;lang?:string;source?:string;reviewed?:boolean}[]> = {}
    chapterUids.forEach(uid => {
      ;(initialData.blocks[uid] || []).forEach(block => {
        if (block.annotations?.length) annIdx[block.block_id] = block.annotations as {annotation_id:string;annotation_type:string;start:number;end:number;lang?:string;source?:string;reviewed?:boolean}[]
      })
    })
    setAnnIndex(annIdx)

    // Build reference index: block_id → references[]
    const refIdx: Record<string, {type:string;target:string;target_format:string;label?:Record<string,string>|string;relationship_type?:string}[]> = {}
    chapterUids.forEach(uid => {
      ;(initialData.blocks[uid] || []).forEach(block => {
        const refs = (block as unknown as Record<string,unknown>).references as {type:string;target:string;target_format:string;label?:Record<string,string>|string;relationship_type?:string}[] | undefined
        if (refs?.length) refIdx[block.block_id] = refs
      })
    })
    setRefIndex(refIdx)
    setBlockVersion(v => v + 1)  // trigger re-render so blocks show refs
  }, [chapterIdx, chapters, flatUnits, initialData.blocks])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') goTo(chapterIdx + 1)
      if (e.key === 'ArrowLeft')  goTo(chapterIdx - 1)
      if (e.key === 'Escape' && readerMode) toggleReaderMode()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [chapterIdx, goTo, readerMode])

  // Lock the outer page scroll for the entire lifetime of the reader.
  // The reader fills the viewport exactly — the outer body scroll and the
  // site footer must not be reachable, otherwise two independent scrollbars
  // exist and elements get hidden behind/below the reader.
  useEffect(() => {
    document.documentElement.classList.add('reader-active')
    return () => document.documentElement.classList.remove('reader-active')
  }, [])

  // Measure the site header height and keep --site-header-h CSS variable
  // current. ResizeObserver fires immediately on mount and whenever the
  // header resizes (including when reader mode hides it → height becomes 0).
  // All fixed positioning in the reader uses var(--site-header-h) so nothing
  // needs to know the pixel value explicitly.
  useEffect(() => {
    const header = document.querySelector('header[role="banner"]') as HTMLElement | null
    if (!header) return
    const update = () => {
      const h = header.getBoundingClientRect().height
      document.documentElement.style.setProperty('--site-header-h', `${h}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => { document.documentElement.classList.remove('reader-fullscreen') }
  }, [])

  // Hooks must all come before any conditional return
  const current = useMemo(() => chapters[chapterIdx], [chapters, chapterIdx])
  const sections = useMemo(() => current ? getSections(current.unit_id, flatUnits) : [], [current, flatUnits])
  const reportTitle = useMemo(() => ml(initialData.metadata?.common?.title) || productId, [initialData.metadata, productId])
  const hasPrev = chapterIdx > 0
  const hasNext = chapterIdx < chapters.length - 1

  // ── Scroll-spy: update activeSectionId as user scrolls ───────
  useEffect(() => {
    if (!contentRef.current || sections.length === 0) {
      setActiveSectionId(null)
      return
    }
    const root = contentRef.current
    // Read the scroll margin from the CSS variable so it stays in sync
    // with --reader-scroll-margin without any hardcoded pixel here.
    const scrollMargin = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--reader-scroll-margin')
    ) || 56
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        if (spyLockedRef.current) return  // locked during TOC-scroll — prevents flip
        entries.forEach(entry => {
          const uid = entry.target.getAttribute('data-sec-id')
          if (!uid) return
          if (entry.isIntersecting) {
            visible.set(uid, entry.boundingClientRect.top)
          } else {
            visible.delete(uid)
          }
        })
        if (visible.size === 0) return
        const topmost = Array.from(visible.entries()).sort((a, b) => a[1] - b[1])[0]
        if (topmost) setActiveSectionId(topmost[0])
      },
      { root, rootMargin: `-${scrollMargin}px 0px -60% 0px`, threshold: 0 }
    )
    sections.forEach(sec => {
      const el = root.querySelector(`[data-sec-id="${sec.unit_id}"]`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections, chapterIdx])

  // Auto-scroll TOC to keep active section visible
  useEffect(() => {
    if (!activeSectionId) return
    const el = document.getElementById(`toc-${activeSectionId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeSectionId])

  // fn/annotation indexes are updated via useEffect (below)

  if (flatUnits.length === 0) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',fontFamily:'system-ui',color:'#999',fontSize:'13px'}}>
      Loading…
    </div>
  )

  // ── Main ────────────────────────────────────────────────────
  // Three-row flex column: nav bar | scrollable content | prev/next footer
  // All three are always visible — no position:fixed needed anywhere.
  // flex layout handles this cleanly on both desktop and mobile.
  return (
    <div style={{display:'flex', height: readerMode ? '100dvh' : 'calc(100dvh - var(--site-header-h))', minHeight:'-webkit-fill-available', overflow:'hidden', transition:'height .25s ease'}} className="reader-root">

      {/* ── TOC ─────────────────────────────────── */}
      {tocOpen && isMobile && (
        <div onClick={()=>setTocOpen(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.35)',zIndex:40}}/>
      )}
      <aside
        className={tocOpen ? 'toc-open' : 'toc-closed'}
        style={{
          flexShrink: 0, overflow: 'hidden',
          borderRight: '1px solid #d4d0ca', background: '#f9f8f6',
          display: 'flex', flexDirection: 'column',
        }}>
        <div style={{padding:'12px 16px 8px',borderBottom:'1px solid #e4e0d8',flexShrink:0}}>
          <span style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,letterSpacing:'1.3px',textTransform:'uppercase',color:'#999'}}>
            Contents
          </span>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'4px 0 24px'}}>
          {flatUnits.length > 0 && (
            <TOCPanel flatUnits={flatUnits} chapters={chapters} currentIdx={chapterIdx} activeSectionId={activeSectionId} onNavigate={goTo}/>
          )}
        </div>
      </aside>

      {/* ── Main column: 3-row flex ──────────────── */}
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden'}}>

        {/* Row 1: Nav bar — flexShrink:0, never scrolls */}
        <div style={{
          height:'var(--reader-nav-h)', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 10px', gap:'6px',
          borderBottom:'1px solid #d4d0ca', background:'#f9f8f6',
          zIndex:10,
        }}>

          {/* Left: Back button + TOC toggle + chapter title */}
          <div style={{display:'flex',alignItems:'center',gap:'4px',minWidth:0,flex:1}}>
            {/* Back to report landing page */}
            <a href={`/report/${productId}`}
              title="Back to report"
              style={{
                display:'flex', alignItems:'center', gap:'4px',
                padding:'4px 8px', borderRadius:'5px', flexShrink:0,
                fontFamily:'system-ui', fontSize:'11px', fontWeight:600,
                color:'var(--navy)', background:'var(--navy-lt)',
                textDecoration:'none', border:'1px solid rgba(26,58,107,.15)',
              }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              <span className="hidden sm:inline">Report</span>
            </a>
            <button onClick={()=>setTocOpen(v=>!v)}
              title="Toggle contents"
              style={{padding:'5px',border:'none',background:'none',cursor:'pointer',color:'#888',borderRadius:'4px',flexShrink:0}}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            {current && (
              <span style={{fontFamily:'system-ui',fontSize:'11.5px',fontWeight:600,color:'#444',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {ml(current.title)||current.unit_id}
              </span>
            )}
          </div>

          {/* Centre: Prev · counter · Next */}
          <div style={{display:'flex',alignItems:'center',gap:'4px',flexShrink:0}}>
            <button onClick={()=>goTo(chapterIdx-1)} disabled={!hasPrev}
              title="Previous"
              style={{display:'flex',alignItems:'center',padding:'5px 8px',border:'none',background:'none',cursor:hasPrev?'pointer':'default',color:'#666',opacity:hasPrev?1:.3,borderRadius:'4px'}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'11px',color:'#999',minWidth:'32px',textAlign:'center'}}>{chapterIdx+1}/{chapters.length}</span>
            <button onClick={()=>goTo(chapterIdx+1)} disabled={!hasNext}
              title="Next"
              style={{display:'flex',alignItems:'center',padding:'5px 8px',border:'none',background:'none',cursor:hasNext?'pointer':'default',color:'#666',opacity:hasNext?1:.3,borderRadius:'4px'}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          {/* Right: Reader mode + Annotations */}
          <div style={{display:'flex',alignItems:'center',gap:'4px',flexShrink:0}}>
            {/* Reader mode toggle */}
            <button
              onClick={toggleReaderMode}
              title={readerMode ? 'Exit reader mode (Esc)' : 'Reader mode — focus view, larger text'}
              style={{
                display:'flex',alignItems:'center',gap:'4px',
                padding:'3px 8px', border:'1px solid', borderRadius:'12px',
                fontFamily:'system-ui', fontSize:'11px', fontWeight:600,
                cursor:'pointer', transition:'all .15s',
                borderColor: readerMode ? '#1a3a6b' : '#ccc',
                background: readerMode ? '#edf1f8' : 'transparent',
                color: readerMode ? '#1a3a6b' : '#aaa',
              }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              <span className="hidden sm:inline">Read</span>
            </button>
            {/* Annotations toggle */}
            <button
              onClick={toggleAnnotations}
              title={annVisible ? 'Hide annotations' : 'Show annotations'}
              style={{
                display:'flex',alignItems:'center',gap:'4px',
                padding:'3px 8px', border:'1px solid', borderRadius:'12px',
                fontFamily:'system-ui', fontSize:'11px', fontWeight:600,
                cursor:'pointer', transition:'all .15s',
                borderColor: annVisible ? '#c47a20' : '#ccc',
                background: annVisible ? '#fdf4e7' : 'transparent',
                color: annVisible ? '#c47a20' : '#aaa',
              }}>
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/></svg>
              <span className="hidden sm:inline">Ann.</span>
            </button>
          </div>
        </div>

        {/* Row 2: Content — flex:1, scrolls */}
        <div ref={contentRef} style={{flex:'1 1 0',overflowY:'auto',background:'#edeae4',minHeight:0,overscrollBehavior:'contain'}}>
          {current && (
            <ChapterPage
              key={current.unit_id}
              unit={current} sections={sections} flatUnits={flatUnits}
              unitFiles={initialData.unitFiles} blocks={initialData.blocks}
              prev={chapters[chapterIdx-1]} next={chapters[chapterIdx+1]}
              onNavigate={goTo} chapterIdx={chapterIdx} readerMode={readerMode}
              blockVersion={blockVersion}
              initialSectionId={initialSectionId}
              scrollContainer={contentRef}
            />
          )}
        </div>

      </div>
    </div>
  )
}

// ── Chapter page ──────────────────────────────────────────────
function ChapterPage({ unit, sections, flatUnits, unitFiles, blocks, prev, next, onNavigate, chapterIdx, readerMode, blockVersion, initialSectionId, scrollContainer }: {
  unit: FlatUnit; sections: FlatUnit[]; flatUnits: FlatUnit[]
  unitFiles: Record<string,ContentUnit>; blocks: Record<string,ContentBlock[]>
  prev?: FlatUnit; next?: FlatUnit
  onNavigate: (i:number, sid?:string)=>void; chapterIdx: number; readerMode?: boolean; blockVersion?: number
  initialSectionId?: string | null
  scrollContainer: React.RefObject<HTMLDivElement>
}) {

  // ── Scroll to initial section after this chapter renders ──────
  // useEffect fires AFTER React commits the DOM — getElementById is guaranteed.
  // BUT images above the target section may not be loaded yet, causing layout
  // shifts that push the section down after the initial scroll.
  // Fix: scroll immediately, then watch for layout changes via ResizeObserver
  // and re-anchor until the position is stable. Killed after 5s.
  useEffect(() => {
    if (!initialSectionId) return
    const el = document.getElementById('sec-' + initialSectionId)
    const c  = scrollContainer.current
    if (!el || !c) return

    const getTarget = () => {
      const elRect = el.getBoundingClientRect()
      const cRect  = c.getBoundingClientRect()
      return Math.max(0, c.scrollTop + (elRect.top - cRect.top) - c.clientHeight * 0.4)
    }

    // Initial scroll — smooth so it feels intentional
    c.scrollTo({ top: getTarget(), behavior: 'smooth' })

    // After smooth scroll settles (~350ms), watch for image load shifts
    // and re-anchor with instant scroll so we don't fight the animation
    let debounce: ReturnType<typeof setTimeout>
    let started = false
    const ro = new ResizeObserver(() => {
      if (!started) return   // ignore shifts during the smooth animation
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        c.scrollTo({ top: getTarget(), behavior: 'instant' as ScrollBehavior })
      }, 100)
    })
    const startTimer = setTimeout(() => { started = true; ro.observe(c) }, 400)
    const kill = setTimeout(() => { ro.disconnect(); clearTimeout(debounce) }, 5000)
    return () => {
      ro.disconnect()
      clearTimeout(debounce); clearTimeout(startTimer); clearTimeout(kill)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSectionId])
  const uid    = unit.unit_id
  const uFile  = unitFiles[uid] || unit
  const title  = ml(uFile.title || unit.title)
  const execSum = ml(uFile.executive_summary)
  const isChap = unit.unit_type === 'chapter'
  const meta   = uFile.metadata
  // AFC:
  // - Section level: read directly from section's own metadata (manually set in builder)
  // - Chapter level: aggregate from all descendant sections, sorted by
  //   decreasing frequency of occurrence, show top 5
  let afcCats: string[]
  if (isChap && sections.length > 0) {
    const freq: Record<string, number> = {}
    sections.forEach(sec => {
      const secFile = unitFiles[sec.unit_id] || sec
      const secAfc = (secFile.metadata?.audit_findings_categories || []) as string[]
      secAfc.forEach(cat => { freq[cat] = (freq[cat] || 0) + 1 })
    })
    // Sort by frequency descending, then alphabetically for ties
    afcCats = Object.entries(freq)
      .sort(([a, fa], [b, fb]) => fb - fa || a.localeCompare(b))
      .map(([cat]) => cat)
      .slice(0, 5)
  } else {
    // Section: use own metadata directly
    afcCats = (meta?.audit_findings_categories || []) as string[]
  }

  let chNum = uFile.para_number || unit.para_number || ''
  if (!chNum && title) { const m = title.match(/Chapter\s+(\d+)/i); if (m) chNum = `Chapter ${m[1]}` }

  // Collect footnotes from this unit + ALL descendants at any depth
  const descendantUids = getDescendantUids(uid, flatUnits)
  const fnotes = collectChapterFn(uid, descendantUids)

  return (
    <div style={{padding:'0'}}>
      {/* Paper */}
      <div
        className={readerMode ? 'reader-mode' : ''}
        style={{
          maxWidth: readerMode ? '900px' : '800px', margin:'0 auto',
          background:'#fff',
          borderLeft:'1px solid #d8d4ce', borderRight:'1px solid #d8d4ce',
          transition: 'max-width .3s ease',
        }}>
        <div className="reader-paper" style={{padding:'52px 68px 56px'}}>

          {/* Header */}
          <div style={{borderBottom:'2.5px solid #1a3a6b',paddingBottom:'18px',marginBottom:'24px'}}>
            {chNum && (
              <div style={{fontFamily:'system-ui',fontSize:'10.5px',fontWeight:700,letterSpacing:'1.6px',textTransform:'uppercase',color:'#c47a20',marginBottom:'7px'}}>
                {chNum}
              </div>
            )}
            {title && (
              <h1 style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:'27px',fontWeight:700,color:'#1a3a6b',lineHeight:1.22,margin:0}}>
                {title}
              </h1>
            )}
            {afcCats.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginTop:'12px'}}>
                {afcCats.map(cat=>(
                  <span key={cat} style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:'#edf1f8',color:'#1a3a6b',border:'1px solid #c5d5ee'}}>
                    {afcLabel(cat)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {execSum && (
            <p style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:'15.5px',color:'#555',fontStyle:'italic',margin:'0 0 24px',paddingLeft:'16px',borderLeft:'3px solid #d8d4ce',textAlign:'justify',lineHeight:1.7}}>
              {execSum}
            </p>
          )}

          <UnitBlocks uid={uid} blocks={blocks} blockVersion={blockVersion}/>

          {sections.map(sec=>(
            <SectionBlock key={sec.unit_id} unit={sec} flatUnits={flatUnits} unitFiles={unitFiles} blocks={blocks} depth={1} blockVersion={blockVersion}/>
          ))}

          {fnotes.length > 0 && <FnList footnotes={fnotes}/>}

          {/* Prev/Next — at the end of the chapter content, inside the paper */}
          {(prev || next) && (
            <div style={{marginTop:'48px',paddingTop:'20px',borderTop:'1px solid #e4e0d8',display:'flex',gap:'10px'}}>
              {prev ? <NavBtn unit={prev} dir="prev" onClick={()=>onNavigate(chapterIdx-1)}/> : <div style={{flex:1}}/>}
              {next ? <NavBtn unit={next} dir="next" onClick={()=>onNavigate(chapterIdx+1)}/> : <div style={{flex:1}}/>}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────
function SectionBlock({ unit, flatUnits, unitFiles, blocks, depth = 1, blockVersion }: {
  unit: FlatUnit; flatUnits: FlatUnit[]
  unitFiles: Record<string,ContentUnit>; blocks: Record<string,ContentBlock[]>
  depth?: number; blockVersion?: number
}) {
  const uid    = unit.unit_id
  const uFile  = unitFiles[uid] || unit
  const title  = ml(uFile.title || unit.title)
  const secNum = uFile.para_number || unit.para_number || ''
  const meta   = uFile.metadata
  const afc    = meta?.audit_findings_categories || []

  // Children of this section (sub-sections), sorted by seq
  const children = getSections(uid, flatUnits)

  // Title size scales with depth: depth 1 = section, depth 2 = sub-section etc.
  const titleSize = depth === 1 ? '20px' : depth === 2 ? '17px' : '15px'
  const borderStyle = depth === 1 ? '1px solid #e8e4dc' : '1px solid #f0ece4'
  const topMargin = depth === 1 ? '40px' : '28px'

  return (
    <div id={`sec-${uid}`} data-sec-id={uid} style={{marginTop:topMargin}}>
      {(secNum || title) && (
        <div style={{display:'flex',alignItems:'baseline',gap:'10px',marginBottom:'12px',paddingBottom:'8px',borderBottom:borderStyle}}>
          {secNum && (
            <span style={{fontFamily:'system-ui',fontSize: depth===1?'13px':'12px',fontWeight:700,color:'#c47a20',flexShrink:0}}>
              {secNum}
            </span>
          )}
          {title && (
            <span style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:titleSize,fontWeight:700,color:'#1a1a1a',lineHeight:1.25}}>
              {title}
            </span>
          )}
        </div>
      )}
      {afc.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'12px'}}>
          {afc.map(cat=>(
            <span key={cat} style={{fontFamily:'system-ui',fontSize:'9.5px',fontWeight:600,padding:'2px 7px',borderRadius:'10px',background:'#f0f4fa',color:'#1a3a6b',border:'1px solid #d0ddf0'}}>
              {afcLabel(cat)}
            </span>
          ))}
        </div>
      )}
      <UnitBlocks uid={uid} blocks={blocks} blockVersion={blockVersion}/>
      {/* Render children recursively */}
      {children.map(child=>(
        <SectionBlock key={child.unit_id} unit={child} flatUnits={flatUnits} unitFiles={unitFiles} blocks={blocks} depth={depth+1} blockVersion={blockVersion}/>
      ))}
    </div>
  )
}

function UnitBlocks({ uid, blocks, blockVersion }: { uid:string; blocks:Record<string,ContentBlock[]>; blockVersion?: number }) {
  const sorted = (blocks[uid]||[]).slice().sort((a,b)=>(a.seq||0)-(b.seq||0))
  return <>{sorted.map(b=><BlockRenderer key={b.block_id+'-'+(blockVersion||0)} block={b}/>)}</>
}

// ── Footnote list ─────────────────────────────────────────────
function FnList({ footnotes }: { footnotes: Fn[] }) {
  return (
    <div style={{marginTop:'40px',paddingTop:'16px',borderTop:'1px solid #d4d0ca'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#bbb',marginBottom:'10px'}}>
        Footnotes
      </div>
      {footnotes.map((fn,i)=>{
        const text = typeof fn.text==='string'?fn.text:(fn.text as Record<string,string>)?.en||Object.values(fn.text||{})[0] as string||''
        const fnId = `fn-${fn.footnote_id||fn.marker}`
        return (
          <div key={i} id={fnId} style={{display:'flex',gap:'10px',marginBottom:'8px',lineHeight:1.65}}>
            <a
               onClick={e=>{e.preventDefault();const el=document.getElementById(`fnref-${fn.footnote_id||fn.marker}`);if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}}
               style={{color:'#8b1a1a',fontWeight:700,flexShrink:0,fontFamily:'system-ui',fontSize:'13px',marginTop:'1px',textDecoration:'none',minWidth:'18px',cursor:'pointer'}}>
              {fn.marker}
            </a>
            <span style={{color:'#444',textAlign:'justify',display:'block',flex:1,fontFamily:'Georgia,"Times New Roman",serif',fontSize:'14px'}}>{text}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Nav button ────────────────────────────────────────────────
function NavBtn({ unit, dir, onClick }: { unit:FlatUnit; dir:'prev'|'next'; onClick:()=>void }) {
  const isPrev = dir==='prev'
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:'10px',padding:'11px 14px',
      borderRadius:'8px',border:'1px solid #d4d0ca',background:'#f9f8f6',
      cursor:'pointer',width:'100%',
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='#1a3a6b'}}
    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='#d4d0ca'}}>
      {isPrev&&<svg width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m15 18-6-6 6-6"/></svg>}
      <div style={{flex:1,minWidth:0,textAlign:isPrev?'left':'right'}}>
        <div style={{fontFamily:'system-ui',fontSize:'9.5px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'#bbb',marginBottom:'3px'}}>
          {isPrev?'← Previous':'Next →'}
        </div>
        <div style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:'14px',fontWeight:600,color:'#333',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
          {ml(unit.title)||unit.unit_id}
        </div>
      </div>
      {!isPrev&&<svg width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m9 18 6-6-6-6"/></svg>}
    </button>
  )
}

// ── TOC ───────────────────────────────────────────────────────
function TOCPanel({ flatUnits, chapters, currentIdx, activeSectionId, onNavigate }: {
  flatUnits: FlatUnit[]; chapters: FlatUnit[]
  currentIdx: number; activeSectionId: string | null
  onNavigate: (i:number, sid?:string)=>void
}) {
  const frontMatter  = chapters.filter(u=>['preface','executive_summary'].includes(u.unit_type))
  const chaptersList = chapters.filter(u=>u.unit_type==='chapter')
  const backMatter   = chapters.filter(u=>['appendix','annexure'].includes(u.unit_type))
  // Orphan sections — no parent_id, type=section (e.g. SEC18 signature block)
  const orphanSecs   = chapters.filter(u=>u.unit_type==='section')

  function Group({ label, items }: { label:string; items:FlatUnit[] }) {
    if (!items.length) return null
    return (
      <div>
        <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1.6px',textTransform:'uppercase',color:'#bbb',padding:'12px 16px 4px'}}>
          {label}
        </div>
        {items.map(ch=>{
          const idx = chapters.findIndex(c=>c.unit_id===ch.unit_id)
          const isActive = idx===currentIdx
          const secs = getSections(ch.unit_id, flatUnits)
          return (
            <div key={ch.unit_id}>
              <button onClick={()=>onNavigate(idx)} style={{
                width:'100%',textAlign:'left',display:'block',
                padding:'7px 16px',fontFamily:'system-ui',fontSize:'12.5px',fontWeight:600,
                border:'none',outline:'none',
                borderLeft:`3px solid ${isActive?'#c47a20':'transparent'}`,
                background:isActive?'#edf1f8':'transparent',
                color:isActive?'#1a3a6b':'#222',
                cursor:'pointer',lineHeight:1.4,
              }}>
                {ml(ch.title)||ch.unit_id}
              </button>
              {/* Sections — always visible, rendered recursively */}
              {secs.map(sec=>(
                <TOCSectionItem key={sec.unit_id} sec={sec} flatUnits={flatUnits} idx={idx} isChapterActive={isActive} activeSectionId={activeSectionId} onNavigate={onNavigate} indentLevel={1}/>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Group label="Front matter" items={frontMatter}/>
      <Group label="Chapters & sections" items={chaptersList}/>
      {orphanSecs.length>0&&<Group label="Other" items={orphanSecs}/>}
      <Group label="Back matter" items={backMatter}/>
    </>
  )
}

function TOCSectionItem({ sec, flatUnits, idx, isChapterActive, activeSectionId, onNavigate, indentLevel }: {
  sec: FlatUnit; flatUnits: FlatUnit[]; idx: number
  isChapterActive: boolean; activeSectionId: string | null
  onNavigate:(i:number,sid?:string)=>void; indentLevel: number
}) {
  const children = getSections(sec.unit_id, flatUnits)
  const leftPad = 16 + indentLevel * 12
  const fontSize = indentLevel === 1 ? '11px' : '10.5px'
  const isActiveSection = activeSectionId === sec.unit_id
  return (
    <>
      <button id={`toc-${sec.unit_id}`} onClick={()=>onNavigate(idx, sec.unit_id)} style={{
        width:'100%', textAlign:'left',
        display:'flex', alignItems:'baseline', gap:'5px',
        padding:`3px 16px 3px ${leftPad}px`,
        fontFamily:'system-ui', fontSize,
        fontWeight: isActiveSection ? 600 : 400,
        border:'none', outline:'none',
        borderLeft:`3px solid ${isActiveSection?'#c47a20':isChapterActive?'#e4e0d8':'transparent'}`,
        background: isActiveSection ? '#edf1f8' : 'transparent',
        color: isActiveSection ? '#1a3a6b' : isChapterActive ? '#555' : '#aaa',
        cursor:'pointer', lineHeight:1.5,
        wordBreak:'break-word', whiteSpace:'normal',
      }}>
        {sec.para_number && (
          <span style={{color:'#c47a20',fontSize:'10px',fontWeight:600,flexShrink:0}}>{sec.para_number}</span>
        )}
        <span style={{wordBreak:'break-word',whiteSpace:'normal'}}>
          {ml(sec.title)||sec.unit_id}
        </span>
      </button>
      {children.map(child=>(
        <TOCSectionItem key={child.unit_id} sec={child} flatUnits={flatUnits} idx={idx} isChapterActive={isChapterActive} activeSectionId={activeSectionId} onNavigate={onNavigate} indentLevel={indentLevel+1}/>
      ))}
    </>
  )
}
