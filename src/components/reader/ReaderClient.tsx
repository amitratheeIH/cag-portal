'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ml, buildFlatUnitList, type FlatUnit, type ContentUnit, type ContentBlock, type ReportStructure } from '@/types'
import { BlockRenderer, setFolderPath } from '@/components/blocks/BlockRenderer'

// ── Footnote types ────────────────────────────────────────────
interface FootnoteRecord {
  footnote_id?: string
  marker: string
  text?: Record<string,string> | string
  anchor_block_id?: string
  display_scope?: string
}

// ── Module-level state (set synchronously before render) ──────
let _fn: Record<string, FootnoteRecord[]> = {}
export function setFootnotes(fn: Record<string, unknown[]>) {
  _fn = {}
  Object.entries(fn).forEach(([uid, list]) => { _fn[uid] = list as FootnoteRecord[] })
}
function chapterFootnotes(chapterUid: string, sectionUids: string[]): FootnoteRecord[] {
  const all: FootnoteRecord[] = []
  const seen = new Set<string>()
  ;[chapterUid, ...sectionUids].forEach(uid => {
    (_fn[uid] || []).forEach(fn => {
      const key = fn.footnote_id || `${uid}-${fn.marker}`
      if (!seen.has(key)) { seen.add(key); all.push(fn) }
    })
  })
  return all.sort((a,b) => (parseInt(a.marker)||0) - (parseInt(b.marker)||0))
}

// ── Top-level unit types (one page each) ─────────────────────
const TOP_TYPES = new Set(['chapter','preface','executive_summary','appendix','annexure'])

function isTopLevel(u: FlatUnit): boolean {
  return TOP_TYPES.has(u.unit_type)
}

// Sections for a chapter — use parent_id if available, else positional
function getSections(chapter: FlatUnit, flatUnits: FlatUnit[]): FlatUnit[] {
  // Try parent_id first
  const byParent = flatUnits.filter(u => u.parent_id === chapter.unit_id && u.unit_type === 'section')
  if (byParent.length > 0) return byParent.sort((a,b) => (a.seq||0)-(b.seq||0))

  // Fallback: units between this chapter and the next top-level unit
  const chIdx = flatUnits.findIndex(u => u.unit_id === chapter.unit_id)
  const nextTopIdx = flatUnits.findIndex((u, i) => i > chIdx && isTopLevel(u))
  const end = nextTopIdx >= 0 ? nextTopIdx : flatUnits.length
  return flatUnits.slice(chIdx + 1, end).filter(u => u.unit_type === 'section')
}

// ── ReaderData type ───────────────────────────────────────────
interface ReaderData {
  structure: ReportStructure
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
  footnotes?: Record<string, unknown[]>
  metadata: { common: { title: Record<string, string>; year: number } }
}

