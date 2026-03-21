'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ml, buildFlatUnitList, type FlatUnit, type ContentUnit, type ContentBlock, type ReportStructure } from '@/types'
import { BlockRenderer, setFolderPath } from '@/components/blocks/BlockRenderer'

interface ReaderData {
  structure: ReportStructure
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
  metadata: { common: { title: Record<string, string>; year: number } }
}

export function ReaderClient({ productId, initialData, unitIdFromUrl, folderPath }: {
  productId: string; initialData: ReaderData; unitIdFromUrl?: string; folderPath?: string
}) {
  // ── Set folderPath synchronously before children render ──────
  // useMemo runs during render so _folderPath is ready before any child useEffect
  useMemo(() => { if (folderPath) setFolderPath(folderPath) }, [folderPath])

  const [flatUnits, setFlatUnits] = useState<FlatUnit[]>([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [tocOpen, setTocOpen] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  // Root-level units — one page each
  const chapters = useMemo(() => flatUnits.filter(u => !u.parent_id), [flatUnits])

  useEffect(() => {
    const units = buildFlatUnitList(initialData.structure)
    setFlatUnits(units)
    const roots = units.filter(u => !u.parent_id)
    if (unitIdFromUrl) {
      const u = units.find(u => u.unit_id === unitIdFromUrl)
      if (u) {
        const rootUid = u.parent_id || u.unit_id
        const ri = roots.findIndex(r => r.unit_id === rootUid)
        if (ri >= 0) { setChapterIdx(ri); return }
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

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') goTo(chapterIdx + 1)
      if (e.key === 'ArrowLeft')  goTo(chapterIdx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapterIdx, goTo])

  if (flatUnits.length === 0) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <div style={{fontFamily:'system-ui',fontSize:'13px',color:'#888'}}>Loading report…</div>
    </div>
  )

  const current = chapters[chapterIdx]
  const reportTitle = ml(initialData.metadata?.common?.title) || productId
  const sections = current
    ? flatUnits.filter(u => u.parent_id === current.unit_id).sort((a,b)=>(a.seq||0)-(b.seq||0))
    : []

  const hasPrev = chapterIdx > 0
  const hasNext = chapterIdx < chapters.length - 1

  return (
    <div style={{display:'flex', height:'calc(100vh - 64px)', overflow:'hidden'}}>

      {/* ── TOC ───────────────────────────────────────── */}
      <aside style={{
        width: tocOpen ? '268px' : '0',
        flexShrink:0, overflow:'hidden',
        transition:'width .2s ease',
        borderRight:'1px solid #d4d0ca',
        background:'#f9f8f6',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{padding:'12px 16px 8px', borderBottom:'1px solid #e8e4dc', flexShrink:0}}>
          <span style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,letterSpacing:'1.3px',textTransform:'uppercase',color:'#888'}}>Contents</span>
        </div>
        <div style={{flex:1, overflowY:'auto', padding:'4px 0 20px'}}>
          <TOCPanel flatUnits={flatUnits} chapters={chapters} currentIdx={chapterIdx} onNavigate={goTo}/>
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────── */}
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden'}}>

        {/* Top nav bar */}
        <div style={{
          height:'44px', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 18px', borderBottom:'1px solid #d4d0ca', background:'#f9f8f6',
          gap:'12px',
        }}>
          {/* Left: hamburger + breadcrumb */}
          <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0,flex:1}}>
            <button onClick={()=>setTocOpen(v=>!v)}
              style={{flexShrink:0,padding:'5px',border:'none',background:'none',cursor:'pointer',color:'#777',borderRadius:'4px'}}
              aria-label="Toggle contents">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'11.5px',color:'#666',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {reportTitle}
            </span>
            {current && (
              <>
                <span style={{color:'#bbb',flexShrink:0}}>›</span>
                <span style={{fontFamily:'system-ui',fontSize:'11.5px',color:'#444',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flexShrink:1}}>
                  {ml(current.title)||current.unit_id}
                </span>
              </>
            )}
          </div>

          {/* Right: prev/next */}
          <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
            <button onClick={()=>goTo(chapterIdx-1)} disabled={!hasPrev}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 11px',fontFamily:'system-ui',fontSize:'12px',fontWeight:500,
                border:'1px solid #ccc',borderRadius:'20px',background:'white',cursor:hasPrev?'pointer':'default',
                color:'#444',opacity:hasPrev?1:.35,transition:'all .12s',whiteSpace:'nowrap'}}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
              Prev
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'11px',color:'#aaa',padding:'0 2px'}}>
              {chapterIdx+1}/{chapters.length}
            </span>
            <button onClick={()=>goTo(chapterIdx+1)} disabled={!hasNext}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 11px',fontFamily:'system-ui',fontSize:'12px',fontWeight:500,
                border:'1px solid #ccc',borderRadius:'20px',background:'white',cursor:hasNext?'pointer':'default',
                color:'#444',opacity:hasNext?1:.35,transition:'all .12s',whiteSpace:'nowrap'}}>
              Next
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Scrollable chapter content */}
        <div ref={contentRef} style={{flex:1, overflowY:'auto', background:'#edeae4', position:'relative'}}>
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

