'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  const [flatUnits, setFlatUnits]   = useState<FlatUnit[]>([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [tocOpen, setTocOpen]       = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  // All top-level (root) units — one "page" each
  const [chapters, setChapters] = useState<FlatUnit[]>([])

  useEffect(() => {
    if (folderPath) setFolderPath(folderPath)
    const units = buildFlatUnitList(initialData.structure)
    setFlatUnits(units)
    const roots = units.filter(u => !u.parent_id)
    setChapters(roots)
    // Find initial chapter from URL param
    let initIdx = 0
    if (unitIdFromUrl) {
      const u = units.find(u => u.unit_id === unitIdFromUrl)
      if (u) {
        // If it's a section, find its parent chapter
        const rootUid = u.parent_id || u.unit_id
        const ri = roots.findIndex(r => r.unit_id === rootUid)
        if (ri >= 0) initIdx = ri
      }
    }
    setChapterIdx(initIdx)
  }, [initialData.structure, unitIdFromUrl, folderPath])

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
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') goTo(chapterIdx + 1)
      if (e.key === 'ArrowLeft')  goTo(chapterIdx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapterIdx, goTo])

  if (chapters.length === 0) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <div style={{fontFamily:'system-ui',fontSize:'13px',color:'var(--ink3)'}}>Loading…</div>
    </div>
  )

  const current = chapters[chapterIdx]
  const reportTitle = ml(initialData.metadata?.common?.title) || productId

  // Sections belonging to current chapter
  const sections = flatUnits.filter(u => u.parent_id === current?.unit_id)
    .sort((a, b) => (a.seq||0) - (b.seq||0))

  return (
    <div style={{display:'flex', height:'calc(100vh - 64px)'}}>

      {/* ── TOC ───────────────────────────────────────────── */}
      <aside style={{
        width: tocOpen ? '272px' : '0',
        flexShrink: 0, overflow: 'hidden',
        transition: 'width .25s',
        borderRight: '1px solid var(--rule)',
        background: 'var(--page)',
        display: 'flex', flexDirection: 'column',
      }}>
        {tocOpen && (
          <>
            <div style={{padding:'14px 16px 10px', borderBottom:'1px solid var(--rule-lt)', flexShrink:0}}>
              <div style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'var(--ink3)'}}>Contents</div>
            </div>
            <div style={{flex:1, overflowY:'auto', padding:'6px 0 20px'}}>
              <TOCPanel
                flatUnits={flatUnits}
                chapters={chapters}
                currentIdx={chapterIdx}
                onNavigate={goTo}
              />
            </div>
          </>
        )}
      </aside>

      {/* ── Main ──────────────────────────────────────────── */}
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0}}>

        {/* Nav bar */}
        <div style={{
          height:'44px', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 20px', borderBottom:'1px solid var(--rule)', background:'var(--page)',
          flexShrink:0,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0}}>
            <button onClick={()=>setTocOpen(v=>!v)}
              style={{padding:'6px',border:'none',background:'none',cursor:'pointer',color:'var(--ink3)',borderRadius:'4px'}}
              aria-label="Toggle contents">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'12px',color:'var(--ink3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'300px'}}>
              {reportTitle}
            </span>
          </div>
          {/* Prev / Next */}
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <button onClick={()=>goTo(chapterIdx-1)} disabled={chapterIdx<=0}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 12px',fontFamily:'system-ui',fontSize:'12px',fontWeight:500,border:'1px solid var(--rule)',borderRadius:'20px',background:'none',cursor:chapterIdx<=0?'not-allowed':'pointer',color:'var(--ink2)',opacity:chapterIdx<=0?.35:1,transition:'all .15s'}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
              Previous
            </button>
            <span style={{fontFamily:'system-ui',fontSize:'11px',color:'var(--ink3)',padding:'0 4px'}}>
              {chapterIdx+1} / {chapters.length}
            </span>
            <button onClick={()=>goTo(chapterIdx+1)} disabled={chapterIdx>=chapters.length-1}
              style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 12px',fontFamily:'system-ui',fontSize:'12px',fontWeight:500,border:'1px solid var(--rule)',borderRadius:'20px',background:'none',cursor:chapterIdx>=chapters.length-1?'not-allowed':'pointer',color:'var(--ink2)',opacity:chapterIdx>=chapters.length-1?.35:1,transition:'all .15s'}}>
              Next
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Chapter content */}
        <div ref={contentRef} style={{flex:1, overflowY:'auto', background:'#f0eeea'}}>
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
              chapters={chapters}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chapter page — one full chapter with all its sections ─────
