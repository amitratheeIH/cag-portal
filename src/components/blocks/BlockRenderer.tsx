'use client'

import React from 'react'
import { ml, type ContentBlock, type ListItem, type RichboxBodyItem } from '@/types'

// ── Module-level state ────────────────────────────────────────
let _folderPath = ''
export function setFolderPath(p: string) { _folderPath = p }

// Footnote index: block_id → array of footnote refs
interface FnRef {
  marker: string
  footnote_id?: string
  anchor_char_start?: number
  anchor_char_end?: number
  display_scope?: string
}
let _fnIdx: Record<string, FnRef[]> = {}
export function setFnIndex(idx: Record<string, unknown[]>) {
  _fnIdx = idx as Record<string, FnRef[]>
}
function getFnRefs(blockId: string): FnRef[] { return _fnIdx[blockId] || [] }

// ── Annotation index ──────────────────────────────────────────
interface AnnRef {
  annotation_id: string
  annotation_type: string
  start: number
  end: number
  lang?: string
  source?: string
  reviewed?: boolean
}
let _annIdx: Record<string, AnnRef[]> = {}
let _annVisible = false  // off by default
export function setAnnIndex(idx: Record<string, AnnRef[]>) { _annIdx = idx }
export function setAnnVisible(v: boolean) { _annVisible = v }
export function getAnnVisible(): boolean { return _annVisible }
function getAnns(blockId: string): AnnRef[] {
  if (!_annVisible) return []
  return _annIdx[blockId] || []
}

// ── Reference index ───────────────────────────────────────────
interface RefObj {
  type: string
  target: string
  target_format: string
  label?: Record<string,string> | string
  relationship_type?: string
}
let _refIdx: Record<string, RefObj[]> = {}
export function setRefIndex(idx: Record<string, RefObj[]>) { _refIdx = idx }
function getRefs(blockId: string): RefObj[] { return _refIdx[blockId] || [] }

// Derive navigation target from a reference object
function refHref(ref: RefObj): string {
  const target = ref.target || ''
  // product_id/unit_id  → sec-{unit_id}
  if (ref.target_format === 'product_id/unit_id') {
    const uid = target.includes('/') ? target.split('/').slice(1).join('/') : target
    return `#sec-${uid}`
  }
  // product_id/block_id → block-{block_id}
  if (ref.target_format === 'product_id/block_id') {
    const bid = target.includes('/') ? target.split('/').slice(1).join('/') : target
    return `#block-${bid}`
  }
  return '#'
}

// Inject reference hyperlinks into rendered HTML
// For each reference with a label, find the label text and wrap in <a>
function injectRefs(html: string, refs: RefObj[]): string {
  if (!refs.length) return html
  let result = html
  refs.forEach(ref => {
    const label = typeof ref.label === 'string'
      ? ref.label
      : (ref.label as Record<string,string>)?.en || Object.values(ref.label || {})[0] as string || ''
    if (!label) return
    const href = refHref(ref)
    if (href === '#') return
    // Escape label for use in regex
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      const rx = new RegExp(escaped, 'g')
      result = result.replace(rx, `<a href="${href}" style="color:var(--navy);text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer" onclick="event.preventDefault();const el=document.querySelector('${href}');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})">${label}</a>`)
    } catch { /* ignore regex errors */ }
  })
  return result
}

// Annotation styles per type
const ANN_STYLES: Record<string, {bg:string; title:string}> = {
  audit_observation:   { bg: 'rgba(244,121,32,0.18)', title: 'Audit Observation' },
  scope_for_improvement: { bg: 'rgba(26,58,107,0.12)', title: 'Scope for Improvement' },
  key_finding:         { bg: 'rgba(139,26,26,0.15)', title: 'Key Finding' },
  legal_provision:     { bg: 'rgba(36,92,54,0.13)', title: 'Legal Provision' },
}

// Inject annotation highlights into raw HTML text
// Multiple annotations may overlap — process as ranges, innermost wins
function injectAnnotations(rawHtml: string, anns: AnnRef[], globalOffset: number): string {
  if (!anns.length) return rawHtml
  
  // Sort by start position, then by end descending (wider spans first)
  const sorted = [...anns]
    .filter(a => a.end > a.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)
  
  if (!sorted.length) return rawHtml
  
  // Build a list of (charPos, isOpen, ann) events sorted by position
  const events: Array<{pos:number; open:boolean; ann:AnnRef}> = []
  sorted.forEach(ann => {
    events.push({ pos: ann.start - globalOffset, open: true,  ann })
    events.push({ pos: ann.end   - globalOffset, open: false, ann })
  })
  events.sort((a,b) => a.pos - b.pos || (a.open ? 1 : -1))
  
  // Walk raw HTML, counting stripped chars, inserting mark tags at events
  const stripped = stripTags(rawHtml)
  let result = ''
  let sc = 0
  let inTag = false
  let evIdx = 0
  
  for (let i = 0; i <= rawHtml.length; i++) {
    // Insert any events that fire at this stripped position
    while (evIdx < events.length && events[evIdx].pos <= sc && events[evIdx].pos >= 0) {
      const ev = events[evIdx++]
      const style = ANN_STYLES[ev.ann.annotation_type] || { bg: 'rgba(200,200,0,0.2)', title: ev.ann.annotation_type }
      if (ev.open) {
        result += `<mark style="background:${style.bg};border-radius:2px;padding:0 1px" title="${style.title}">`
      } else {
        result += '</mark>'
      }
    }
    if (i === rawHtml.length) break
    
    const ch = rawHtml[i]
    if (ch === '<') inTag = true
    if (!inTag) sc++
    if (ch === '>') inTag = false
    result += ch
  }
  
  return result
}

