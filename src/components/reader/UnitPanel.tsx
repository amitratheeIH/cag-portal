'use client'

import { ml, type FlatUnit, type ContentUnit, type ContentBlock } from '@/types'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'

interface UnitPanelProps {
  unit: FlatUnit; unitFile?: ContentUnit; blocks: ContentBlock[]
  prevUnit?: FlatUnit; nextUnit?: FlatUnit
  onNavigate: (index: number) => void; reportTitle: string
}

const TYPE_LABELS: Record<string,string> = {
  preface:'Preface', executive_summary:'Executive Summary', chapter:'Chapter',
  section:'Section', appendix:'Appendix', annexure:'Annexure',
}
const TYPE_STYLES: Record<string,{bg:string;text:string}> = {
  preface:{bg:'#E8EAF6',text:'#3949AB'}, executive_summary:{bg:'#E0F2F1',text:'#00695C'},
  chapter:{bg:'var(--navy)',text:'#fff'}, section:{bg:'var(--border-lt)',text:'var(--navy)'},
  appendix:{bg:'#FFF3E8',text:'#E65100'},
}

function AfcTags({cats,limit}:{cats:string[];limit?:number}){
  if(!cats?.length) return null
  const items = limit ? cats.slice(0,limit) : cats
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
      {items.map(cat=>(
        <span key={cat} title={cat}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border font-sans"
          style={{background:'#edf1f8',color:'var(--navy)',borderColor:'#c5d5ee'}}>
          {cat.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())}
        </span>
      ))}
    </div>
  )
}

export function UnitPanel({unit,unitFile,blocks,prevUnit,nextUnit,onNavigate,reportTitle}:UnitPanelProps){
  const title   = ml(unitFile?.title||unit.title)
  const execSum = ml(unitFile?.executive_summary||unit.executive_summary)
  const ts      = TYPE_STYLES[unit.unit_type]||TYPE_STYLES.section
  const tl      = TYPE_LABELS[unit.unit_type]||unit.unit_type
  const rm      = blocks[0]?.resolved_meta
  const meta    = unitFile?.metadata
  const isChap  = unit.unit_type==='chapter'
  const afcCats: string[] = isChap
    ? (rm?.audit_findings_categories||meta?.audit_findings_categories||[])
    : (meta?.audit_findings_categories||[])

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 max-w-[820px] mx-auto w-full px-8 py-8">
        <header className="mb-7 pb-5 border-b" style={{borderColor:'var(--border-lt)'}}>
          <span className="inline-flex items-center text-[10.5px] font-bold tracking-[1.1px] uppercase px-2.5 py-1 rounded-full mb-3 font-sans"
                style={{background:ts.bg,color:ts.text}}>{tl}</span>

          {/* Fix 3: number + title on same baseline */}
          {title && (
            <div className="flex items-baseline gap-3 mb-1">
              {unit.para_number && (
                <span className="flex-shrink-0 font-sans text-[13.5px] font-bold" style={{color:'var(--saffron)'}}>
                  {unit.para_number}
                </span>
              )}
              <h1 className="font-serif text-[26px] font-bold leading-snug" style={{color:'var(--navy)'}}>
                {title}
              </h1>
            </div>
          )}

          {/* Fix 9: AFC tags */}
          {afcCats.length>0 && <AfcTags cats={afcCats} limit={isChap?5:undefined}/>}

          {/* Fix 7: exec summary justified */}
          {execSum && (
            <p className="text-[14px] leading-relaxed mt-2 italic" style={{color:'var(--text-2)',textAlign:'justify'}}>
              {execSum}
            </p>
          )}

          {rm && (
            <div className="flex flex-wrap gap-2 mt-3">
              {rm.audit_type?.[0] && <Pill label="Audit type" val={rm.audit_type[0].replace('ATYPE-','')}/>}
              {rm.audit_period && <Pill label="Period" val={`${rm.audit_period.start_year}\u2013${rm.audit_period.end_year}`}/>}
            </div>
          )}
        </header>

        <div role="region" aria-label="Report content">
          {blocks.length===0
            ? <div className="text-cag-text3 text-sm italic py-8 text-center">No content for this unit.</div>
            : blocks.map(b=><BlockRenderer key={b.block_id} block={b}/>)}
        </div>
      </div>

      <div className="max-w-[820px] mx-auto w-full px-8 py-6 border-t flex items-center justify-between gap-4"
           style={{borderColor:'var(--border-lt)'}}>
        {prevUnit ? <NavCard unit={prevUnit} dir="prev" onClick={()=>onNavigate(prevUnit.index)}/> : <div/>}
        {nextUnit ? <NavCard unit={nextUnit} dir="next" onClick={()=>onNavigate(nextUnit.index)}/> : <div/>}
      </div>
    </div>
  )
}

function Pill({label,val}:{label:string;val:string}){
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full border font-sans"
          style={{background:'var(--bg)',borderColor:'var(--border)',color:'var(--text-3)'}}>
      <strong style={{color:'var(--text-2)'}}>{label}:</strong> {val}
    </span>
  )
}

function NavCard({unit,dir,onClick}:{unit:FlatUnit;dir:'prev'|'next';onClick:()=>void}){
  const isPrev=dir==='prev'
  const title=ml(unit.title)||unit.unit_id
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border max-w-[280px] hover:border-navy hover:shadow-card transition-all group text-left"
      style={{borderColor:'var(--border)',background:'var(--surface)'}}
      aria-label={`${isPrev?'Previous':'Next'}: ${title}`}>
      {isPrev && <svg className="flex-shrink-0 text-cag-border group-hover:text-navy transition-colors" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>}
      <div className={`flex-1 min-w-0 ${isPrev?'':'text-right'}`}>
        <div className="text-[10px] font-bold tracking-wide uppercase text-cag-text3 mb-0.5 font-sans">{isPrev?'← Previous':'Next →'}</div>
        <div className="text-[13px] font-semibold text-cag-text leading-snug line-clamp-2">{title}</div>
        <div className="text-[11px] text-cag-text3 mt-0.5 font-sans">{TYPE_LABELS[unit.unit_type]||unit.unit_type}</div>
      </div>
      {!isPrev && <svg className="flex-shrink-0 text-cag-border group-hover:text-navy transition-colors" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>}
    </button>
  )
}