// ── Chapter page — full chapter + all sections ────────────────
function ChapterPage({ unit, sections, unitFiles, blocks, prev, next, onNavigate, chapterIdx }: {
  unit: FlatUnit; sections: FlatUnit[]
  unitFiles: Record<string, ContentUnit>; blocks: Record<string, ContentBlock[]>
  prev?: FlatUnit; next?: FlatUnit
  onNavigate: (i: number) => void; chapterIdx: number
}) {
  const uid    = unit.unit_id
  const uFile  = unitFiles[uid] || unit
  const title  = ml(uFile.title || unit.title)
  const execSum = ml((uFile as ContentUnit).executive_summary || (unit as ContentUnit).executive_summary)
  const isChap = unit.unit_type === 'chapter'
  const meta   = (uFile as ContentUnit).metadata

  let chNum = unit.para_number || ''
  if (!chNum && title) { const m = title.match(/Chapter\s+(\d+)/i); if (m) chNum = `Chapter ${m[1]}` }

  const afcCats = (meta?.audit_findings_categories || []).slice(0, isChap ? 5 : undefined)

  return (
    <div style={{maxWidth:'800px', margin:'0 auto', minHeight:'100%'}}>
      {/* Paper */}
      <div style={{background:'#fff', borderLeft:'1px solid #d8d4ce', borderRight:'1px solid #d8d4ce',
                   minHeight:'100%', padding:'52px 68px 56px', boxSizing:'border-box'}}>

        {/* Chapter header */}
        <div style={{borderBottom:'2.5px solid #1a3a6b', paddingBottom:'18px', marginBottom:'24px'}}>
          {chNum && (
            <div style={{fontFamily:'system-ui',fontSize:'10.5px',fontWeight:700,letterSpacing:'1.6px',
                         textTransform:'uppercase',color:'#c47a20',marginBottom:'7px'}}>
              {chNum}
            </div>
          )}
          {title && (
            <h1 style={{fontFamily:'"Georgia","Times New Roman",serif',fontSize:'27px',fontWeight:700,
                        color:'#1a3a6b',lineHeight:1.22,margin:0}}>
              {title}
            </h1>
          )}
          {afcCats.length > 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginTop:'12px'}}>
              {afcCats.map(cat=>(
                <span key={cat} style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:600,padding:'2px 8px',
                                        borderRadius:'10px',background:'#edf1f8',color:'#1a3a6b',border:'1px solid #c5d5ee'}}>
                  {cat.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Executive summary */}
        {execSum && (
          <p style={{fontFamily:'"Georgia","Times New Roman",serif',fontSize:'15.5px',color:'#444',
                     fontStyle:'italic',margin:'0 0 24px',paddingLeft:'16px',borderLeft:'3px solid #d8d4ce',
                     textAlign:'justify',lineHeight:1.7}}>
            {execSum}
          </p>
        )}

        {/* Chapter-level blocks */}
        <UnitBlocks uid={uid} blocks={blocks}/>

        {/* Sections */}
        {sections.map(sec => (
          <SectionBlock key={sec.unit_id} unit={sec} unitFiles={unitFiles} blocks={blocks}/>
        ))}

        {/* Bottom nav — prev/next chapter */}
        <div style={{marginTop:'52px',paddingTop:'20px',borderTop:'1px solid #e0dcd6',
                     display:'flex',justifyContent:'space-between',gap:'12px'}}>
          {prev ? <BottomNavBtn unit={prev} dir="prev" onClick={()=>onNavigate(chapterIdx-1)}/> : <div/>}
          {next ? <BottomNavBtn unit={next} dir="next" onClick={()=>onNavigate(chapterIdx+1)}/> : <div/>}
        </div>
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────
function SectionBlock({ unit, unitFiles, blocks }: {
  unit: FlatUnit; unitFiles: Record<string, ContentUnit>; blocks: Record<string, ContentBlock[]>
}) {
  const uid    = unit.unit_id
  const uFile  = unitFiles[uid] || unit
  const title  = ml((uFile as ContentUnit).title || (unit as ContentUnit).title)
  const secNum = unit.para_number || (uFile as ContentUnit).para_number || ''
  const meta   = (uFile as ContentUnit).metadata
  const afc    = meta?.audit_findings_categories || []

  return (
    <div style={{marginTop:'40px', paddingTop:'4px'}}>
      {(secNum || title) && (
        <div style={{display:'flex',alignItems:'baseline',gap:'10px',marginBottom:'14px',
                     paddingBottom:'9px',borderBottom:'1px solid #e8e4dc'}}>
          {secNum && (
            <span style={{fontFamily:'system-ui',fontSize:'13px',fontWeight:700,color:'#c47a20',flexShrink:0}}>
              {secNum}
            </span>
          )}
          {title && (
            <span style={{fontFamily:'"Georgia","Times New Roman",serif',fontSize:'20px',fontWeight:700,color:'#1a1a1a',lineHeight:1.25}}>
              {title}
            </span>
          )}
        </div>
      )}
      {afc.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'12px'}}>
          {afc.map(cat=>(
            <span key={cat} style={{fontFamily:'system-ui',fontSize:'9.5px',fontWeight:600,padding:'2px 7px',
                                    borderRadius:'10px',background:'#f0f4fa',color:'#1a3a6b',border:'1px solid #d0ddf0'}}>
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
function UnitBlocks({ uid, blocks }: { uid: string; blocks: Record<string, ContentBlock[]> }) {
  const sorted = (blocks[uid]||[]).slice().sort((a,b)=>(a.seq||0)-(b.seq||0))
  return <>{sorted.map(b=><BlockRenderer key={b.block_id} block={b}/>)}</>
}

// ── Bottom nav button ─────────────────────────────────────────
function BottomNavBtn({ unit, dir, onClick }: { unit: FlatUnit; dir:'prev'|'next'; onClick:()=>void }) {
  const isPrev = dir === 'prev'
  const title  = ml((unit as ContentUnit).title) || unit.unit_id
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:'10px',
      padding:'11px 14px',borderRadius:'8px',
      border:'1px solid #d4d0ca',background:'#f9f8f6',
      cursor:'pointer',flex:'0 1 260px',
      transition:'border-color .12s',
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='#1a3a6b'}}
    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='#d4d0ca'}}
    >
      {isPrev && <svg width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m15 18-6-6 6-6"/></svg>}
      <div style={{flex:1,minWidth:0,textAlign:isPrev?'left':'right'}}>
        <div style={{fontFamily:'system-ui',fontSize:'9.5px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'#aaa',marginBottom:'3px'}}>
          {isPrev ? '← Previous' : 'Next →'}
        </div>
        <div style={{fontFamily:'"Georgia","Times New Roman",serif',fontSize:'14px',fontWeight:600,color:'#333',lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {title}
        </div>
      </div>
      {!isPrev && <svg width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m9 18 6-6-6-6"/></svg>}
    </button>
  )
}

// ── TOC ───────────────────────────────────────────────────────
function TOCPanel({ flatUnits, chapters, currentIdx, onNavigate }: {
  flatUnits: FlatUnit[]; chapters: FlatUnit[]; currentIdx: number; onNavigate:(i:number)=>void
}) {
  const frontMatter  = chapters.filter(u => ['preface','executive_summary'].includes(u.unit_type))
  const chaptersList = chapters.filter(u => u.unit_type === 'chapter')
  const backMatter   = chapters.filter(u => ['appendix','annexure'].includes(u.unit_type))

  function Group({ label, items }: { label: string; items: FlatUnit[] }) {
    if (!items.length) return null
    return (
      <div>
        <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1.6px',
                     textTransform:'uppercase',color:'#aaa',padding:'12px 16px 4px'}}>
          {label}
        </div>
        {items.map(ch => {
          const idx = chapters.findIndex(c => c.unit_id === ch.unit_id)
          const isActive = idx === currentIdx
          const secs = flatUnits.filter(u => u.parent_id === ch.unit_id).sort((a,b)=>(a.seq||0)-(b.seq||0))
          return (
            <div key={ch.unit_id}>
              {/* Chapter */}
              <button onClick={()=>onNavigate(idx)} style={{
                width:'100%',textAlign:'left',padding:'7px 16px',
                fontFamily:'system-ui',fontSize:'12.5px',fontWeight:600,
                border:'none',outline:'none',
                borderLeft:`3px solid ${isActive?'#c47a20':'transparent'}`,
                background:isActive?'#edf1f8':'transparent',
                color:isActive?'#1a3a6b':'#222',
                cursor:'pointer',display:'block',lineHeight:1.4,
              }}>
                {ml((ch as ContentUnit).title)||ch.unit_id}
              </button>
              {/* Sections — always visible */}
              {secs.map(sec => (
                <button key={sec.unit_id} onClick={()=>onNavigate(idx)} style={{
                  width:'100%',textAlign:'left',
                  padding:'3px 16px 3px 24px',
                  fontFamily:'system-ui',fontSize:'11px',fontWeight:400,
                  border:'none',outline:'none',
                  borderLeft:`3px solid ${isActive?'#e0dcd6':'transparent'}`,
                  background:'transparent',
                  color:isActive?'#555':'#888',
                  cursor:'pointer',display:'flex',alignItems:'baseline',gap:'5px',lineHeight:1.4,
                }}>
                  {sec.para_number && (
                    <span style={{color:'#c47a20',fontSize:'10px',fontWeight:600,flexShrink:0}}>{sec.para_number}</span>
                  )}
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {ml((sec as ContentUnit).title)||sec.unit_id}
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