// ── HTML safety ───────────────────────────────────────────────
function safe(s: string): string {
  if (!s) return ''
  // Escape all HTML
  let r = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Restore safe inline tags: strong, em, u, sup, sub, del, code, mark, br
  const tag = '(strong|em|u|sup|sub|del|code|mark|br)'
  r = r.replace(new RegExp('&lt;(' + tag + ')(\\s[^>]*)?&gt;', 'gi'), '<$1$3>')
  r = r.replace(new RegExp('&lt;/(' + tag + ')&gt;', 'gi'), '</$1>')
  r = r.replace(/&lt;br\s*&gt;/gi, '<br>')
  return r
}
function ml_s(obj: Record<string,string> | string | undefined | null): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return (obj as Record<string,string>).en || Object.values(obj as Record<string,string>)[0] || ''
}
function stripTags(s: string): string { return (s||'').replace(/<[^>]+>/g, '') }

// ── Footnote superscript HTML ─────────────────────────────────
function fnSupHtml(fn: FnRef): string {
  const fnId = `fn-${fn.footnote_id || fn.marker}`
  const tipText = (_inlineFnText[fn.footnote_id || fn.marker] || '').substring(0, 200).replace(/"/g, '&quot;')
  const tip = tipText ? ` title="${tipText}"` : ''
  return `<sup id="fnref-${fn.footnote_id||fn.marker}" style="color:#8b1a1a;font-size:13px;font-weight:700;line-height:0;font-family:system-ui;cursor:help"${tip} onclick="var el=document.getElementById('${fnId}');if(el){el.scrollIntoView({behavior:'smooth',block:'center'})}">${fn.marker}</sup>`
}

// ── Inject a superscript at char offset (anchor_char_end) into raw HTML text ──
// Offsets are into stripped text; we must walk raw HTML to find insertion point.
function injectSupAtOffset(rawHtml: string, charEnd: number, fnRef: FnRef): string {
  // Walk raw HTML counting only non-tag characters
  const stripped = stripTags(rawHtml)
  const target = Math.min(charEnd, stripped.length)
  
  let sc = 0
  let inTag = false
  for (let i = 0; i < rawHtml.length; i++) {
    if (rawHtml[i] === '<') { inTag = true }
    if (!inTag) {
      sc++
      if (sc === target) {
        return rawHtml.slice(0, i + 1) + fnSupHtml(fnRef) + rawHtml.slice(i + 1)
      }
    }
    if (rawHtml[i] === '>') { inTag = false }
  }
  // Fallback: append at end
  return rawHtml + fnSupHtml(fnRef)
}

// Inject multiple footnote sups into text, processing right-to-left
function injectAllSups(rawHtml: string, fns: FnRef[], globalOffset: number): string {
  // Sort descending by charEnd so right-to-left injection preserves offsets
  const sorted = [...fns].sort((a, b) => (b.anchor_char_end||0) - (a.anchor_char_end||0))
  let result = rawHtml
  for (const fn of sorted) {
    const localEnd = (fn.anchor_char_end || 0) - globalOffset
    if (localEnd > 0) {
      result = injectSupAtOffset(result, localEnd, fn)
    }
  }
  return result
}

// ── getBlockText for offset calculation ──────────────────────
// Must match builder's getBlockText() exactly:
// paragraph: stripped text
// list: items joined by "\n" (stripped)
// richbox: body items text joined by "\n" (bullets each item separately)
function getListText(items: ListItem[]): string {
  return items.map(item => stripTags(ml_s(item.text as Record<string,string>))).join('\n')
}

function getRichboxText(body: RichboxBodyItem[]): string {
  const parts: string[] = []
  for (const item of body) {
    if (item.type === 'paragraph' || item.type === 'heading') {
      const t = stripTags(ml_s(item.text as Record<string,string>))
      if (t) parts.push(t)
    } else if (item.type === 'bullets' || item.type === 'ordered_list') {
      for (const bi of (item.items || [])) {
        const t = stripTags(ml_s((bi as {text:Record<string,string>}).text))
        if (t) parts.push(t)
      }
    }
  }
  return parts.join('\n')
}

// ── Dispatcher ────────────────────────────────────────────────
export function BlockRenderer({ block }: { block: ContentBlock }) {
  const bt = block.block_type
  if (bt === 'paragraph')    return <Para block={block} />
  if (bt === 'heading')      return <Head block={block} />
  if (bt === 'list')         return <List block={block} />
  if (bt === 'recommendation') return <Rec block={block} />
  if (bt === 'richbox' || bt === 'executive_summary_block') return <Richbox block={block} />
  if (bt === 'table')        return <Table block={block} folderPath={_folderPath} />
  if (bt === 'image' || bt === 'figure' || bt === 'map') return <Image block={block} folderPath={_folderPath} />
  if (bt === 'signature_block') return <Sig block={block} />
  if (bt === 'divider')      return <hr style={{border:'none',borderTop:'1px solid var(--rule-lt)',margin:'20px 0'}}/>
  if (bt === 'callout')      return <Callout block={block} />
  if (bt === 'audit_finding') return <AuditFinding block={block} />
  return null
}

// ── Paragraph ─────────────────────────────────────────────────
function Para({ block }: { block: ContentBlock }) {
  const rawText = ml_s(block.content.text as Record<string,string>)
  if (!rawText) return null
  const pt = block.content.para_type || 'normal'

  const base: React.CSSProperties = {
    textAlign: 'justify', hyphens: 'auto', marginBottom: '14px',
    fontSize: '16px', lineHeight: '1.75', color: 'var(--ink)', margin: '0',
  }
  const styles: Record<string, React.CSSProperties> = {
    finding:     {...base, borderLeft:'3px solid var(--red)',   paddingLeft:'14px'},
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

  const pnumHtml = block.para_number
    ? `<span style="font-family:system-ui;font-size:10.5px;color:var(--ink3);margin-right:8px">${block.para_number}</span>`
    : ''

  // Inject annotations first (as background), then footnote sups on top
  const fns  = getFnRefs(block.block_id || '')
  const anns = getAnns(block.block_id || '')
  const refs = getRefs(block.block_id || '')
  let html = safe(rawText)
  if (anns.length > 0) { html = injectAnnotations(html, anns, 0) }
  if (refs.length > 0) { html = injectRefs(html, refs) }
  if (fns.length > 0)  { html = injectAllSups(html, fns, 0) }

  return (
    <div style={{marginBottom:'14px'}}>
      {badge}
      <p style={style} dangerouslySetInnerHTML={{__html: pnumHtml + html}} />
    </div>
  )
}

// ── Heading ───────────────────────────────────────────────────
function Head({ block }: { block: ContentBlock }) {
  const text = ml_s(block.content.text as Record<string,string>)
  if (!text) return null
  const lv = Math.min(block.content.level || 2, 4)
  const styles: Record<number, React.CSSProperties> = {
    1: {fontSize:'20px',fontWeight:700,color:'var(--navy)',margin:'24px 0 10px'},
    2: {fontSize:'17px',fontWeight:700,color:'var(--navy)',margin:'20px 0 8px'},
    3: {fontSize:'15px',fontWeight:700,color:'var(--ink)',margin:'16px 0 6px'},
    4: {fontSize:'14px',fontWeight:700,color:'var(--ink2)',margin:'12px 0 4px'},
  }
  const Tag = `h${lv + 1}` as keyof JSX.IntrinsicElements
  return <Tag style={styles[lv]} dangerouslySetInnerHTML={{__html: safe(text)}}/>
}

// ── List ──────────────────────────────────────────────────────
function List({ block }: { block: ContentBlock }) {
  const items = (block.content.items || []) as ListItem[]
  if (!items.length) return null
  const lt   = block.content.list_type || 'unordered'
  const isOrd = lt === 'ordered' || lt === 'alpha' || lt === 'roman'
  const fns  = getFnRefs(block.block_id || '')

  // Build cumulative char offsets per item (builder: items joined by "\n")
  const itemOffsets: number[] = []
  let cum = 0
  items.forEach(item => {
    itemOffsets.push(cum)
    cum += stripTags(ml_s(item.text as Record<string,string>)).length + 1
  })

  return (
    <ul style={{listStyle:'none',padding:0,margin:'8px 0 16px 0'}}>
      {items.map((item, i) => {
        const rawText = ml_s(item.text as Record<string,string>)
        const itemStart = itemOffsets[i]
        const itemEnd   = itemStart + stripTags(rawText).length

        // Footnotes whose anchor falls within this item
        const itemFns = fns.filter(fn => {
          const end = fn.anchor_char_end || 0
          return end > itemStart && end <= itemEnd
        })

        const itemRefs = getRefs(block.block_id || '')
        let html = safe(rawText)
        if (itemRefs.length > 0) { html = injectRefs(html, itemRefs) }
        if (itemFns.length > 0)  { html = injectAllSups(html, itemFns, itemStart) }

        const subs = item.sub_items || []
        const pnum = item.para_number

        // Normalise ordered marker: strip trailing dot, always add one consistently
        const rawMarker = pnum || String(i + 1)
        const marker = isOrd ? rawMarker.replace(/\.+$/, '') + '.' : ''

        return (
          <li key={i} style={{display:'flex',gap:'10px',marginBottom:'10px',fontSize:'16px',lineHeight:'1.72',textAlign:'justify',alignItems:'baseline'}}>
            {isOrd
              ? <span style={{flexShrink:0,fontWeight:400,color:'var(--ink)',minWidth:'24px',textAlign:'right',fontFamily:'Georgia,"Times New Roman",serif',fontSize:'16px'}}>{marker}</span>
              : <span style={{flexShrink:0,width:'6px',height:'6px',borderRadius:'50%',background:'var(--ink2)',display:'inline-block',position:'relative',top:'0.18em'}}/>
            }
            <div style={{flex:1}}>
              {!isOrd && pnum && <span style={{fontFamily:'system-ui',fontSize:'10.5px',color:'var(--ink3)',marginRight:'8px'}}>{pnum}</span>}
              <span dangerouslySetInnerHTML={{__html: html}}/>
              {subs.length > 0 && (
                <ul style={{listStyle:'none',padding:0,margin:'6px 0 2px 18px'}}>
                  {subs.map((s: {text: Record<string,string>}, j: number) => (
                    <li key={j} style={{display:'flex',gap:'10px',fontSize:'14.5px',lineHeight:'1.65',marginBottom:'5px',color:'var(--ink2)'}}>
                      <span style={{color:'var(--ink3)',flexShrink:0}}>–</span>
                      <span dangerouslySetInnerHTML={{__html: safe(ml_s(s.text))}}/>
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
  const rawText = ml_s(block.content.text as Record<string,string>)
  if (!rawText) return null
  const fns = getFnRefs(block.block_id || '')
  let html = safe(rawText)
  if (fns.length > 0) html = injectAllSups(html, fns, 0)

  return (
    <div style={{margin:'16px 0',border:'1px solid #b8d4b8',borderLeft:'4px solid var(--green)',background:'var(--green-lt)',borderRadius:'0 5px 5px 0',padding:'14px 18px'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--green)',marginBottom:'5px'}}>Recommendation</div>
      {block.para_number && <span style={{fontFamily:'system-ui',fontSize:'10.5px',color:'var(--ink3)',marginRight:'8px'}}>{block.para_number}</span>}
      <div style={{fontSize:'16px',lineHeight:'1.7',textAlign:'justify'}} dangerouslySetInnerHTML={{__html: html}}/>
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
  const btype    = block.content.box_type || 'note'
  const st       = RB_STYLES[btype] || RB_STYLES.note
  const label    = RB_LABELS[btype] || btype.replace(/_/g,' ')
  const titleText = ml_s(block.content.title as Record<string,string>)
  const isDupTitle = titleText && titleText.toLowerCase().trim() === label.toLowerCase().trim()
  const body     = (block.content.body || []) as RichboxBodyItem[]
  const fns      = getFnRefs(block.block_id || '')
  const isInline = fns.some(fn => fn.display_scope === 'inline')

  // Compute cumulative char offsets across richbox body
  // getBlockText for richbox: each text part (paragraph, heading, bullet item) joined by "\n"
  const partOffsets: Array<{type:'para'|'bullet';itemIdx:number;bodyIdx:number;start:number;end:number}> = []
  let cum = 0
  body.forEach((item, bi) => {
    if (item.type === 'paragraph' || item.type === 'heading') {
      const t = stripTags(ml_s(item.text as Record<string,string>))
      if (t) {
        partOffsets.push({type:'para', itemIdx:0, bodyIdx:bi, start:cum, end:cum+t.length})
        cum += t.length + 1
      }
    } else if (item.type === 'bullets' || item.type === 'ordered_list') {
      ;(item.items || []).forEach((bi2: {text:Record<string,string>}, ii) => {
        const t = stripTags(ml_s(bi2.text))
        if (t) {
          partOffsets.push({type:'bullet', itemIdx:ii, bodyIdx:bi, start:cum, end:cum+t.length})
          cum += t.length + 1
        }
      })
    }
  })

  // For each body item, find which fns fall in it
  function getFnsForPart(start: number, end: number): FnRef[] {
    return fns.filter(fn => {
      const e = fn.anchor_char_end || 0
      return e > start && e <= end
    })
  }

  return (
    <div style={{margin:'18px 0',borderRadius:'4px',overflow:'hidden',border:`1px solid ${st.border}`}}>
      <div style={{padding:'9px 16px',background:st.head,display:'flex',alignItems:'center',gap:'8px'}}>
        <span>{st.icon}</span>
        <span style={{fontFamily:'system-ui',fontSize:'11.5px',fontWeight:700,color:st.label}}>{label}</span>
      </div>
      <div style={{padding:'14px 18px',background:'#fff',fontSize:'16px',lineHeight:'1.72'}}>
        {titleText && !isDupTitle && (
          <div style={{fontWeight:700,fontSize:'15.5px',marginBottom:'10px',paddingBottom:'7px',borderBottom:'1px solid rgba(0,0,0,.07)'}}
               dangerouslySetInnerHTML={{__html: safe(titleText)}}/>
        )}
        {body.map((item, bi) => {
          const po = partOffsets.filter(p => p.bodyIdx === bi)
          return <RBItem key={bi} item={item} partOffsets={po} getFnsForPart={getFnsForPart}/>
        })}
        {/* Inline footnotes rendered inside richbox */}
        {isInline && (
          <div style={{marginTop:'10px',paddingTop:'8px',borderTop:'1px solid rgba(0,0,0,.06)'}}>
            {fns.filter(fn => fn.display_scope === 'inline').map((fn, i) => {
              // Text from _fnIdx we stored — look up from global
              const text = getInlineFnText(fn)
              return (
                <div key={i} id={`fn-${fn.footnote_id||fn.marker}`} style={{display:'flex',gap:'6px',marginBottom:'4px',fontSize:'13px'}}>
                  <a href={`#fnref-${fn.footnote_id||fn.marker}`} style={{color:'#8b1a1a',fontWeight:700,flexShrink:0,fontFamily:'system-ui',fontSize:'13px',textDecoration:'none'}}>{fn.marker}</a>
                  <span style={{color:'#444'}}>{text}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Store inline fn text lookup - populated by ReaderClient
let _inlineFnText: Record<string, string> = {}
export function setInlineFnText(map: Record<string, string>) { _inlineFnText = map }
function getInlineFnText(fn: FnRef): string {
  return _inlineFnText[fn.footnote_id || fn.marker] || ''
}

function RBItem({ item, partOffsets, getFnsForPart }: {
  item: RichboxBodyItem
  partOffsets: Array<{type:string;itemIdx:number;bodyIdx:number;start:number;end:number}>
  getFnsForPart: (start:number, end:number) => FnRef[]
}) {
  if (item.type === 'paragraph') {
    const po = partOffsets[0]
    const fnsHere = po ? getFnsForPart(po.start, po.end) : []
    let html = safe(ml_s(item.text as Record<string,string>))
    if (fnsHere.length > 0) html = injectAllSups(html, fnsHere, po.start)
    return <p style={{marginBottom:'8px',textAlign:'justify',fontFamily:'Georgia,"Times New Roman",serif'}} dangerouslySetInnerHTML={{__html: html}}/>
  }
  if (item.type === 'heading') {
    return <div style={{fontWeight:700,margin:'10px 0 6px',fontSize:'15px'}} dangerouslySetInnerHTML={{__html: safe(ml_s(item.text as Record<string,string>))}}/>
  }
  if (item.type === 'bullets' || item.type === 'ordered_list') {
    const isOrd = item.type === 'ordered_list'
    return (
      <ul style={{listStyle:isOrd?'decimal':'disc',margin:'6px 0 10px 22px',padding:'0 0 0 4px',fontSize:'15px'}}>
        {(item.items||[]).map((bi: {text:Record<string,string>}, j: number) => {
          const po = partOffsets.find(p => p.itemIdx === j)
          const fnsHere = po ? getFnsForPart(po.start, po.end) : []
          let html = safe(ml_s(bi.text))
          if (fnsHere.length > 0) html = injectAllSups(html, fnsHere, po!.start)
          return <li key={j} style={{marginBottom:'6px',textAlign:'justify',lineHeight:1.7}} dangerouslySetInnerHTML={{__html: html}}/>
        })}
      </ul>
    )
  }
  if (item.type === 'image') {
    const img = item as unknown as Record<string,unknown>
    const assetRef = img.asset_ref as string | undefined
    const caption  = ml_s(img.caption as Record<string,string>)
    const alt      = ml_s(img.alt_text as Record<string,string>) || caption || 'Figure'
    const assetPath = (assetRef && _folderPath) ? `${_folderPath}/${assetRef}`.replace(/^\//, '') : ''
    const src = assetPath ? `/api/asset?path=${encodeURIComponent(assetPath)}` : ''
    return (
      <figure style={{margin:'12px 0'}}>
        <div style={{border:'2px solid #1a3a6b',borderRadius:'6px',overflow:'hidden',background:'#f8f8f8'}}>
          {src
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={src} alt={alt} style={{width:'100%',display:'block'}}/>
            : <div style={{padding:'24px',textAlign:'center',color:'#aaa',fontFamily:'system-ui',fontSize:'12px'}}>
                <div style={{fontSize:'24px',marginBottom:'4px'}}>🖼</div>
                <div>{assetRef||'Image'}</div>
              </div>
          }
        </div>
        {caption && <figcaption style={{fontSize:'12px',fontStyle:'italic',color:'#888',textAlign:'center',marginTop:'5px'}}>{caption}</figcaption>}
      </figure>
    )
  }
  return null
}

// ── Table ─────────────────────────────────────────────────────
interface DatasetCol { id: string; label: Record<string,string>|string; data_type?: string; align?: string }
interface DatasetRow { row_id?: string; row_type?: string; style?: string; cells: Record<string,unknown> }
interface DsFn { marker:string; text:Record<string,string>|string; anchor_row_id?:string; anchor_col_id?:string }
interface DatasetJson {
  columns: DatasetCol[]; data: DatasetRow[]
  header_rows?: unknown[]
  footnotes?: DsFn[]
  unit?: string
  notes?: Record<string,string> | string
}

function Table({ block, folderPath }: { block: ContentBlock; folderPath?: string }) {
  const caption  = ml_s(block.content.caption as Record<string,string>)
  const tableNum = block.content.table_number as string | undefined
  const unitNote = ml_s(block.content.unit_note as Record<string,string>)
  const source   = ml_s(block.content.source as Record<string,string>)
  const dsRef    = block.content.dataset_ref as string | undefined
  const [ds, setDs] = React.useState<DatasetJson | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!dsRef || !folderPath) return
    setLoading(true)
    fetch(`/api/dataset?folder=${encodeURIComponent(folderPath)}&id=${encodeURIComponent(dsRef)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDs(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dsRef, folderPath])

  return (
    <div style={{margin:'24px 0',borderRadius:'8px',border:'2px solid #1a3a6b',overflow:'hidden',background:'#fff',boxShadow:'0 2px 12px rgba(26,58,107,.07)'}}>
      {(tableNum || caption) && (
        <div style={{display:'flex',alignItems:'baseline',gap:'10px',padding:'12px 14px 0'}}>
          {tableNum && <span style={{fontFamily:'system-ui',fontSize:'10px',fontWeight:700,background:'var(--navy)',color:'#fff',padding:'2px 7px',borderRadius:'3px',flexShrink:0}}>Table {tableNum}</span>}
          {caption && <span style={{fontSize:'13.5px',fontWeight:600,color:'var(--ink2)'}}>{caption}</span>}
        </div>
      )}
      {ds?.unit && <div style={{fontFamily:'system-ui',fontSize:'11px',color:'var(--ink3)',fontStyle:'italic',textAlign:'right',padding:'4px 14px 0'}}>({ds.unit})</div>}
      {!ds?.unit && unitNote && <div style={{fontFamily:'system-ui',fontSize:'11px',color:'var(--ink3)',fontStyle:'italic',textAlign:'right',padding:'4px 14px 0'}}>{unitNote}</div>}

      {ds ? (
        <DatasetTable ds={ds}/>
      ) : (
        <div style={{padding:'14px',textAlign:'center',background:'#f9f9f9',fontFamily:'system-ui',fontSize:'12px',color:'var(--ink3)'}}>
          {loading ? '⏳ Loading table…' : dsRef ? `📊 ${dsRef}` : '📊 No dataset'}
        </div>
      )}

      {source && <div style={{fontFamily:'system-ui',fontSize:'11px',color:'#666',padding:'6px 14px 4px',borderTop:'1px solid #e8e4dc'}}><b>Source:</b> {source}</div>}
      {ds?.notes && <div style={{fontFamily:'Georgia,serif',fontSize:'12.5px',color:'#555',padding:'4px 14px 10px',fontStyle:'italic',textAlign:'justify'}}>{ml_s(ds.notes as Record<string,string>|string)}</div>}

      {/* Dataset footnotes inside the card */}
      {ds?.footnotes && ds.footnotes.length > 0 && (
        <div style={{padding:'8px 14px 12px',borderTop:'1px solid #e8e4dc'}}>
          {ds.footnotes.map((fn, fi) => {
            const text = ml_s(fn.text as Record<string,string>|string)
            const fnId = `tbl-fn-${fi}-${fn.marker}`
            return (
              <div key={fi} id={fnId} style={{display:'flex',gap:'8px',marginBottom:'6px',fontSize:'13px',lineHeight:1.6,scrollMarginTop:'20px'}}>
                <span onClick={()=>{const id='cellfn-'+(fn.anchor_row_id||'')+(fn.anchor_row_id&&fn.anchor_col_id?'-':'')+fn.anchor_col_id;const el=id.length>7?document.getElementById(id):null;if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}} style={{color:'#8b1a1a',fontWeight:700,flexShrink:0,fontFamily:'system-ui',fontSize:'13px',minWidth:'18px',cursor:fn.anchor_row_id?'pointer':'default'}}>{fn.marker}</span>
                <span style={{color:'#444',textAlign:'justify',display:'block',fontFamily:'Georgia,"Times New Roman",serif'}}>{text}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DatasetTable({ ds }: { ds: DatasetJson }) {
  const cols = ds.columns || []
  const rows = ds.data    || []

  function isNum(dt?: string) { return ['integer','float','decimal','currency','percentage'].includes(dt||'') }
  function fmtVal(val: unknown, dt?: string): string {
    if (val === null || val === undefined || val === '') return '—'
    const n = Number(val)
    if (dt === 'currency')  return isNaN(n) ? String(val) : '₹ ' + n.toLocaleString('en-IN')
    if (dt === 'percentage') return String(val) + '%'
    if (dt === 'integer')   return isNaN(n) ? String(val) : n.toLocaleString('en-IN')
    if (dt === 'decimal' || dt === 'float') return isNaN(n) ? String(val) : n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})
    return String(val)
  }

  // Build footnote marker lookup: row_id+col_id → marker
  const fnMarkers: Record<string,string> = {}
  ;(ds.footnotes||[]).forEach(fn => {
    if (fn.anchor_row_id && fn.anchor_col_id) {
      fnMarkers[`${fn.anchor_row_id}|${fn.anchor_col_id}`] = fn.marker
    }
  })

  const thStyle: React.CSSProperties = {background:'var(--navy)',color:'#fff',padding:'8px 10px',fontSize:'12px',fontWeight:600,textAlign:'left',borderRight:'1px solid rgba(255,255,255,.15)',verticalAlign:'bottom',lineHeight:1.4}
  const tdStyle: React.CSSProperties = {padding:'7px 10px',borderBottom:'1px solid var(--rule-lt)',borderRight:'1px solid var(--rule-lt)',fontSize:'13px',color:'var(--ink)',lineHeight:1.45}

  // Build thead: use header_rows if present, else fall back to flat columns row
  interface HdrCell {
    label?: Record<string,string>|string
    colspan?: number
    rowspan?: number
    col_ids?: string[]
    style?: string
  }

  const headerRows = ds.header_rows as HdrCell[][] | undefined

  function renderThead() {
    if (headerRows && headerRows.length > 0) {
      // Track remaining rowspan for each col_id
      const rowspanRemaining: Record<string, number> = {}
      return headerRows.map((hrow, ri) => (
        <tr key={ri}>
          {hrow.map((cell, ci) => {
            // Skip cells covered by a previous rowspan
            const colId = (cell.col_ids || [])[0] || ''
            if (colId && rowspanRemaining[colId] > 0) {
              rowspanRemaining[colId]--
              return null
            }
            const cs = cell.colspan && cell.colspan > 1 ? cell.colspan : undefined
            const rs = cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined
            const isGroup = cell.style === 'group'
            const label = ml_s(cell.label as Record<string,string>|string)
            // Register rowspan for affected col_ids
            if (rs && rs > 1) {
              (cell.col_ids || []).forEach(cid => { rowspanRemaining[cid] = (rowspanRemaining[cid] || 0) + rs - 1 })
            }
            return (
              <th key={ci}
                colSpan={cs}
                rowSpan={rs}
                style={{
                  ...thStyle,
                  textAlign: isGroup ? 'center' : 'left',
                  borderBottom: ri < headerRows.length - 1 ? '1px solid rgba(255,255,255,.2)' : undefined,
                  whiteSpace: 'pre-line',
                }}>
                {label}
              </th>
            )
          })}
        </tr>
      ))
    }
    // Fallback: flat column headers
    return (
      <tr>
        {cols.map(col => (
          <th key={col.id} style={{...thStyle, textAlign:(col.align||(isNum(col.data_type)?'right':'left')) as React.CSSProperties['textAlign']}}>
            {ml_s(col.label as Record<string,string>|string)}
          </th>
        ))}
      </tr>
    )
  }

  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
        <thead>
          {renderThead()}
        </thead>
        <tbody>
          {rows.map((row, ri)=>{
            const rt = row.row_type || 'data'
            const isTotal  = rt==='total'||rt==='grand_total'
            const isSubHdr = rt==='header'
            const rowStyle: React.CSSProperties = isTotal
              ? {fontWeight:700,borderTop:'2px solid var(--navy)',background:'#edf1f8'}
              : isSubHdr ? {fontWeight:700,background:'#d4dcec',fontSize:'12.5px'}
              : ri%2===1 ? {background:'#f8f8f5'} : {}
            if (row.style==='bold') (rowStyle as Record<string,unknown>).fontWeight = 700
            return (
              <tr key={ri} style={rowStyle}>
                {(() => {
                  // Render cells respecting colspan — skip cols already covered
                  const rendered: React.ReactNode[] = []
                  let skipCols = 0
                  cols.forEach((col, ci) => {
                    if (skipCols > 0) { skipCols--; return }
                    const cell = row.cells?.[col.id]
                    const cellObj = (cell !== null && typeof cell === 'object' && !Array.isArray(cell))
                      ? cell as Record<string,unknown>
                      : {value: cell}
                    const cs = typeof cellObj.colspan === 'number' && cellObj.colspan > 1 ? cellObj.colspan : undefined
                    const rs = typeof cellObj.rowspan === 'number' && cellObj.rowspan > 1 ? cellObj.rowspan : undefined
                    if (cs) skipCols = cs - 1
                    const align = cs ? 'center' : (col.align||(isNum(col.data_type)?'right':'left'))
                    let display = ''
                    if (cellObj.nil_marker) display = 'nil'
                    else if (cellObj.display) display = ml_s(cellObj.display as Record<string,string>|string)
                    else display = fmtVal(cellObj.value, col.data_type)
                    if (cellObj.is_negative) display = `(${display})`

                    // Footnote marker in cell
                    const fnMark = row.row_id ? fnMarkers[`${row.row_id}|${col.id}`] : undefined
                    const fnIdx2 = (ds.footnotes||[]).findIndex(f => f.marker === fnMark)
                    const fnId2 = `tbl-fn-${fnIdx2}-${fnMark}`
                    const cellAnchorId = row.row_id ? 'cellfn-' + row.row_id + '-' + col.id : ''
                    const fnSup = fnMark
                      ? '<sup' + (cellAnchorId ? ' id="' + cellAnchorId + '"' : '') + ' style="color:#8b1a1a;font-size:13px;font-weight:700;font-family:system-ui;cursor:pointer"><a href="#' + fnId2 + '" style="color:#8b1a1a;text-decoration:none">' + fnMark + '</a></sup>'
                      : ''

                    rendered.push(
                      <td key={col.id} colSpan={cs} rowSpan={rs}
                        style={{
                          ...tdStyle,
                          textAlign: align as React.CSSProperties['textAlign'],
                          fontWeight: cellObj.style==='bold' || isSubHdr ? 700 : undefined,
                          background: cs && isSubHdr ? '#d4dcec' : undefined,
                        }}>
                        <span dangerouslySetInnerHTML={{__html: safe(display) + fnSup}}/>
                      </td>
                    )
                  })
                  return rendered
                })()}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Image ─────────────────────────────────────────────────────
function Image({ block, folderPath }: { block: ContentBlock; folderPath?: string }) {
  const caption  = ml_s(block.content.caption as Record<string,string>)
  const alt      = ml_s(block.content.alt_text as Record<string,string>) || caption || 'Figure'
  const assetRef = block.content.asset_ref as string | undefined
  const [imgSrc, setImgSrc] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!assetRef || !folderPath) return
    const assetPath = `${folderPath}/${assetRef}`.replace(/^\//, '')
    setImgSrc(`/api/asset?path=${encodeURIComponent(assetPath)}`)
  }, [assetRef, folderPath])

  return (
    <figure style={{margin:'24px 0'}}>
      <div style={{border:'2px solid #1a3a6b',borderRadius:'8px',overflow:'hidden',background:'#fff',boxShadow:'0 2px 12px rgba(26,58,107,.07)'}}>
        {imgSrc
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imgSrc} alt={alt} style={{width:'100%',display:'block'}}/>
          : <div style={{padding:'28px 16px',textAlign:'center',color:'#aaa',background:'#f9f8f6'}}>
              <div style={{fontSize:'28px',marginBottom:'6px'}}>🖼</div>
              <div style={{fontFamily:'system-ui',fontSize:'12px',color:'#888'}}>{assetRef||'Image'}</div>
            </div>
        }
        {caption && (
          <div style={{borderTop:'1px solid #e8e4dc',padding:'8px 14px',fontFamily:'system-ui',fontSize:'12px',fontStyle:'italic',color:'#666',textAlign:'center',background:'#fafaf8'}}>
            {caption}
          </div>
        )}
      </div>
    </figure>
  )
}

// ── Signature block ───────────────────────────────────────────
function Sig({ block }: { block: ContentBlock }) {
  const sigs = (block.content.signatories || []) as Array<{
    role?: string; name?: Record<string,string>|string
    designation?: Record<string,string>|string; date?: string; place?: Record<string,string>|string
  }>
  function getRole(role?: string): string {
    if (!role) return ''
    const map: Record<string,string> = {signed_by:'Signed by',countersigned_by:'Countersigned by',verified_by:'Verified by'}
    return map[role] || role.replace(/:+$/, '').trim()
  }
  if (!sigs.length) return null
  return (
    <div style={{margin:'24px 0',padding:'16px',border:'1px solid var(--rule)',borderRadius:'4px',background:'#fafaf8'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'#aaa',marginBottom:'14px'}}>Signatures</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'20px'}}>
        {sigs.map((s, i) => (
          <div key={i} style={{flex:1,minWidth:'200px'}}>
            <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--ink3)',marginBottom:'6px'}}>{getRole(s.role)}</div>
            <div style={{height:'48px',borderBottom:'1px solid var(--rule)',marginBottom:'8px'}}/>
            <div style={{fontSize:'15px',fontWeight:700}}>{ml_s(s.name)}</div>
            {s.designation && <div style={{fontSize:'13px',color:'var(--ink2)',marginTop:'2px'}}>{ml_s(s.designation)}</div>}
            {s.date && <div style={{fontFamily:'system-ui',fontSize:'12px',color:'var(--ink3)',marginTop:'3px'}}>{s.date}</div>}
            {s.place && <div style={{fontFamily:'system-ui',fontSize:'12px',color:'var(--ink3)'}}>{ml_s(s.place)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Callout ───────────────────────────────────────────────────
function Callout({ block }: { block: ContentBlock }) {
  const ct    = (block.content as Record<string,unknown>).callout_type as string || 'note'
  const title = ml_s((block.content as Record<string,unknown>).title as Record<string,string>)
  const text  = ml_s(block.content.text as Record<string,string>)
  return (
    <div style={{borderLeft:'4px solid var(--navy)',background:'var(--navy-lt)',padding:'10px 16px',margin:'14px 0',borderRadius:'0 4px 4px 0'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--navy)',marginBottom:'4px'}}>{ct.replace(/_/g,' ')}</div>
      {title && <div style={{fontWeight:700,marginBottom:'4px'}} dangerouslySetInnerHTML={{__html:safe(title)}}/>}
      <div dangerouslySetInnerHTML={{__html:safe(text)}}/>
    </div>
  )
}

// ── Audit finding ─────────────────────────────────────────────
function AuditFinding({ block }: { block: ContentBlock }) {
  const c = block.content as Record<string,unknown>
  const obs = ml_s(c.observation as Record<string,string>)
  const titleStr = c.title ? ml_s(c.title as Record<string,string>) : ''
  const effectStr = c.effect ? ml_s(c.effect as Record<string,string>) : ''
  return (
    <div style={{border:'1px solid #e8b8b8',background:'#fdf5f5',borderRadius:'4px',borderLeft:'4px solid #8b1a1a',padding:'12px 16px',margin:'14px 0'}}>
      <div style={{fontFamily:'system-ui',fontSize:'9px',fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',color:'#8b1a1a',marginBottom:'6px'}}>
        Audit Finding{block.para_number ? ` · Para ${block.para_number}` : ''}
      </div>
      {titleStr && <div style={{fontWeight:700,marginBottom:'8px',fontSize:'15px'}} dangerouslySetInnerHTML={{__html:safe(titleStr)}}/>}
      <div dangerouslySetInnerHTML={{__html:safe(obs)}}/>
      {effectStr && <div style={{marginTop:'8px'}}><b>Effect:</b> <span dangerouslySetInnerHTML={{__html:safe(effectStr)}}/></div>}
    </div>
  )
}
