'use client'
// FiltersPanel.tsx v3
// archive.org-style faceted filters.
// Counts always reflect the CURRENT result set (server-computed).
// Include = narrow results to this value. Exclude = remove this value.
// Every selection triggers a full page reload → server recomputes everything.

import React, { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FilterOption {
  value: string
  label: string
  count: number
}
export interface SectorGroup {
  parentValue: string
  parentLabel: string
  parentCount?: number
  options:     FilterOption[]
}
export interface FilterDef {
  key:      string
  label:    string
  options?: FilterOption[]   // flat
  groups?:  SectorGroup[]    // hierarchical (sector)
  maxShown?: number          // default 8
}

// ─── URL helpers ──────────────────────────────────────────────────────────────
function enc(mode: 'inc'|'exc', v: string) { return mode === 'exc' ? '-'+v : v }
function dec(raw: string): { mode:'inc'|'exc'; value:string } {
  return raw.startsWith('-') ? { mode:'exc', value:raw.slice(1) } : { mode:'inc', value:raw }
}

// ─── Component ────────────────────────────────────────────────────────────────
// Filter keys that are user-controlled (not jurisdiction/state/topic)
const USER_FILTER_KEYS = ['year', 'audit_type', 'sector', 'language']

export default function FiltersPanel({
  filters, totalCount, activeParams = {}, labelMap = {},
}: {
  filters:      FilterDef[]
  totalCount:   number
  activeParams?: Record<string, string | string[] | undefined>
  labelMap?:    Record<string, string>   // key:value → display label
}) {
  const router  = useRouter()
  const path    = usePathname()
  const sp      = useSearchParams()

  // Collect active filters for chip display.
  // Uses URL searchParams directly so chips always show even when results = 0.
  const active: { key:string; value:string; label:string; mode:'inc'|'exc' }[] = []
  const optLabelMap: Record<string, string> = {}
  for (const f of filters) {
    const opts = [...(f.options||[]), ...(f.groups?.flatMap(g=>[
      ...(g.parentCount !== undefined ? [{ value:g.parentValue, label:g.parentLabel, count:g.parentCount }] : []),
      ...g.options,
    ])||[])]
    for (const o of opts) optLabelMap[f.key + ':' + o.value] = o.label
  }
  for (const key of USER_FILTER_KEYS) {
    for (const raw of sp.getAll(key)) {
      const { mode, value } = dec(raw)
      const label = labelMap[key + ':' + value] || optLabelMap[key + ':' + value] || value
      active.push({ key, value, label, mode })
    }
  }

  function buildUrl(updates: Record<string,string[]>) {
    const p = new URLSearchParams(sp.toString())
    for (const k of Object.keys(updates)) p.delete(k)
    for (const [k, vals] of Object.entries(updates)) for (const v of vals) p.append(k, v)
    return path + '?' + p.toString()
  }

  function toggle(key: string, value: string, mode: 'inc'|'exc') {
    const cur     = sp.getAll(key)
    const encoded = enc(mode, value)
    const opposite = enc(mode==='inc'?'exc':'inc', value)
    let next: string[]
    if (cur.includes(encoded)) {
      // deselect
      next = cur.filter(v => v !== encoded)
    } else {
      // select, removing opposite if present
      next = cur.filter(v => v !== opposite)
      next.push(encoded)
    }
    router.push(buildUrl({ [key]: next }))
  }

  function remove(key: string, value: string) {
    router.push(buildUrl({ [key]: sp.getAll(key).filter(v => dec(v).value !== value) }))
  }

  function clearAll() {
    const p = new URLSearchParams(sp.toString())
    // Use static key list — not filters prop (which is empty when results = 0)
    for (const key of USER_FILTER_KEYS) p.delete(key)
    router.push(path + '?' + p.toString())
  }

  function getState(key: string, value: string): 'inc'|'exc'|null {
    for (const raw of sp.getAll(key)) {
      const d = dec(raw)
      if (d.value === value) return d.mode
    }
    return null
  }

  return (
    <aside style={{ width: 210, flexShrink: 0 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700, letterSpacing:'1px',
                       textTransform:'uppercase', color:'var(--ink3)' }}>
          Filters
        </span>
        {active.length > 0 && (
          <button onClick={clearAll} style={{ fontFamily:'system-ui', fontSize:10, fontWeight:600,
            color:'var(--red)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
            Clear all
          </button>
        )}
      </div>

      {/* Active chips */}
      {active.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:14 }}>
          {active.map(a => (
            <span key={a.key+a.value+a.mode} style={{
              display:'inline-flex', alignItems:'center', gap:3,
              fontFamily:'system-ui', fontSize:10, fontWeight:600,
              padding:'2px 7px', borderRadius:10, maxWidth:190,
              background: a.mode==='exc' ? '#fff0f0' : 'var(--navy-lt)',
              color:      a.mode==='exc' ? '#cc3333' : 'var(--navy)',
              border:'1px solid '+(a.mode==='exc'?'#ffbbbb':'rgba(26,58,107,.2)'),
            }}>
              {a.mode==='exc' && <span style={{fontSize:8,flexShrink:0}}>✕</span>}
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.label}</span>
              <button onClick={()=>remove(a.key,a.value)} style={{
                background:'none',border:'none',cursor:'pointer',fontSize:11,
                lineHeight:1,color:'inherit',padding:0,flexShrink:0,
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Count */}
      <div style={{ fontFamily:'system-ui', fontSize:12, color:'var(--ink3)',
                    marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--rule)' }}>
        <strong style={{color:'var(--navy)'}}>{totalCount.toLocaleString('en-IN')}</strong>
        {' '}result{totalCount!==1?'s':''}
      </div>

      {/* Each filter */}
      {filters.map(f => (
        <FilterSection key={f.key} def={f} getState={getState} toggle={toggle} />
      ))}
    </aside>
  )
}

// ─── One filter section ───────────────────────────────────────────────────────
function FilterSection({ def, getState, toggle }: {
  def:      FilterDef
  getState: (k:string, v:string) => 'inc'|'exc'|null
  toggle:   (k:string, v:string, m:'inc'|'exc') => void
}) {
  const maxShown = def.maxShown ?? 8
  const [expanded, setExpanded] = useState(false)

  const hasActive = [
    ...(def.options||[]),
    ...(def.groups?.flatMap(g=>[{value:g.parentValue},...g.options])||[]),
  ].some(o => getState(def.key, o.value) !== null)

  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
        <span style={{ fontFamily:'system-ui', fontSize:10, fontWeight:700, letterSpacing:'.6px',
                       textTransform:'uppercase', color: hasActive ? 'var(--navy)' : 'var(--ink3)' }}>
          {def.label}
        </span>
        {hasActive && <span style={{width:5,height:5,borderRadius:'50%',background:'var(--navy)',display:'inline-block'}}/>}
      </div>

      {/* Flat */}
      {def.options && (() => {
        const shown = expanded ? def.options : def.options.slice(0, maxShown)
        const hasMore = def.options.length > maxShown
        return (
          <>
            <div style={{display:'flex',flexDirection:'column',gap:1}}>
              {shown.map(opt => (
                <OptionRow key={opt.value} opt={opt} filterKey={def.key}
                  state={getState(def.key, opt.value)} toggle={toggle} />
              ))}
            </div>
            {hasMore && (
              <button onClick={()=>setExpanded(v=>!v)} style={{
                marginTop:4, fontFamily:'system-ui', fontSize:10.5, fontWeight:600,
                color:'var(--navy)', background:'none', border:'none', cursor:'pointer', padding:'2px 0',
              }}>
                {expanded ? '↑ less' : `↓ ${def.options.length - maxShown} more`}
              </button>
            )}
          </>
        )
      })()}

      {/* Grouped (sector) */}
      {def.groups && (
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {def.groups.map(g => (
            <SectorGroupRow key={g.parentValue} group={g} filterKey={def.key}
              getState={getState} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sector parent + collapsible children ─────────────────────────────────────
function SectorGroupRow({ group, filterKey, getState, toggle }: {
  group:     SectorGroup
  filterKey: string
  getState:  (k:string, v:string) => 'inc'|'exc'|null
  toggle:    (k:string, v:string, m:'inc'|'exc') => void
}) {
  const pState = getState(filterKey, group.parentValue)
  const anyChildActive = group.options.some(o => getState(filterKey, o.value) !== null)
  const [open, setOpen] = useState(pState !== null || anyChildActive)

  return (
    <div style={{ border:'1px solid var(--rule-lt)', borderRadius:7, overflow:'hidden' }}>
      {/* Parent row */}
      <div style={{ display:'flex', alignItems:'stretch',
                    background: (pState || anyChildActive) ? 'var(--navy-lt)' : '#fafbfc' }}>
        <button onClick={()=>setOpen(v=>!v)} style={{
          padding:'5px 7px', background:'none', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', flexShrink:0,
          borderRight:'1px solid var(--rule-lt)',
        }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
            style={{transition:'transform .15s', transform: open?'rotate(0deg)':'rotate(-90deg)'}}>
            <path d="M1 3l3.5 3L8 3" stroke="var(--ink3)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{flex:1, minWidth:0}}>
          {group.parentCount !== undefined ? (
            <OptionRow
              opt={{ value:group.parentValue, label:group.parentLabel, count:group.parentCount }}
              filterKey={filterKey} state={pState} toggle={toggle}
            />
          ) : (
            <div style={{ padding:'6px 8px', fontFamily:'system-ui', fontSize:11.5,
                          fontWeight:600, color:'var(--ink)' }}>
              {group.parentLabel}
            </div>
          )}
        </div>
      </div>
      {/* Children */}
      {open && group.options.length > 0 && (
        <div style={{ background:'#fff', borderTop:'1px solid var(--rule-lt)' }}>
          {group.options.map(opt => (
            <div key={opt.value} style={{paddingLeft:12}}>
              <OptionRow opt={opt} filterKey={filterKey}
                state={getState(filterKey, opt.value)} toggle={toggle} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single option row ────────────────────────────────────────────────────────
function OptionRow({ opt, filterKey, state, toggle }: {
  opt:       FilterOption
  filterKey: string
  state:     'inc'|'exc'|null
  toggle:    (k:string, v:string, m:'inc'|'exc') => void
}) {
  const [hov, setHov] = useState(false)
  const isInc = state === 'inc'
  const isExc = state === 'exc'

  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        display:'flex', alignItems:'center',
        background: isInc ? 'var(--navy-lt)' : isExc ? '#fff5f5' : 'transparent',
        borderRadius:5, transition:'background .1s',
      }}
    >
      {/* Include button */}
      <button onClick={()=>toggle(filterKey, opt.value, 'inc')} style={{
        flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6,
        padding:'5px 6px', background:'none', border:'none', cursor:'pointer', textAlign:'left',
      }}>
        {/* Checkbox */}
        <span style={{
          width:12, height:12, borderRadius:3, flexShrink:0,
          border:'1.5px solid '+(isInc?'var(--navy)':isExc?'#cc4444':'#ccc'),
          background: isInc ? 'var(--navy)' : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {isInc && <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
            <path d="M1 3.5l1.8 1.8 3-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>}
          {isExc && <span style={{fontSize:9,color:'#cc4444',lineHeight:1}}>−</span>}
        </span>
        {/* Label — truncates, never hides exclude button */}
        <span style={{
          fontFamily:'system-ui', fontSize:11.5, flex:1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          color: isInc?'var(--navy)':isExc?'#cc4444':'var(--ink)',
          fontWeight: (isInc||isExc) ? 600 : 400,
        }}>
          {opt.label}
        </span>
        {/* Count */}
        <span style={{ fontFamily:'system-ui', fontSize:10, color:'var(--ink3)', flexShrink:0 }}>
          {opt.count}
        </span>
      </button>

      {/* Exclude button — fixed 24px, always right, shows on hover or when active */}
      <button
        onClick={()=>toggle(filterKey, opt.value, 'exc')}
        title={isExc ? 'Remove exclusion' : 'Exclude'}
        style={{
          width:24, height:24, flexShrink:0, padding:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'none', border:'none', cursor:'pointer',
          color: isExc ? '#cc4444' : '#bbb',
          opacity: (hov||isExc) ? 1 : 0,
          transition:'opacity .1s, color .1s',
          fontSize:12, borderRadius:4,
        }}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color='#cc4444'}
        onMouseLeave={e=>{ if(!isExc)(e.currentTarget as HTMLElement).style.color='#bbb' }}
      >
        {isExc ? '✕' : '⊘'}
      </button>
    </div>
  )
}
