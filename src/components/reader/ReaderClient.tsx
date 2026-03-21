'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ml, buildFlatUnitList, type FlatUnit, type ContentUnit, type ContentBlock, type ReportStructure } from '@/types'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'

interface ReaderData {
  structure: ReportStructure
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
  metadata: { common: { title: Record<string, string>; year: number } }
}

export function ReaderClient({ productId, initialData, unitIdFromUrl }: {
  productId: string; initialData: ReaderData; unitIdFromUrl?: string
}) {
  const [flatUnits, setFlatUnits] = useState<FlatUnit[]>([])
  const [activeUid, setActiveUid] = useState<string>('')
  const [tocOpen, setTocOpen] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const units = buildFlatUnitList(initialData.structure)
    setFlatUnits(units)
    // Set initial active unit — prefer URL param, else first unit
    const initUid = unitIdFromUrl || units[0]?.unit_id || ''
    setActiveUid(initUid)
  }, [initialData.structure, unitIdFromUrl])

  // Scroll active chapter into view
  const scrollToUnit = useCallback((uid: string) => {
    setActiveUid(uid)
    window.history.replaceState(null, '', `/report/${productId}?unit=${uid}`)
    setTimeout(() => {
      const el = document.getElementById(`unit-${uid}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [productId])

  // Scroll spy — update active TOC item as user scrolls
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const units = document.querySelectorAll('[data-uid]')
        let found = ''
        units.forEach(u => {
          const rect = u.getBoundingClientRect()
          if (rect.top <= 100) found = u.getAttribute('data-uid') || ''
        })
        if (found && found !== activeUid) setActiveUid(found)
        ticking = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [activeUid])

  if (flatUnits.length === 0) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'50vh',color:'var(--ink3)'}}>
        <div style={{textAlign:'center'}}>
          <div style={{width:'32px',height:'32px',border:'2px solid var(--rule)',borderTopColor:'var(--navy)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 12px'}}/>
          <div style={{fontFamily:'system-ui',fontSize:'13px'}}>Loading report…</div>
        </div>
      </div>
    )
  }

  const reportTitle = ml(initialData.metadata?.common?.title) || productId

  // Build chapter groups: each root unit + its children
  const allUnits = flatUnits
  const roots = allUnits.filter(u => !u.parent_id)

  return (
    <div style={{display:'flex',height:'calc(100vh - 64px)'}}>

      {/* ── TOC ─────────────────────────────────────────── */}
      <aside style={{
        width: tocOpen ? '272px' : '0',
        flexShrink:0, overflow:'hidden',
        transition:'width .25s ease',
        borderRight: '1px solid var(--rule)',
        background: 'var(--page)',
        display:'flex', flexDirection:'column',
      }} aria-label="Table of contents">
        {tocOpen && (
          <>
            <div style={{padding:'14px 16px 10px',borderBottom:'1px solid var(--rule-lt)',flexShrink:0}}>
              <div style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'var(--ink3)'}}>Contents</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'8px 0 20px'}}>
              <TOCList units={allUnits} activeUid={activeUid} onNavigate={scrollToUnit}/>
            </div>
          </>
        )}
      </aside>

      {/* ── Content ──────────────────────────────────────── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>

        {/* Nav bar */}
        <div style={{
          height:'44px',display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'0 24px',borderBottom:'1px solid var(--rule)',background:'var(--page)',
          flexShrink:0,boxShadow:'0 1px 4px rgba(26,58,107,.05)',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',minWidth:0}}>
            <button onClick={()=>setTocOpen(v=>!v)}
              style={{padding:'6px',borderRadius:'4px',border:'none',background:'none',cursor:'pointer',color:'var(--ink3)'}}
              aria-label={tocOpen?'Hide contents':'Show contents'}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
            <div style={{fontFamily:'system-ui',fontSize:'12px',color:'var(--ink3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {reportTitle}
            </div>
          </div>
          <div style={{fontFamily:'system-ui',fontSize:'11px',color:'var(--ink3)',flexShrink:0}}>
            {flatUnits.length} units
          </div>
        </div>

        {/* Scrollable content — whole report, chapter by chapter */}
        <div ref={contentRef} style={{flex:1,overflowY:'auto',background:'var(--cream)'}}>
          <div style={{
            maxWidth:'780px', margin:'32px auto 60px',
            background:'#fff', border:'1px solid var(--rule)',
            boxShadow:'0 2px 12px rgba(0,0,0,.06)',
            padding:'56px 72px 64px',
          }}>
            {/* Report header */}
            <div style={{fontFamily:'system-ui',fontSize:'10px',color:'var(--ink3)',letterSpacing:'.5px',marginBottom:'4px'}}>{productId}</div>
            <div style={{fontSize:'22px',fontWeight:700,color:'var(--navy)',borderBottom:'2px solid var(--navy)',paddingBottom:'12px',marginBottom:'0'}}>{reportTitle}</div>

            {/* Render front_matter, content_units, back_matter */}
            {(['front_matter','content_units','back_matter'] as const).map(section => {
              const sectionUnits = (initialData.structure[section]||[]) as ContentUnit[]
              if (!sectionUnits.length) return null
              const sectionRoots = sectionUnits.filter(u => !u.parent_id)
              const allSectionUnits = sectionUnits
              return sectionRoots.map(rootUnit => (
                <ChapterBlock
                  key={rootUnit.unit_id}
                  unit={rootUnit}
                  allUnits={allSectionUnits}
                  flatUnits={flatUnits}
                  unitFiles={initialData.unitFiles}
                  blocks={initialData.blocks}
                />
              ))
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Chapter block — renders whole chapter + all sections ──────
function ChapterBlock({ unit, allUnits, flatUnits, unitFiles, blocks }: {
  unit: ContentUnit
  allUnits: ContentUnit[]
  flatUnits: FlatUnit[]
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
}) {
  const uid = unit.unit_id
  const uFile = unitFiles[uid] || unit
  const title = ml(uFile.title || unit.title)
  const execSum = ml(uFile.executive_summary || unit.executive_summary)
  const uType = unit.unit_type
  const isChapter = uType === 'chapter'
  const flatUnit = flatUnits.find(u => u.unit_id === uid)
  const meta = uFile.metadata

  // Extract chapter number
  let chNum = unit.para_number || ''
  if (!chNum && title) { const m = title.match(/Chapter\s+(\d+)/i); if (m) chNum = `Chapter ${m[1]}` }

  // Children
  const children = allUnits.filter(u => u.parent_id === uid).sort((a,b)=>(a.seq||0)-(b.seq||0))

  // AFC tags
  const afcCats = (meta?.audit_findings_categories || []).slice(0, isChapter ? 5 : undefined)

  return (
    <div id={`unit-${uid}`} data-uid={uid} style={{marginTop:'48px',paddingTop:'24px',borderTop:'2px solid var(--navy)',scrollMarginTop:'24px'}}>
      {/* Chapter header */}
      {chNum && <div style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'var(--saffron)',marginBottom:'6px'}}>{chNum}</div>}
      {title && <div style={{fontSize:'22px',fontWeight:700,color:'var(--navy)',lineHeight:1.3,marginBottom:'4px'}}>{title}</div>}

      {/* AFC tags */}
      {afcCats.length > 0 && <AfcRow cats={afcCats}/>}

      {/* Exec summary */}
      {execSum && <div style={{fontSize:'15px',color:'var(--ink2)',fontStyle:'italic',marginTop:'8px',marginBottom:'20px',paddingLeft:'16px',borderLeft:'3px solid var(--rule)',textAlign:'justify'}}>{execSum}</div>}

      {/* Chapter-level blocks */}
      <UnitBlocks uid={uid} blocks={blocks}/>

      {/* Child sections — rendered inside chapter */}
      {children.map(sec => (
        <SectionBlock key={sec.unit_id} unit={sec} unitFiles={unitFiles} blocks={blocks}/>
      ))}
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────
function SectionBlock({ unit, unitFiles, blocks }: {
  unit: ContentUnit
  unitFiles: Record<string, ContentUnit>
  blocks: Record<string, ContentBlock[]>
}) {
  const uid = unit.unit_id
  const uFile = unitFiles[uid] || unit
  const title = ml(uFile.title || unit.title)
  const secNum = unit.para_number || uFile.para_number
  const meta = uFile.metadata
  const afcCats = meta?.audit_findings_categories || []

  return (
    <div id={`unit-${uid}`} data-uid={uid} style={{marginTop:'36px',scrollMarginTop:'24px'}}>
      {/* Section number + title on same line */}
      {(secNum || title) && (
        <div style={{display:'flex',alignItems:'baseline',gap:'10px',marginBottom:'14px',paddingBottom:'8px',borderBottom:'1px solid var(--rule-lt)'}}>
          {secNum && <span style={{fontFamily:'system-ui',fontSize:'13.5px',fontWeight:700,color:'var(--saffron)',flexShrink:0}}>{secNum}</span>}
          {title && <span style={{fontSize:'18px',fontWeight:700,color:'var(--ink)',lineHeight:1.3}}>{title}</span>}
        </div>
      )}

      {/* AFC tags */}
      {afcCats.length > 0 && <AfcRow cats={afcCats}/>}

      {/* Section blocks */}
      <UnitBlocks uid={uid} blocks={blocks}/>
    </div>
  )
}

// ── Unit blocks renderer ─────────────────────────────────────
function UnitBlocks({ uid, blocks }: { uid: string; blocks: Record<string, ContentBlock[]> }) {
  const unitBlocks = (blocks[uid] || []).slice().sort((a,b) => (a.seq||0)-(b.seq||0))
  return (
    <>
      {unitBlocks.map(b => <BlockRenderer key={b.block_id} block={b}/>)}
    </>
  )
}

// ── AFC row ───────────────────────────────────────────────────
function AfcRow({ cats }: { cats: string[] }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:'5px',margin:'6px 0 14px'}}>
      {cats.map(cat => (
        <span key={cat} title={cat} style={{
          fontFamily:'system-ui',fontSize:'10px',fontWeight:600,
          padding:'2px 8px',borderRadius:'10px',
          background:'#edf1f8',color:'var(--navy)',border:'1px solid #c5d5ee',letterSpacing:'.2px',
        }}>
          {cat.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())}
        </span>
      ))}
    </div>
  )
}

// ── TOC ───────────────────────────────────────────────────────
function TOCList({ units, activeUid, onNavigate }: {
  units: FlatUnit[]; activeUid: string; onNavigate: (uid: string) => void
}) {
  const roots = units.filter(u => !u.parent_id)
  const frontMatter = roots.filter(u => ['preface','executive_summary'].includes(u.unit_type))
  const chapters = roots.filter(u => u.unit_type === 'chapter')
  const backMatter = roots.filter(u => ['appendix','annexure'].includes(u.unit_type))
  const activeUnit = units.find(u => u.unit_id === activeUid)
  const activeParent = activeUnit?.parent_id

  return (
    <>
      {frontMatter.length > 0 && <>
        <TocGroupLabel>Front matter</TocGroupLabel>
        {frontMatter.map(u=><TocRoot key={u.unit_id} unit={u} units={units} activeUid={activeUid} activeParent={activeParent||''} onNavigate={onNavigate}/>)}
      </>}
      {chapters.length > 0 && <>
        <TocGroupLabel>Chapters &amp; sections</TocGroupLabel>
        {chapters.map(u=><TocRoot key={u.unit_id} unit={u} units={units} activeUid={activeUid} activeParent={activeParent||''} onNavigate={onNavigate}/>)}
      </>}
      {backMatter.length > 0 && <>
        <TocGroupLabel>Back matter</TocGroupLabel>
        {backMatter.map(u=><TocRoot key={u.unit_id} unit={u} units={units} activeUid={activeUid} activeParent={activeParent||''} onNavigate={onNavigate}/>)}
      </>}
    </>
  )
}

function TocGroupLabel({ children }: { children: React.ReactNode }) {
  return <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--ink3)',padding:'12px 16px 4px',opacity:.6}}>{children}</div>
}

function TocRoot({ unit, units, activeUid, activeParent, onNavigate }: {
  unit: FlatUnit; units: FlatUnit[]; activeUid: string; activeParent: string; onNavigate: (uid: string) => void
}) {
  const children = units.filter(u => u.parent_id === unit.unit_id)
  const isCurrent = activeUid === unit.unit_id
  const isInside = activeParent === unit.unit_id
  const isActive = isCurrent || isInside
  const title = ml(unit.title) || unit.unit_id

  // Always show sections (not just when open) — like viewer
  return (
    <div>
      <button onClick={()=>onNavigate(unit.unit_id)} style={{
        width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',
        padding:'6px 16px',fontFamily:'system-ui',fontSize:'12.5px',fontWeight:600,
        borderLeft:`2px solid ${isCurrent?'var(--saffron)':isInside?'var(--navy)':'transparent'}`,
        background:isActive?'var(--navy-lt)':'transparent',
        color:isActive?'var(--navy)':'var(--ink2)',
        border:'none',borderLeft:`2px solid ${isCurrent?'var(--saffron)':isInside?'var(--navy)':'transparent'}`,
        cursor:'pointer',lineHeight:1.4,transition:'background .1s',
      }}>
        <span style={{flex:1,textAlign:'left',lineHeight:1.4}}>{title}</span>
        {children.length>0&&<span style={{color:'var(--ink3)',fontSize:'14px'}}>›</span>}
      </button>

      {/* Always show sections — they scroll the page, no hiding */}
      {children.map(sec => {
        const secCurrent = activeUid === sec.unit_id
        const secTitle = ml(sec.title) || sec.unit_id
        const secNum = sec.para_number
        return (
          <button key={sec.unit_id} onClick={()=>onNavigate(sec.unit_id)} style={{
            width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',
            padding:'5px 16px 5px 28px',fontFamily:'system-ui',fontSize:'11.5px',
            fontWeight:secCurrent?600:400,
            borderLeft:`2px solid ${secCurrent?'var(--saffron)':'transparent'}`,
            background:secCurrent?'var(--navy-lt)':'transparent',
            color:secCurrent?'var(--navy)':'var(--ink3)',
            border:'none',borderLeft:`2px solid ${secCurrent?'var(--saffron)':'transparent'}`,
            cursor:'pointer',lineHeight:1.4,transition:'background .1s',
          }}>
            {secNum&&<span style={{color:'var(--saffron)',flexShrink:0,fontSize:'10.5px'}}>{secNum}</span>}
            <span style={{flex:1,textAlign:'left',lineHeight:1.4}}>{secTitle}</span>
          </button>
        )
      })}
    </div>
  )
}
ENDTSXEOF
echo "ReaderClient.tsx written"