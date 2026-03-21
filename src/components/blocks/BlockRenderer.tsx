'use client'

import { ml, type ContentBlock, type ListItem, type RichboxBodyItem } from '@/types'

function safe(s: string): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?(strong|em|u|sup|sub|del|code|mark|br)(\s[^>]*)?)&gt;/gi, '<$1>')
}
function ml_s(obj: Record<string,string> | string | undefined | null): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return (obj as Record<string,string>).en || Object.values(obj as Record<string,string>)[0] || ''
}
function strip(s: string): string { return (s||'').replace(/<[^>]+>/g,'') }

// ── Dispatcher ────────────────────────────────────────────────
export function BlockRenderer({ block }: { block: ContentBlock }) {
  const bt = block.block_type
  if (bt === 'paragraph')          return <Para block={block} />
  if (bt === 'heading')            return <Head block={block} />
  if (bt === 'list')               return <List block={block} />
  if (bt === 'recommendation')     return <Rec block={block} />
  if (bt === 'richbox' || bt === 'executive_summary_block') return <Richbox block={block} />
  if (bt === 'table')              return <Table block={block} />
  if (bt === 'image' || bt === 'figure' || bt === 'map') return <Image block={block} />
  if (bt === 'signature_block')    return <Sig block={block} />
  if (bt === 'divider')            return <hr style={{border:'none',borderTop:'1px solid var(--rule-lt)',margin:'20px 0'}}/>
  if (bt === 'callout')            return <Callout block={block} />
  return null
}

// ── Paragraph ─────────────────────────────────────────────────
function Para({ block }: { block: ContentBlock }) {
  const text = ml_s(block.content.text as Record<string,string>)
  if (!text) return null
  const pt = block.content.para_type || 'normal'
  const pnum = block.para_number
    ? <span style={{fontFamily:'system-ui',fontSize:'10.5px',color:'var(--ink3)',marginRight:'8px'}}>{block.para_number}</span>
    : null

  const base: React.CSSProperties = {
    textAlign:'justify', hyphens:'auto', marginBottom:'14px',
    fontSize:'16px', lineHeight:'1.75', color:'var(--ink)',
  }
  const styles: Record<string,React.CSSProperties> = {
    finding:     {...base, borderLeft:'3px solid var(--red)', paddingLeft:'14px'},
    observation: {...base, borderLeft:'3px solid var(--amber)', paddingLeft:'14px'},
    conclusion:  {...base, borderLeft:'3px solid var(--green)', paddingLeft:'14px'},
    scope:       {...base, color:'var(--ink2)', fontStyle:'italic'},
    background:  {...base, color:'var(--ink2)', fontStyle:'italic'},
    legal_basis: {...base, borderLeft:'3px solid var(--navy)', paddingLeft:'14px', background:'var(--navy-lt)', paddingTop:'8px', paddingBottom:'8px'},
  }
  const style = styles[pt] || base

  const badge = pt && pt !== 'normal'
    ? <div style={{fontFamily:'system-ui',fontSize:'8.5px',fontWeight:700,letterSpacing:'.7px',textTransform:'uppercase',padding:'1px 6px',borderRadius:'3px',marginBottom:'3px',display:'inline-block',
        background: pt==='audit_observation'?'var(--red-lt)':pt==='conclusion'?'var(--green-lt)':pt==='legal_basis'?'var(--navy-lt)':'#f0f0ec',
        color: pt==='audit_observation'?'var(--red)':pt==='conclusion'?'var(--green)':pt==='legal_basis'?'var(--navy)':'var(--ink3)',
      }}>{pt.replace(/_/g,' ')}</div>
    : null

  return (
    <div style={{marginBottom:'14px'}}>
      {badge}
      <p style={style} dangerouslySetInnerHTML={{__html: (pnum ? `<span style="font-family:system-ui;font-size:10.5px;color:var(--ink3);margin-right:8px">${block.para_number}</span>` : '') + safe(text)}} />
    </div>
  )
}

