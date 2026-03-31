'use client'
// FiltersPanel.tsx v2
// - Exclude button always visible (icon only, no text overflow)
// - Inter-dependent: options disabled when they produce 0 results given active filters
// - Hierarchical sector support via grouped FilterDef

import React, { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FilterOption {
  value:    string
  label:    string
  count?:   number   // count WITH current filters applied — 0 means no results
  disabled?: boolean  // true when 0 results would remain
}

export interface FilterGroup {
  parentValue: string
  parentLabel: string
  options:     FilterOption[]
}

export interface FilterDef {
  key:        string
  label:      string
  options?:   FilterOption[]   // flat list
  groups?:    FilterGroup[]    // hierarchical (sector)
  maxShown?:  number           // default 8
}

// ─── URL helpers ──────────────────────────────────────────────────────────────
function encodeVal(mode: 'inc' | 'exc', v: string) {
  return mode === 'exc' ? '-' + v : v
}
function decodeVal(raw: string): { mode: 'inc' | 'exc'; value: string } {
  return raw.startsWith('-')
    ? { mode: 'exc', value: raw.slice(1) }
    : { mode: 'inc', value: raw }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FiltersPanel({
  filters,
  totalCount,
}: {
  filters:    FilterDef[]
  totalCount: number
}) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  // Collect all active filters for chip display
  const active: { key: string; value: string; label: string; mode: 'inc' | 'exc' }[] = []
  for (const f of filters) {
    const allOpts = [
      ...(f.options || []),
      ...(f.groups || []).flatMap(g => g.options),
    ]
    for (const raw of searchParams.getAll(f.key)) {
      const { mode, value } = decodeVal(raw)
      const opt = allOpts.find(o => o.value === value)
      if (opt) active.push({ key: f.key, value, label: opt.label, mode })
    }
  }

  const buildUrl = (updates: Record<string, string[]>) => {
    const p = new URLSearchParams(searchParams.toString())
    for (const key of Object.keys(updates)) p.delete(key)
    for (const [key, vals] of Object.entries(updates))
      for (const v of vals) p.append(key, v)
    return pathname + '?' + p.toString()
  }

  const toggle = (key: string, value: string, mode: 'inc' | 'exc') => {
    const cur     = searchParams.getAll(key)
    const encoded = encodeVal(mode, value)
    const opposite = encodeVal(mode === 'inc' ? 'exc' : 'inc', value)
    let next: string[]
    if (cur.includes(encoded)) {
      next = cur.filter(v => v !== encoded)
    } else {
      next = cur.filter(v => v !== opposite)
      next.push(encoded)
    }
    router.push(buildUrl({ [key]: next }))
  }

  const remove = (key: string, value: string) => {
    const next = searchParams.getAll(key)
      .filter(v => decodeVal(v).value !== value)
    router.push(buildUrl({ [key]: next }))
  }

  const clearAll = () => {
    const p = new URLSearchParams(searchParams.toString())
    for (const f of filters) p.delete(f.key)
    router.push(pathname + '?' + p.toString())
  }

  const getState = (key: string, value: string): 'inc' | 'exc' | null => {
    for (const raw of searchParams.getAll(key)) {
      const d = decodeVal(raw)
      if (d.value === value) return d.mode
    }
    return null
  }

  return (
    <aside style={{ width: 210, flexShrink: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12 }}>
        <span style={{ fontFamily: 'system-ui', fontSize: 10.5, fontWeight: 700,
                       letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)' }}>
          Filters
        </span>
        {active.length > 0 && (
          <button onClick={clearAll} style={{
            fontFamily: 'system-ui', fontSize: 10, fontWeight: 600,
            color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            Clear all
          </button>
        )}
      </div>

      {/* Active chips */}
      {active.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
          {active.map(a => (
            <span key={a.key + a.value + a.mode} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontFamily: 'system-ui', fontSize: 10, fontWeight: 600,
              padding: '2px 7px', borderRadius: 10,
              background: a.mode === 'exc' ? '#fff0f0' : 'var(--navy-lt)',
              color:      a.mode === 'exc' ? '#cc3333' : 'var(--navy)',
              border:     '1px solid ' + (a.mode === 'exc' ? '#ffbbbb' : 'rgba(26,58,107,.2)'),
              maxWidth:   160, overflow: 'hidden',
            }}>
              {a.mode === 'exc' && <span style={{ fontSize: 8, flexShrink: 0 }}>✕</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.label}
              </span>
              <button onClick={() => remove(a.key, a.value)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, lineHeight: 1, color: 'inherit', padding: 0, flexShrink: 0,
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Count */}
      <div style={{
        fontFamily: 'system-ui', fontSize: 12, color: 'var(--ink3)',
        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--rule)',
      }}>
        <strong style={{ color: 'var(--navy)' }}>{totalCount.toLocaleString('en-IN')}</strong>
        {' '}report{totalCount !== 1 ? 's' : ''}{active.length > 0 ? ' match' : ''}
      </div>

      {/* Filter groups */}
      {filters.map(f => (
        <FilterSection key={f.key} def={f} getState={getState} toggle={toggle} />
      ))}
    </aside>
  )
}

// ─── Single filter section ────────────────────────────────────────────────────
function FilterSection({
  def, getState, toggle,
}: {
  def:      FilterDef
  getState: (key: string, value: string) => 'inc' | 'exc' | null
  toggle:   (key: string, value: string, mode: 'inc' | 'exc') => void
}) {
  const maxShown = def.maxShown ?? 8
  const [expanded, setExpanded] = useState(false)
  const hasActive = [
    ...(def.options || []),
    ...(def.groups?.flatMap(g => g.options) || []),
  ].some(o => getState(def.key, o.value) !== null)

  // Flat layout
  if (def.options) {
    const visible = expanded ? def.options : def.options.slice(0, maxShown)
    const hasMore = def.options.length > maxShown
    return (
      <div style={{ marginBottom: 18 }}>
        <GroupLabel label={def.label} active={hasActive} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {visible.map(opt => (
            <OptionRow key={opt.value} opt={opt} filterKey={def.key}
              state={getState(def.key, opt.value)} toggle={toggle} />
          ))}
        </div>
        {hasMore && (
          <button onClick={() => setExpanded(v => !v)} style={{
            marginTop: 4, fontFamily: 'system-ui', fontSize: 10.5, fontWeight: 600,
            color: 'var(--navy)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
          }}>
            {expanded ? '↑ less' : `↓ ${def.options.length - maxShown} more`}
          </button>
        )}
      </div>
    )
  }

  // Grouped (hierarchical) layout — sectors
  if (def.groups) {
    return (
      <div style={{ marginBottom: 18 }}>
        <GroupLabel label={def.label} active={hasActive} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {def.groups.map(g => (
            <SectorGroup key={g.parentValue} group={g} filterKey={def.key}
              getState={getState} toggle={toggle} />
          ))}
        </div>
      </div>
    )
  }

  return null
}

// ─── Sector group (collapsible parent + sub-options) ─────────────────────────
function SectorGroup({
  group, filterKey, getState, toggle,
}: {
  group:     FilterGroup
  filterKey: string
  getState:  (key: string, value: string) => 'inc' | 'exc' | null
  toggle:    (key: string, value: string, mode: 'inc' | 'exc') => void
}) {
  const parentState = getState(filterKey, group.parentValue)
  const anySubActive = group.options.some(o => getState(filterKey, o.value) !== null)
  const [open, setOpen] = useState(parentState !== null || anySubActive)

  return (
    <div style={{ border: '1px solid var(--rule-lt)', borderRadius: 7, overflow: 'hidden' }}>
      {/* Parent row */}
      <div style={{ display: 'flex', alignItems: 'center',
                    background: (parentState || anySubActive) ? 'var(--navy-lt)' : '#fafbfc' }}>
        {/* Chevron toggle */}
        <button onClick={() => setOpen(v => !v)} style={{
          padding: '5px 6px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--ink3)', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
            style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'rotate(-90deg)' }}>
            <path d="M1 3l3.5 3.5L8 3" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Parent option */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <OptionRow opt={{ value: group.parentValue, label: group.parentLabel }}
            filterKey={filterKey} state={parentState} toggle={toggle} compact />
        </div>
      </div>
      {/* Sub-options */}
      {open && group.options.length > 0 && (
        <div style={{ borderTop: '1px solid var(--rule-lt)', background: '#fff' }}>
          {group.options.map(opt => (
            <div key={opt.value} style={{ paddingLeft: 14 }}>
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
function OptionRow({
  opt, filterKey, state, toggle, compact = false,
}: {
  opt:       FilterOption
  filterKey: string
  state:     'inc' | 'exc' | null
  toggle:    (key: string, value: string, mode: 'inc' | 'exc') => void
  compact?:  boolean
}) {
  const [hovered, setHovered] = useState(false)
  const isInc  = state === 'inc'
  const isExc  = state === 'exc'
  const dimmed = opt.disabled && state === null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center',
        opacity: dimmed ? 0.4 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        background: isInc ? 'var(--navy-lt)' : isExc ? '#fff5f5' : 'transparent',
        borderRadius: compact ? 0 : 5,
        transition: 'background .1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Include click area */}
      <button
        onClick={() => toggle(filterKey, opt.value, 'inc')}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6,
          padding: compact ? '5px 8px 5px 0' : '5px 6px',
          background: 'none', border: 'none', cursor: dimmed ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Checkbox */}
        <span style={{
          width: 12, height: 12, borderRadius: 3, flexShrink: 0,
          border: '1.5px solid ' + (isInc ? 'var(--navy)' : isExc ? '#cc4444' : '#ccc'),
          background: isInc ? 'var(--navy)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isInc && <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
            <path d="M1 3.5l1.8 1.8 3-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>}
          {isExc && <span style={{ fontSize: 9, color: '#cc4444', lineHeight: 1, marginTop: -1 }}>−</span>}
        </span>
        {/* Label — truncates, never pushes exclude off screen */}
        <span style={{
          fontFamily: 'system-ui', fontSize: 11.5,
          color: isInc ? 'var(--navy)' : isExc ? '#cc4444' : 'var(--ink)',
          fontWeight: (isInc || isExc) ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {opt.label}
        </span>
        {/* Count — hidden when excluded */}
        {opt.count !== undefined && !isExc && (
          <span style={{ fontFamily: 'system-ui', fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>
            {opt.count}
          </span>
        )}
      </button>

      {/* Exclude button — FIXED WIDTH, always right-aligned, visible on hover or when active */}
      <button
        onClick={() => toggle(filterKey, opt.value, 'exc')}
        title={isExc ? 'Remove exclusion' : 'Exclude this value'}
        style={{
          width: 24, height: 24, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none',
          cursor: 'pointer',
          color: isExc ? '#cc4444' : '#bbb',
          opacity: (hovered || isExc) ? 1 : 0,
          transition: 'opacity .1s, color .1s',
          borderRadius: 4,
          fontSize: 13,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#cc4444'}
        onMouseLeave={e => { if (!isExc) (e.currentTarget as HTMLElement).style.color = '#bbb' }}
      >
        {isExc ? '✕' : '⊘'}
      </button>
    </div>
  )
}

// ─── Group label ──────────────────────────────────────────────────────────────
function GroupLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{
      fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
      letterSpacing: '.6px', textTransform: 'uppercase',
      color: active ? 'var(--navy)' : 'var(--ink3)',
      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      {active && <span style={{ width: 5, height: 5, borderRadius: '50%',
                                background: 'var(--navy)', display: 'inline-block' }}/>}
    </div>
  )
}