function ChapterPage({ unit, sections, unitFiles, blocks, prev, next, onNavigate, chapterIdx, chapters }: {
  unit: FlatUnit; sections: FlatUnit[]
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
  prev?: FlatUnit; next?: FlatUnit
  onNavigate: (i: number) => void
  chapterIdx: number; chapters: FlatUnit[]
}) {
  const uid    = unit.unit_id
  const uFile  = unitFiles[uid] || unit
  const title  = ml(uFile.title || unit.title)
  const execSum = ml(uFile.executive_summary || unit.executive_summary)
  const uType  = unit.unit_type
  const meta   = uFile.metadata
  const isChap = uType === 'chapter'

  let chNum = unit.para_number || ''
  if (!chNum && title) { const m = title.match(/Chapter\s+(\d+)/i); if (m) chNum = `Chapter ${m[1]}` }

  const afcCats = (meta?.audit_findings_categories || []).slice(0, isChap ? 5 : undefined)

  return (
    <div style={{maxWidth:'800px', margin:'0 auto', padding:'0 0 80px'}}>
      {/* Paper sheet */}
      <div style={{background:'#fff', borderLeft:'1px solid #d8d4ce', borderRight:'1px solid #d8d4ce', minHeight:'100vh', padding:'52px 72px 48px'}}>

        {/* Chapter header */}
        <div style={{borderBottom:'2px solid var(--navy)', paddingBottom:'18px', marginBottom:'0'}}>
          {chNum && (
            <div style={{fontFamily:'system-ui',fontSize:'10.5px',fontWeight:700,letterSpacing:'1.4px',textTransform:'uppercase',color:'var(--saffron)',marginBottom:'6px'}}>
              {chNum}
            </div>
          )}
          {title && (
            <h1 style={{fontFamily:'"EB Garamond","Times New Roman",serif',fontSize:'26px',fontWeight:700,color:'var(--navy)',lineHeight:1.25,margin:0}}>
              {title}
            </h1>
          )}
          {/* AFC tags */}
          {afcCats.length > 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginTop:'12px'}}>
              {afcCats.map(cat=>(
                <span key={cat} style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:'#edf1f8',color:'var(--navy)',border:'1px solid #c5d5ee'}}>
                  {cat.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Exec summary */}
        {execSum && (
          <p style={{fontFamily:'"EB Garamond","Times New Roman",serif',fontSize:'15.5px',color:'var(--ink2)',fontStyle:'italic',margin:'16px 0 0',paddingLeft:'16px',borderLeft:'3px solid var(--rule)',textAlign:'justify',lineHeight:1.7}}>
            {execSum}
          </p>
        )}

        {/* Chapter-level blocks */}
        <div style={{marginTop:'24px'}}>
          <UnitBlocks uid={uid} blocks={blocks}/>
        </div>

        {/* Sections */}
        {sections.map(sec => (
          <SectionBlock key={sec.unit_id} unit={sec} unitFiles={unitFiles} blocks={blocks}/>
        ))}

        {/* Bottom navigation */}
        <div style={{marginTop:'56px',paddingTop:'20px',borderTop:'1px solid var(--rule)',display:'flex',alignItems:'stretch',justifyContent:'space-between',gap:'12px'}}>
          {prev ? (
            <NavCard unit={prev} dir="prev" onClick={()=>onNavigate(chapterIdx-1)}/>
          ) : <div/>}
          {next ? (
            <NavCard unit={next} dir="next" onClick={()=>onNavigate(chapterIdx+1)}/>
          ) : <div/>}
        </div>
      </div>
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────
function SectionBlock({ unit, unitFiles, blocks }: {
  unit: FlatUnit; unitFiles: Record<string, ContentUnit>; blocks: Record<string, ContentBlock[]>
}) {
  const uid   = unit.unit_id
  const uFile = unitFiles[uid] || unit
  const title  = ml(uFile.title || unit.title)
  const secNum = unit.para_number || uFile.para_number || ''
  const meta   = uFile.metadata
  const afc    = meta?.audit_findings_categories || []

  return (
    <div id={`sec-${uid}`} style={{marginTop:'40px', scrollMarginTop:'20px'}}>
      {(secNum || title) && (
        <div style={{display:'flex',alignItems:'baseline',gap:'10px',marginBottom:'14px',paddingBottom:'8px',borderBottom:'1px solid var(--rule-lt)'}}>
          {secNum && (
            <span style={{fontFamily:'system-ui',fontSize:'13px',fontWeight:700,color:'var(--saffron)',flexShrink:0}}>
              {secNum}
            </span>
          )}
          {title && (
            <span style={{fontFamily:'"EB Garamond","Times New Roman",serif',fontSize:'19px',fontWeight:700,color:'var(--ink)',lineHeight:1.25}}>
              {title}
            </span>
          )}
        </div>
      )}
      {afc.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'12px'}}>
          {afc.map(cat=>(
            <span key={cat} style={{fontFamily:'system-ui',fontSize:'9.5px',fontWeight:600,padding:'2px 7px',borderRadius:'10px',background:'#f0f4fa',color:'var(--navy)',border:'1px solid #d0ddf0'}}>
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

// ── Bottom nav card ───────────────────────────────────────────
function NavCard({ unit, dir, onClick }: { unit: FlatUnit; dir:'prev'|'next'; onClick:()=>void }) {
  const isPrev = dir === 'prev'
  const title  = ml(unit.title) || unit.unit_id
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:'10px',
      padding:'12px 16px',borderRadius:'8px',
      border:'1px solid var(--rule)',background:'var(--page)',
      cursor:'pointer',textAlign:isPrev?'left':'right',
      flex:'0 1 280px',transition:'border-color .15s,box-shadow .15s',
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--navy)';(e.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(26,58,107,.1)'}}
    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--rule)';(e.currentTarget as HTMLElement).style.boxShadow='none'}}
    >
      {isPrev && <svg width="18" height="18" fill="none" stroke="var(--ink3)" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m15 18-6-6 6-6"/></svg>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--ink3)',marginBottom:'2px'}}>
          {isPrev ? '← Previous' : 'Next →'}
        </div>
        <div style={{fontFamily:'"EB Garamond","Times New Roman",serif',fontSize:'14px',fontWeight:600,color:'var(--ink)',lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {title}
        </div>
      </div>
      {!isPrev && <svg width="18" height="18" fill="none" stroke="var(--ink3)" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="m9 18 6-6-6-6"/></svg>}
    </button>
  )
}

// ── TOC ───────────────────────────────────────────────────────
function TOCPanel({ flatUnits, chapters, currentIdx, onNavigate }: {
  flatUnits: FlatUnit[]; chapters: FlatUnit[]
  currentIdx: number; onNavigate: (i: number) => void
}) {
  const frontMatter  = chapters.filter(u => ['preface','executive_summary'].includes(u.unit_type))
  const chaptersList = chapters.filter(u => u.unit_type === 'chapter')
  const backMatter   = chapters.filter(u => ['appendix','annexure'].includes(u.unit_type))

  const renderGroup = (items: FlatUnit[], label: string) => {
    if (!items.length) return null
    return (
      <div key={label}>
        <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1.6px',textTransform:'uppercase',color:'var(--ink3)',padding:'12px 16px 4px',opacity:.55}}>
          {label}
        </div>
        {items.map(ch => {
          const idx = chapters.findIndex(c => c.unit_id === ch.unit_id)
          const isActive = idx === currentIdx
          const sections = flatUnits.filter(u => u.parent_id === ch.unit_id).sort((a,b)=>(a.seq||0)-(b.seq||0))
          return (
            <div key={ch.unit_id}>
              {/* Chapter row */}
              <button onClick={()=>onNavigate(idx)} style={{
                width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:'6px',
                padding:'7px 16px',fontFamily:'system-ui',fontSize:'12.5px',fontWeight:600,
                border:'none',borderLeft:`3px solid ${isActive?'var(--saffron)':'transparent'}`,
                background:isActive?'#edf1f8':'transparent',
                color:isActive?'var(--navy)':'#2a2a2a',
                cursor:'pointer',lineHeight:1.4,transition:'background .1s',outline:'none',
              }}>
                <span style={{flex:1,lineHeight:1.4}}>{ml(ch.title)||ch.unit_id}</span>
              </button>
              {/* Sections — always visible, indented */}
              {sections.map(sec => (
                <button key={sec.unit_id} onClick={()=>onNavigate(idx)} style={{
                  width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:'6px',
                  padding:'4px 16px 4px 26px',fontFamily:'system-ui',fontSize:'11.5px',fontWeight:400,
                  border:'none',borderLeft:`3px solid ${isActive?'transparent':'transparent'}`,
                  background:'transparent',color:'#5a5a5a',
                  cursor:'pointer',lineHeight:1.4,transition:'color .1s',outline:'none',
                }}>
                  {sec.para_number && (
                    <span style={{color:'var(--saffron)',flexShrink:0,fontSize:'10px',fontWeight:600}}>{sec.para_number}</span>
                  )}
                  <span style={{flex:1,lineHeight:1.35,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ml(sec.title)||sec.unit_id}</span>
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
      {renderGroup(frontMatter,  'Front matter')}
      {renderGroup(chaptersList, 'Chapters & sections')}
      {renderGroup(backMatter,   'Back matter')}
    </>
  )
}