// ── Heading ───────────────────────────────────────────────────
function Head({ block }: { block: ContentBlock }) {
  const text = ml_s(block.content.text as Record<string,string>)
  if (!text) return null
  const lv = Math.min(block.content.level || 2, 4)
  const styles: Record<number,React.CSSProperties> = {
    1: {fontSize:'20px',fontWeight:700,color:'var(--navy)',margin:'24px 0 10px'},
    2: {fontSize:'17px',fontWeight:700,color:'var(--navy)',margin:'20px 0 8px'},
    3: {fontSize:'15px',fontWeight:700,color:'var(--ink)',margin:'16px 0 6px'},
    4: {fontSize:'14px',fontWeight:700,color:'var(--ink2)',margin:'12px 0 4px'},
  }
  const Tag = `h${lv+1}` as keyof JSX.IntrinsicElements
  return <Tag style={styles[lv]} dangerouslySetInnerHTML={{__html:safe(text)}}/>
}

// ── List ──────────────────────────────────────────────────────
function List({ block }: { block: ContentBlock }) {
  const items = block.content.items || []
  if (!items.length) return null
  const lt = block.content.list_type || 'unordered'
  const isOrdered = lt === 'ordered' || lt === 'alpha' || lt === 'roman'

  return (
    <ul style={{listStyle:'none',padding:0,margin:'8px 0 16px 0'}}>
      {items.map((item: ListItem, i: number) => {
        const text = ml_s(item.text as Record<string,string>)
        const pnum = item.para_number
        const subs = item.sub_items || []
        return (
          <li key={i} style={{display:'flex',gap:'12px',marginBottom:'10px',fontSize:'16px',lineHeight:'1.72',textAlign:'justify',alignItems:'flex-start'}}>
            {isOrdered
              ? <span style={{flexShrink:0,fontWeight:600,color:'var(--ink2)',minWidth:'20px',textAlign:'right',fontFamily:'system-ui',fontSize:'15px'}}>{i+1}.</span>
              : <span style={{flexShrink:0,width:'6px',height:'6px',borderRadius:'50%',background:'var(--ink2)',marginTop:'0.55em',display:'block'}}/>
            }
            <div style={{flex:1}}>
              {pnum && <span style={{fontFamily:'system-ui',fontSize:'10.5px',color:'var(--ink3)',marginRight:'8px'}}>{pnum}</span>}
              <span dangerouslySetInnerHTML={{__html:safe(text)}}/>
              {subs.length > 0 && (
                <ul style={{listStyle:'none',padding:0,margin:'6px 0 2px 18px'}}>
                  {subs.map((s: {text: Record<string,string>}, j: number) => (
                    <li key={j} style={{display:'flex',gap:'10px',fontSize:'14.5px',lineHeight:'1.65',marginBottom:'5px',color:'var(--ink2)'}}>
                      <span style={{color:'var(--ink3)',flexShrink:0}}>–</span>
                      <span dangerouslySetInnerHTML={{__html:safe(ml_s(s.text))}}/>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Recommendation ────────────────────────────────────────────
function Rec({ block }: { block: ContentBlock }) {
  const text = ml_s(block.content.text as Record<string,string>)
  if (!text) return null
  return (
    <div style={{margin:'16px 0',border:'1px solid #b8d4b8',borderLeft:'4px solid var(--green)',background:'var(--green-lt)',borderRadius:'0 5px 5px 0',padding:'14px 18px'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--green)',marginBottom:'5px'}}>Recommendation</div>
      {block.para_number && <span style={{fontFamily:'system-ui',fontSize:'10.5px',color:'var(--ink3)',marginRight:'8px'}}>{block.para_number}</span>}
      <div style={{fontSize:'16px',lineHeight:'1.7',textAlign:'justify'}} dangerouslySetInnerHTML={{__html:safe(text)}}/>
    </div>
  )
}

// ── Callout ───────────────────────────────────────────────────
function Callout({ block }: { block: ContentBlock }) {
  const ct = (block.content as Record<string,unknown>).callout_type as string || 'note'
  const title = ml_s((block.content as Record<string,unknown>).title as Record<string,string>)
  const text = ml_s(block.content.text as Record<string,string>)
  return (
    <div style={{borderLeft:'4px solid var(--navy)',background:'var(--navy-lt)',padding:'10px 16px',margin:'14px 0',borderRadius:'0 4px 4px 0'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--navy)',marginBottom:'4px'}}>{ct.replace(/_/g,' ')}</div>
      {title && <div style={{fontWeight:700,marginBottom:'4px'}} dangerouslySetInnerHTML={{__html:safe(title)}}/>}
      <div dangerouslySetInnerHTML={{__html:safe(text)}}/>
    </div>
  )
}

// ── Richbox ───────────────────────────────────────────────────
const RB_STYLES: Record<string,{head:string;border:string;label:string;icon:string}> = {
  executive_summary: {head:'#ddeeff',border:'#b0cfee',label:'#0a4a8a',icon:'📋'},
  key_data:          {head:'#ddf0e4',border:'#b8d4b8',label:'var(--green)',icon:'📊'},
  audit_observation: {head:'#fef0d8',border:'#e8cfa0',label:'var(--amber)',icon:'🔍'},
  case_study:        {head:'#f5f0e0',border:'#d8c898',label:'#5a4000',icon:'📝'},
  note:              {head:'#f0f0ec',border:'var(--rule)',label:'var(--ink3)',icon:'ℹ️'},
  legal_provision:   {head:'var(--navy-lt)',border:'#b8c8e0',label:'var(--navy)',icon:'⚖️'},
  background:        {head:'#f4f4f0',border:'var(--rule)',label:'var(--ink3)',icon:'📄'},
  methodology:       {head:'#f0eaf6',border:'#c8b0da',label:'#5a2d82',icon:'🧪'},
}
const RB_LABELS: Record<string,string> = {
  executive_summary:'Executive Summary',key_data:'Key Data',audit_observation:'Audit Observation',
  case_study:'Case Study',note:'Note',legal_provision:'Legal Provision',background:'Background',methodology:'Methodology',
}

function Richbox({ block }: { block: ContentBlock }) {
  const btype = block.content.box_type || 'note'
  const st = RB_STYLES[btype] || RB_STYLES.note
  const label = RB_LABELS[btype] || btype.replace(/_/g,' ')
  const titleText = ml_s(block.content.title as Record<string,string>)
  const isDupTitle = titleText && titleText.toLowerCase().trim() === label.toLowerCase().trim()
  const body = block.content.body || []

  return (
    <div style={{margin:'18px 0',borderRadius:'4px',overflow:'hidden',border:`1px solid ${st.border}`}}>
      <div style={{padding:'9px 16px',background:st.head,display:'flex',alignItems:'center',gap:'8px'}}>
        <span>{st.icon}</span>
        <span style={{fontFamily:'system-ui',fontSize:'11.5px',fontWeight:700,color:st.label}}>{label}</span>
      </div>
      <div style={{padding:'14px 18px',background:'#fff',fontSize:'16px',lineHeight:'1.72'}}>
        {titleText && !isDupTitle && (
          <div style={{fontWeight:700,fontSize:'15.5px',marginBottom:'10px',paddingBottom:'7px',borderBottom:'1px solid rgba(0,0,0,.07)'}}
               dangerouslySetInnerHTML={{__html:safe(titleText)}}/>
        )}
        {body.map((item: RichboxBodyItem, i: number) => <RBItem key={i} item={item}/>)}
      </div>
    </div>
  )
}

function RBItem({ item }: { item: RichboxBodyItem }) {
  if (item.type === 'paragraph')
    return <p style={{marginBottom:'8px',textAlign:'justify'}} dangerouslySetInnerHTML={{__html:safe(ml_s(item.text as Record<string,string>))}}/>
  if (item.type === 'heading')
    return <div style={{fontWeight:700,margin:'10px 0 6px',fontSize:'15px'}} dangerouslySetInnerHTML={{__html:safe(ml_s(item.text as Record<string,string>))}}/>
  if (item.type === 'bullets' || item.type === 'ordered_list') {
    const isOrd = item.type === 'ordered_list'
    return (
      <ul style={{listStyle:isOrd?'decimal':'disc',margin:'6px 0 10px 22px',fontSize:'15px'}}>
        {(item.items||[]).map((bi: {text:Record<string,string>},j:number)=>(
          <li key={j} style={{marginBottom:'4px'}} dangerouslySetInnerHTML={{__html:safe(ml_s(bi.text))}}/>
        ))}
      </ul>
    )
  }
  return null
}

// ── Table ─────────────────────────────────────────────────────
function Table({ block }: { block: ContentBlock }) {
  const caption  = ml_s(block.content.caption as Record<string,string>)
  const tableNum = block.content.table_number
  const unitNote = ml_s(block.content.unit_note as Record<string,string>)
  const source   = ml_s(block.content.source as Record<string,string>)
  const dsRef    = block.content.dataset_ref

  return (
    <div style={{margin:'20px 0',padding:'16px',background:'#fff',border:'1px solid var(--rule)',borderRadius:'6px'}}>
      {(tableNum || caption) && (
        <div style={{display:'flex',alignItems:'baseline',gap:'10px',marginBottom:'8px'}}>
          {tableNum && <span style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,background:'var(--navy)',color:'#fff',padding:'2px 7px',borderRadius:'3px',letterSpacing:'.4px'}}>Table {tableNum}</span>}
          {caption && <span style={{fontSize:'13.5px',fontWeight:600,color:'var(--ink2)'}}>{caption}</span>}
        </div>
      )}
      {unitNote && <div style={{fontFamily:'system-ui',fontSize:'11px',color:'var(--ink3)',fontStyle:'italic',textAlign:'right',marginBottom:'4px'}}>{unitNote}</div>}
      <div style={{overflowX:'auto'}}>
        <div style={{padding:'14px',textAlign:'center',background:'var(--navy-lt)',borderRadius:'4px',fontFamily:'system-ui',fontSize:'12px',color:'var(--ink3)'}}>
          📊 {dsRef ? <>Dataset: <code>{dsRef}</code> — load report data to render</> : 'Table data'}
        </div>
      </div>
      {source && <div style={{fontFamily:'system-ui',fontSize:'11.5px',color:'var(--ink3)',marginTop:'6px',paddingTop:'5px',borderTop:'1px solid var(--rule-lt)'}}><b>Source:</b> {source}</div>}
    </div>
  )
}

// ── Image ─────────────────────────────────────────────────────
function Image({ block }: { block: ContentBlock }) {
  const caption  = ml_s(block.content.caption as Record<string,string>)
  const alt      = ml_s(block.content.alt_text as Record<string,string>) || caption || 'Figure'
  const assetRef = block.content.asset_ref

  return (
    <figure style={{margin:'20px 0'}}>
      <div style={{border:'1px solid var(--rule)',borderRadius:'6px',overflow:'hidden',background:'#fff'}}>
        <div style={{padding:'28px 16px',textAlign:'center',color:'var(--ink3)',background:'var(--page)'}}>
          <div style={{fontSize:'28px',marginBottom:'6px'}}>🖼</div>
          <div style={{fontFamily:'system-ui',fontSize:'12px'}}>{assetRef || 'Image / Figure'}</div>
          <div style={{fontFamily:'system-ui',fontSize:'11px',color:'#aaa',marginTop:'4px'}}>Load assets folder to display</div>
        </div>
      </div>
      {caption && <figcaption style={{fontSize:'13px',fontStyle:'italic',color:'var(--ink3)',textAlign:'center',marginTop:'6px'}}>{caption}</figcaption>}
    </figure>
  )
}

// ── Signature ─────────────────────────────────────────────────
function Sig({ block }: { block: ContentBlock }) {
  const sigs = block.content.signatories || []
  const roleLabels: Record<string,string> = {signed_by:'Signed by',countersigned_by:'Countersigned by',verified_by:'Verified by'}
  return (
    <div style={{margin:'24px 0',padding:'16px',border:'1px solid var(--rule)',borderRadius:'4px',background:'#fafaf8'}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:'20px'}}>
        {(sigs as unknown[]).map((sig,i:number)=>{ const s = sig as Record<string,unknown>; return (
          <div key={i} style={{flex:1,minWidth:'200px'}}>
            <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--ink3)',marginBottom:'6px'}}>{roleLabels[s.role as string]||s.role as string||''}</div>
            <div style={{height:'48px',borderBottom:'1px solid var(--rule)',marginBottom:'8px'}}/>
            <div style={{fontSize:'15px',fontWeight:700}}>{ml_s(s.name as Record<string,string>)}</div>
            {s.designation&&<div style={{fontSize:'13px',color:'var(--ink2)',marginTop:'2px'}}>{ml_s(s.designation as Record<string,string>)}</div>}
            {s.date&&<div style={{fontFamily:'system-ui',fontSize:'12px',color:'var(--ink3)',marginTop:'3px'}}>{s.date as string}</div>}
          </div>
        ); })}
      </div>
    </div>
  )
}