// ── Main component ────────────────────────────────────────────
export function ReaderClient({ productId, initialData, unitIdFromUrl, folderPath }: {
  productId: string
  initialData: ReaderData
  unitIdFromUrl?: string
  folderPath?: string
}) {
  // Set module globals synchronously (useMemo runs during render)
  useMemo(() => {
    if (folderPath) setFolderPath(folderPath)
    if (initialData.footnotes) setFootnotes(initialData.footnotes)
  }, [folderPath, initialData.footnotes])

  const [flatUnits, setFlatUnits] = useState<FlatUnit[]>([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [tocOpen, setTocOpen] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  // Top-level units only — use unit_type, never parent_id check
  const chapters = useMemo(() => flatUnits.filter(isTopLevel), [flatUnits])

  useEffect(() => {
    const units = buildFlatUnitList(initialData.structure)
    setFlatUnits(units)
    const tops = units.filter(isTopLevel)
    if (unitIdFromUrl) {
      const u = units.find(u => u.unit_id === unitIdFromUrl)
      if (u) {
        // If it's a section, find its chapter
        const topUid = isTopLevel(u) ? u.unit_id : (u.parent_id || u.unit_id)
        const ri = tops.findIndex(t => t.unit_id === topUid)
        if (ri >= 0) { setChapterIdx(ri); return }
        // Fallback positional: find chapter just before this unit
        const uIdx = units.findIndex(x => x.unit_id === u.unit_id)
        let ci = 0
        tops.forEach((t, i) => {
          const tIdx = units.findIndex(x => x.unit_id === t.unit_id)
          if (tIdx <= uIdx) ci = i
        })
        setChapterIdx(ci); return
      }
    }
    setChapterIdx(0)
  }, [initialData.structure, unitIdFromUrl])

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= chapters.length) return
    setChapterIdx(idx)
    contentRef.current?.scrollTo({ top: 0 })
    const uid = chapters[idx]?.unit_id
    if (uid) window.history.replaceState(null, '', `/report/${productId}?unit=${uid}`)
  }, [chapters, productId])

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
      Loading report…
    </div>
  )

  const current    = chapters[chapterIdx]
  const sections   = current ? getSections(current, flatUnits) : []
  const reportTitle = ml(initialData.metadata?.common?.title) || productId
  const hasPrev = chapterIdx > 0
  const hasNext = chapterIdx < chapters.length - 1

  return (
    <div style={{display:'flex', height:'calc(100vh - 64px)', overflow:'hidden'}}>

      {/* ── TOC ─────────────────────────────────── */}
      <aside style={{
        width: tocOpen ? '268px' : '0',
        flexShrink: 0, transition: 'width .2s', overflow: 'hidden',
        borderRight: '1px solid #d4d0ca', background: '#f9f8f6',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{padding:'12px 16px 8px', borderBottom:'1px solid #e4e0d8', flexShrink:0}}>
          <span style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,letterSpacing:'1.3px',textTransform:'uppercase',color:'#999'}}>
            Contents
          </span>
        </div>
        <div style={{flex:1, overflowY:'auto', padding:'4px 0 24px'}}>
          {flatUnits.length > 0 && (
            <TOCPanel
              flatUnits={flatUnits}
              chapters={chapters}
              currentIdx={chapterIdx}
              onNavigate={goTo}
            />
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────── */}
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden'}}>

        {/* Nav bar — fixed height, never scrolls */}
        <div style={{
          height:'44px', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 18px', borderBottom:'1px solid #d4d0ca', background:'#f9f8f6',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0,flex:1}}>
            <button onClick={()=>setTocOpen(v=>!v)}
              style={{padding:'5px',border:'none',background:'none',cursor:'pointer',color:'#888',borderRadius:'4px',flexShrink:0}}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
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
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
              Prev
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'11px',color:'#ccc'}}>{chapterIdx+1}/{chapters.length}</span>
            <button onClick={()=>goTo(chapterIdx+1)} disabled={!hasNext}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 11px',fontFamily:'system-ui',fontSize:'12px',fontWeight:500,border:'1px solid #ccc',borderRadius:'20px',background:'#fff',cursor:hasNext?'pointer':'default',color:'#444',opacity:hasNext?1:.3}}>
              Next
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Scrollable chapter content */}
        <div ref={contentRef} style={{flex:1, overflowY:'auto', background:'#edeae4'}}>
          {current && (
            <ChapterPage
              unit={current}
              sections={sections}
              unitFiles={initialData.unitFiles}
              blocks={initialData.blocks}
              prev={chapters[chapterIdx-1]}
              next={chapters[chapterIdx+1]}
              onNavigate={goTo}
              chapterIdx={chapterIdx}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chapter page ──────────────────────────────────────────────
function ChapterPage({ unit, sections, unitFiles, blocks, prev, next, onNavigate, chapterIdx }: {
  unit: FlatUnit; sections: FlatUnit[]
  unitFiles: Record<string,ContentUnit>; blocks: Record<string,ContentBlock[]>
  prev?: FlatUnit; next?: FlatUnit
  onNavigate: (i:number) => void; chapterIdx: number
}) {
  const uid     = unit.unit_id
  const uFile   = unitFiles[uid] || unit
  const title   = ml(uFile.title || unit.title)
  const execSum = ml(uFile.executive_summary)
  const isChap  = unit.unit_type === 'chapter'
  const meta    = uFile.metadata
  const afcCats = (meta?.audit_findings_categories || []).slice(0, isChap ? 5 : undefined)

  let chNum = uFile.para_number || unit.para_number || ''
  if (!chNum && title) { const m = title.match(/Chapter\s+(\d+)/i); if (m) chNum = `Chapter ${m[1]}` }

  // Collect all footnotes for this chapter + all its sections
  const sectionUids = sections.map(s => s.unit_id)
  const fnotes = chapterFootnotes(uid, sectionUids)

  return (
    <div style={{padding:'0 0 40px'}}>
      <div style={{
        maxWidth:'800px', margin:'0 auto',
        background:'#fff',
        borderLeft:'1px solid #d8d4ce', borderRight:'1px solid #d8d4ce',
        minHeight:'calc(100vh - 108px)',
      }}>
        <div style={{padding:'52px 68px 56px'}}>

          {/* Chapter header */}
          <div style={{borderBottom:'2.5px solid #1a3a6b', paddingBottom:'18px', marginBottom:'24px'}}>
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

          {/* Exec summary */}
          {execSum && (
            <p style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:'15.5px',color:'#555',fontStyle:'italic',margin:'0 0 24px',paddingLeft:'16px',borderLeft:'3px solid #d8d4ce',textAlign:'justify',lineHeight:1.7}}>
              {execSum}
            </p>
          )}

          {/* Chapter-level blocks */}
          <UnitBlocks uid={uid} blocks={blocks}/>

          {/* All sections inline */}
          {sections.map(sec=>(
            <SectionBlock key={sec.unit_id} unit={sec} unitFiles={unitFiles} blocks={blocks}/>
          ))}

          {/* Chapter footnotes */}
          {fnotes.length > 0 && <FootnoteList footnotes={fnotes}/>}

          {/* Bottom prev/next — inside paper, always in reading flow */}
          <div style={{marginTop:'48px',paddingTop:'20px',borderTop:'1px solid #e4e0d8',display:'flex',justifyContent:'space-between',gap:'12px'}}>
            {prev ? <NavBtn unit={prev} dir="prev" onClick={()=>onNavigate(chapterIdx-1)}/> : <div/>}
            {next ? <NavBtn unit={next} dir="next" onClick={()=>onNavigate(chapterIdx+1)}/> : <div/>}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────
function SectionBlock({ unit, unitFiles, blocks }: {
  unit: FlatUnit; unitFiles: Record<string,ContentUnit>; blocks: Record<string,ContentBlock[]>
}) {
  const uid    = unit.unit_id
  const uFile  = unitFiles[uid] || unit
  const title  = ml(uFile.title || unit.title)
  const secNum = uFile.para_number || unit.para_number || ''
  const meta   = uFile.metadata
  const afc    = meta?.audit_findings_categories || []

  return (
    <div style={{marginTop:'40px'}}>
      {(secNum || title) && (
        <div style={{display:'flex',alignItems:'baseline',gap:'10px',marginBottom:'14px',paddingBottom:'9px',borderBottom:'1px solid #e8e4dc'}}>
          {secNum && (
            <span style={{fontFamily:'system-ui',fontSize:'13px',fontWeight:700,color:'#c47a20',flexShrink:0}}>
              {secNum}
            </span>
          )}
          {title && (
            <span style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:'20px',fontWeight:700,color:'#1a1a1a',lineHeight:1.25}}>
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
    </div>
  )
}

// ── Unit blocks ───────────────────────────────────────────────
function UnitBlocks({ uid, blocks }: { uid:string; blocks:Record<string,ContentBlock[]> }) {
  const sorted = (blocks[uid]||[]).slice().sort((a,b)=>(a.seq||0)-(b.seq||0))
  return <>{sorted.map(b=><BlockRenderer key={b.block_id} block={b}/>)}</>
}

// ── Footnote list ─────────────────────────────────────────────
function FootnoteList({ footnotes }: { footnotes: FootnoteRecord[] }) {
  return (
    <div style={{marginTop:'40px',paddingTop:'16px',borderTop:'1px solid #d4d0ca'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#bbb',marginBottom:'10px'}}>
        Footnotes
      </div>
      {footnotes.map((fn, i) => {
        const text = typeof fn.text==='string' ? fn.text : (fn.text as Record<string,string>)?.en || Object.values(fn.text||{})[0] as string || ''
        const fnId = fn.footnote_id || `fn-${fn.marker}`
        return (
          <div key={i} id={fnId} style={{display:'flex',gap:'8px',marginBottom:'6px',fontSize:'13px',lineHeight:1.6}}>
            <a href={`#ref-${fnId}`} style={{color:'#8b1a1a',fontWeight:700,flexShrink:0,fontFamily:'system-ui',fontSize:'11px',marginTop:'2px',textDecoration:'none',minWidth:'16px'}}>
              {fn.marker}
            </a>
            <span style={{color:'#444',textAlign:'justify',fontFamily:'Georgia,"Times New Roman",serif'}}>{text}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Nav button ────────────────────────────────────────────────
function NavBtn({ unit, dir, onClick }: { unit:FlatUnit; dir:'prev'|'next'; onClick:()=>void }) {
  const isPrev = dir==='prev'
  const title  = ml(unit.title)||unit.unit_id
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:'10px',padding:'11px 14px',
      borderRadius:'8px',border:'1px solid #d4d0ca',background:'#f9f8f6',
      cursor:'pointer',flex:'0 1 260px',
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='#1a3a6b'}}
    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='#d4d0ca'}}>
      {isPrev && <svg width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m15 18-6-6 6-6"/></svg>}
      <div style={{flex:1,minWidth:0,textAlign:isPrev?'left':'right'}}>
        <div style={{fontFamily:'system-ui',fontSize:'9.5px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'#bbb',marginBottom:'3px'}}>
          {isPrev?'← Previous':'Next →'}
        </div>
        <div style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:'14px',fontWeight:600,color:'#333',lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {title}
        </div>
      </div>
      {!isPrev && <svg width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m9 18 6-6-6-6"/></svg>}
    </button>
  )
}

// ── TOC ───────────────────────────────────────────────────────
function TOCPanel({ flatUnits, chapters, currentIdx, onNavigate }: {
  flatUnits: FlatUnit[]; chapters: FlatUnit[]
  currentIdx: number; onNavigate: (i:number)=>void
}) {
  const frontMatter  = chapters.filter(u => ['preface','executive_summary'].includes(u.unit_type))
  const chaptersList = chapters.filter(u => u.unit_type==='chapter')
  const backMatter   = chapters.filter(u => ['appendix','annexure'].includes(u.unit_type))

  function Group({ label, items }: { label:string; items:FlatUnit[] }) {
    if (!items.length) return null
    return (
      <div>
        <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1.6px',textTransform:'uppercase',color:'#bbb',padding:'12px 16px 4px'}}>
          {label}
        </div>
        {items.map(ch => {
          const idx = chapters.findIndex(c=>c.unit_id===ch.unit_id)
          const isActive = idx===currentIdx
          const secs = getSections(ch, flatUnits)
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
              {/* Sections — always shown */}
              {secs.map(sec=>(
                <button key={sec.unit_id} onClick={()=>onNavigate(idx)} style={{
                  width:'100%',textAlign:'left',
                  display:'flex',alignItems:'baseline',gap:'5px',
                  padding:'3px 16px 3px 24px',fontFamily:'system-ui',fontSize:'11px',fontWeight:400,
                  border:'none',outline:'none',
                  borderLeft:`3px solid ${isActive?'#e4e0d8':'transparent'}`,
                  background:'transparent',color:isActive?'#555':'#aaa',
                  cursor:'pointer',lineHeight:1.4,
                }}>
                  {sec.para_number && (
                    <span style={{color:'#c47a20',fontSize:'10px',fontWeight:600,flexShrink:0}}>{sec.para_number}</span>
                  )}
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {ml(sec.title)||sec.unit_id}
                  </span>
                </button>
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
      <Group label="Back matter" items={backMatter}/>
    </>
  )
}
