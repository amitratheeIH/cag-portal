'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ml, buildFlatUnitList, type FlatUnit, type ContentUnit, type ContentBlock, type ReportStructure } from '@/types'
import { BlockRenderer, setFolderPath, setFnIndex, setInlineFnText } from '@/components/blocks/BlockRenderer'

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
  useMemo(() => {
    if (folderPath) setFolderPath(folderPath)
    if (initialData.footnotes) setFootnotes(initialData.footnotes)
  }, [folderPath, initialData.footnotes])

  const [flatUnits, setFlatUnits] = useState<FlatUnit[]>([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

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
        if (ri >= 0) { setChapterIdx(ri); return }
      }
    }
    setChapterIdx(0)
  }, [initialData.structure, unitIdFromUrl])

  const goTo = useCallback((idx: number, sectionId?: string) => {
    if (idx < 0 || idx >= chapters.length) return
    const chapterChanged = idx !== chapterIdx
    setChapterIdx(idx)
    setActiveSectionId(sectionId || null)
    if (chapterChanged) {
      // Navigating to a new chapter — scroll to top smoothly
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      if (sectionId) {
        // After chapter renders, scroll to the section
        setTimeout(() => {
          const el = document.getElementById(`sec-${sectionId}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 350)
      }
    } else if (sectionId) {
      // Same chapter — just scroll to section
      const el = document.getElementById(`sec-${sectionId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      // Same chapter, no section — scroll to top
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    const uid = sectionId || chapters[idx]?.unit_id
    if (uid) window.history.replaceState(null, '', `/report/${productId}?unit=${uid}`)
  }, [chapters, chapterIdx, productId])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') goTo(chapterIdx + 1)
      if (e.key === 'ArrowLeft')  goTo(chapterIdx - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [chapterIdx, goTo])

  if (flatUnits.length === 0) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',fontFamily:'system-ui',color:'#999',fontSize:'13px'}}>
      Loading…
    </div>
  )

  const current = chapters[chapterIdx]
  const sections = current ? getSections(current.unit_id, flatUnits) : []
  const reportTitle = ml(initialData.metadata?.common?.title) || productId
  const hasPrev = chapterIdx > 0
  const hasNext = chapterIdx < chapters.length - 1

  // Build footnote index for BlockRenderer BEFORE rendering blocks
  // Use ALL descendants so footnotes in deeply nested units work
  if (current) {
    const allDesc = getDescendantUids(current.unit_id, flatUnits)
    const fnIdx = buildFnIndexForChapter(current.unit_id, allDesc)
    setFnIndex(fnIdx)
  }

  return (
    <div style={{display:'flex', height:'calc(100vh - 64px)', overflow:'hidden'}}>

      {/* ── TOC ─────────────────────────────────── */}
      <aside style={{
        width: tocOpen ? '268px' : '0',
        flexShrink:0, transition:'width .2s', overflow:'hidden',
        borderRight:'1px solid #d4d0ca', background:'#f9f8f6',
        display:'flex', flexDirection:'column',
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

      {/* ── Main ────────────────────────────────── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>

        {/* Nav bar */}
        <div style={{
          height:'44px', flexShrink:0, display:'flex',
          alignItems:'center', justifyContent:'space-between',
          padding:'0 18px', borderBottom:'1px solid #d4d0ca', background:'#f9f8f6',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0,flex:1}}>
            <button onClick={()=>setTocOpen(v=>!v)}
              style={{padding:'5px',border:'none',background:'none',cursor:'pointer',color:'#888',borderRadius:'4px',flexShrink:0}}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'11px',color:'#aaa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {reportTitle}
            </span>
            {current && <>
              <span style={{color:'#ddd',flexShrink:0}}>›</span>
              <span style={{fontFamily:'system-ui',fontSize:'11px',color:'#555',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {ml(current.title)||current.unit_id}
              </span>
            </>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
            <button onClick={()=>goTo(chapterIdx-1)} disabled={!hasPrev}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 11px',fontFamily:'system-ui',fontSize:'12px',fontWeight:500,border:'1px solid #ccc',borderRadius:'20px',background:'#fff',cursor:hasPrev?'pointer':'default',color:'#444',opacity:hasPrev?1:.3}}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>Prev
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'11px',color:'#ccc'}}>{chapterIdx+1}/{chapters.length}</span>
            <button onClick={()=>goTo(chapterIdx+1)} disabled={!hasNext}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 11px',fontFamily:'system-ui',fontSize:'12px',fontWeight:500,border:'1px solid #ccc',borderRadius:'20px',background:'#fff',cursor:hasNext?'pointer':'default',color:'#444',opacity:hasNext?1:.3}}>
              Next<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Content — flex:1 + overflow:auto = exactly fills remaining space */}
        <div ref={contentRef} style={{flex:1,overflowY:'auto',background:'#edeae4',minHeight:0,scrollBehavior:'smooth'}}>
          {current && (
            <ChapterPage
              unit={current} sections={sections} flatUnits={flatUnits}
              unitFiles={initialData.unitFiles} blocks={initialData.blocks}
              prev={chapters[chapterIdx-1]} next={chapters[chapterIdx+1]}
              onNavigate={goTo} chapterIdx={chapterIdx}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chapter page ──────────────────────────────────────────────
function ChapterPage({ unit, sections, flatUnits, unitFiles, blocks, prev, next, onNavigate, chapterIdx }: {
  unit: FlatUnit; sections: FlatUnit[]; flatUnits: FlatUnit[]
  unitFiles: Record<string,ContentUnit>; blocks: Record<string,ContentBlock[]>
  prev?: FlatUnit; next?: FlatUnit
  onNavigate: (i:number, sid?:string)=>void; chapterIdx: number
}) {
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
    <div style={{padding:'0 0 48px'}}>
      {/* Paper — no minHeight, just natural flow */}
      <div style={{
        maxWidth:'800px', margin:'0 auto',
        background:'#fff',
        borderLeft:'1px solid #d8d4ce', borderRight:'1px solid #d8d4ce',
      }}>
        <div style={{padding:'52px 68px 56px'}}>

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
                    {cat.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())}
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

          <UnitBlocks uid={uid} blocks={blocks}/>

          {sections.map(sec=>(
            <SectionBlock key={sec.unit_id} unit={sec} flatUnits={flatUnits} unitFiles={unitFiles} blocks={blocks} depth={1}/>
          ))}

          {fnotes.length > 0 && <FnList footnotes={fnotes}/>}

          {/* Bottom nav — inside paper, natural flow, never overflows */}
          <div style={{marginTop:'48px',paddingTop:'20px',borderTop:'1px solid #e4e0d8',display:'flex',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'}}>
            {prev ? <NavBtn unit={prev} dir="prev" onClick={()=>onNavigate(chapterIdx-1)}/> : <div/>}
            {next ? <NavBtn unit={next} dir="next" onClick={()=>onNavigate(chapterIdx+1)}/> : <div/>}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────
function SectionBlock({ unit, flatUnits, unitFiles, blocks, depth = 1 }: {
  unit: FlatUnit; flatUnits: FlatUnit[]
  unitFiles: Record<string,ContentUnit>; blocks: Record<string,ContentBlock[]>
  depth?: number
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
    <div id={`sec-${uid}`} style={{marginTop:topMargin, scrollMarginTop:'56px'}}>
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
              {cat.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())}
            </span>
          ))}
        </div>
      )}
      <UnitBlocks uid={uid} blocks={blocks}/>
      {/* Render children recursively */}
      {children.map(child=>(
        <SectionBlock key={child.unit_id} unit={child} flatUnits={flatUnits} unitFiles={unitFiles} blocks={blocks} depth={depth+1}/>
      ))}
    </div>
  )
}

function UnitBlocks({ uid, blocks }: { uid:string; blocks:Record<string,ContentBlock[]> }) {
  const sorted = (blocks[uid]||[]).slice().sort((a,b)=>(a.seq||0)-(b.seq||0))
  return <>{sorted.map(b=><BlockRenderer key={b.block_id} block={b}/>)}</>
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
          <div key={i} id={fnId} style={{display:'flex',gap:'10px',marginBottom:'8px',lineHeight:1.65,scrollMarginTop:'30px'}}>
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
      cursor:'pointer',flex:'0 1 260px',
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='#1a3a6b'}}
    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='#d4d0ca'}}>
      {isPrev&&<svg width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m15 18-6-6 6-6"/></svg>}
      <div style={{flex:1,minWidth:0,textAlign:isPrev?'left':'right'}}>
        <div style={{fontFamily:'system-ui',fontSize:'9.5px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'#bbb',marginBottom:'3px'}}>
          {isPrev?'← Previous':'Next →'}
        </div>
        <div style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:'14px',fontWeight:600,color:'#333',lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
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
      <button onClick={()=>onNavigate(idx, sec.unit_id)} style={{
        width:'100%', textAlign:'left',
        display:'flex', alignItems:'baseline', gap:'5px',
        padding:`3px 16px 3px ${leftPad}px`,
        fontFamily:'system-ui', fontSize,
        fontWeight: isActiveSection ? 600 : 400,
        border:'none', outline:'none',
        borderLeft:`3px solid ${isActiveSection?'#c47a20':isChapterActive?'#e4e0d8':'transparent'}`,
        background: isActiveSection ? '#edf1f8' : 'transparent',
        color: isActiveSection ? '#1a3a6b' : isChapterActive ? '#555' : '#aaa',
        cursor:'pointer', lineHeight:1.4,
      }}>
        {sec.para_number && (
          <span style={{color:'#c47a20',fontSize:'10px',fontWeight:600,flexShrink:0}}>{sec.para_number}</span>
        )}
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {ml(sec.title)||sec.unit_id}
        </span>
      </button>
      {children.map(child=>(
        <TOCSectionItem key={child.unit_id} sec={child} flatUnits={flatUnits} idx={idx} isChapterActive={isChapterActive} activeSectionId={activeSectionId} onNavigate={onNavigate} indentLevel={indentLevel+1}/>
      ))}
    </>
  )
}
