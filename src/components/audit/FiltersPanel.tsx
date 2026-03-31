'use client'
// FiltersPanel.tsx
// Sidebar filter panel for audit-reports list view.
// Supports include/exclude per value, independent filters, active chips,
// "see more" expansion, and jurisdiction-specific filter sets.

import React, { useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────
export interface FilterOption { value: string; label: string; count?: number }
export interface FilterDef {
  key:      string       // searchParam key, e.g. "year", "audit_type"
  label:    string       // display label
  options:  FilterOption[]
  multi?:   boolean      // default true
  maxShown?: number      // how many to show before "see more", default 6
}

interface ActiveFilter { key: string; value: string; label: string; mode: 'inc' | 'exc' }

// ─── helpers ──────────────────────────────────────────────────────────────────
function encodeFilter(mode: 'inc' | 'exc', value: string) {
  return mode === 'exc' ? '-' + value : value
}
function decodeFilter(raw: string): { mode: 'inc' | 'exc'; value: string } {
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
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  // Parse active filters from URL
  const active: ActiveFilter[] = []
  for (const f of filters) {
    const vals = searchParams.getAll(f.key)
    for (const raw of vals) {
      const { mode, value } = decodeFilter(raw)
      const opt = f.options.find(o => o.value === value)
      if (opt) active.push({ key: f.key, value, label: opt.label, mode })
    }
  }

  // Build new URL with updated params
  const buildUrl = useCallback((updates: Record<string, string[]>) => {
    const params = new URLSearchParams(searchParams.toString())
    // Preserve non-filter params (jurisdiction, state, topic)
    for (const key of Object.keys(updates)) params.delete(key)
    for (const [key, vals] of Object.entries(updates)) {
      for (const v of vals) params.append(key, v)
    }
    return pathname + '?' + params.toString()
  }, [pathname, searchParams])

  const toggleValue = (key: string, value: string, mode: 'inc' | 'exc') => {
    const current = searchParams.getAll(key)
    const encoded = encodeFilter(mode, value)
    const opposite = encodeFilter(mode === 'inc' ? 'exc' : 'inc', value)
    let next: string[]
    if (current.includes(encoded)) {
      // Remove (deselect)
      next = current.filter(v => v !== encoded)
    } else {
      // Add, removing opposite mode if present
      next = current.filter(v => v !== opposite)
      next.push(encoded)
    }
    router.push(buildUrl({ [key]: next }))
  }

  const removeFilter = (key: string, value: string) => {
    const current = searchParams.getAll(key)
    const next = current.filter(v => !v.replace('-','').includes(value) ||
      decodeFilter(v).value !== value)
    router.push(buildUrl({ [key]: next }))
  }

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString())
    for (const f of filters) params.delete(f.key)
    router.push(pathname + '?' + params.toString())
  }

  const getState = (key: string, value: string): 'inc' | 'exc' | null => {
    const current = searchParams.getAll(key)
    if (current.includes(encodeFilter('inc', value))) return 'inc'
    if (current.includes(encodeFilter('exc', value))) return 'exc'
    return null
  }

  return (
    <aside style={{ width: 220, flexShrink: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14 }}>
        <span style={{ fontFamily: 'system-ui', fontSize: 11, fontWeight: 700,
                       letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)' }}>
          Filters
        </span>
        {active.length > 0 && (
          <button onClick={clearAll} style={{
            fontFamily: 'system-ui', fontSize: 10, fontWeight: 600, color: 'var(--red)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            Clear all
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {active.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
          {active.map(f => (
            <span key={f.key + f.value + f.mode} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'system-ui', fontSize: 10.5, fontWeight: 600,
              padding: '3px 8px', borderRadius: 12,
              background: f.mode === 'exc' ? '#fff0f0' : 'var(--navy-lt)',
              color:      f.mode === 'exc' ? 'var(--red)' : 'var(--navy)',
              border:     '1px solid ' + (f.mode === 'exc' ? '#ffcccc' : 'rgba(26,58,107,.2)'),
            }}>
              {f.mode === 'exc' && <span style={{ fontSize: 9 }}>✕</span>}
              {f.label}
              <button onClick={() => removeFilter(f.key, f.value)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 11, lineHeight: 1, color: 'inherit', marginLeft: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Total count */}
      <div style={{ fontFamily: 'system-ui', fontSize: 12, color: 'var(--ink3)',
                    marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--rule)' }}>
        {totalCount.toLocaleString('en-IN')} report{totalCount !== 1 ? 's' : ''}
        {active.length > 0 ? ' match' : ' total'}
      </div>

      {/* Filter groups */}
      {filters.map(f => (
        <FilterGroup
          key={f.key}
          def={f}
          getState={getState}
          toggle={toggleValue}
        />
      ))}
    </aside>
  )
}

// ─── Single filter group ──────────────────────────────────────────────────────
function FilterGroup({
  def, getState, toggle,
}: {
  def:      FilterDef
  getState: (key: string, value: string) => 'inc' | 'exc' | null
  toggle:   (key: string, value: string, mode: 'inc' | 'exc') => void
}) {
  const maxShown = def.maxShown ?? 6
  const [expanded, setExpanded] = useState(false)
  const [showExclude, setShowExclude] = useState<string | null>(null)

  const shown = expanded ? def.options : def.options.slice(0, maxShown)
  const hasMore = def.options.length > maxShown

  // Check if any of this group's values are active
  const hasActive = def.options.some(o => getState(def.key, o.value) !== null)

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Group label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 8 }}>
        <span style={{
          fontFamily: 'system-ui', fontSize: 10.5, fontWeight: 700,
          letterSpacing: '.6px', textTransform: 'uppercase',
          color: hasActive ? 'var(--navy)' : 'var(--ink3)',
        }}>
          {def.label}
        </span>
        {hasActive && (
          <span style={{ width: 6, height: 6, borderRadius: '50%',
                         background: 'var(--navy)', display: 'inline-block' }}/>
        )}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {shown.map(opt => {
          const state = getState(def.key, opt.value)
          const isInc = state === 'inc'
          const isExc = state === 'exc'
          const isHovered = showExclude === opt.value

          return (
            <div key={opt.value}
              style={{ display: 'flex', alignItems: 'center', gap: 0,
                       borderRadius: 6, overflow: 'hidden',
                       border: '1px solid ' + (isInc ? 'rgba(26,58,107,.3)' : isExc ? 'rgba(180,40,40,.3)' : 'transparent'),
                       background: isInc ? 'var(--navy-lt)' : isExc ? '#fff0f0' : 'transparent',
                       transition: 'all .1s',
              }}
              onMouseEnter={() => setShowExclude(opt.value)}
              onMouseLeave={() => setShowExclude(null)}
            >
              {/* Include button */}
              <button
                onClick={() => toggle(def.key, opt.value, 'inc')}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {/* Checkbox */}
                <span style={{
                  width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                  border: '1.5px solid ' + (isInc ? 'var(--navy)' : isExc ? '#cc3333' : 'var(--rule)'),
                  background: isInc ? 'var(--navy)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isInc && <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>}
                  {isExc && <span style={{ fontSize: 9, color: '#cc3333', lineHeight: 1 }}>−</span>}
                </span>
                <span style={{
                  fontFamily: 'system-ui', fontSize: 12,
                  color: isInc ? 'var(--navy)' : isExc ? '#cc3333' : 'var(--ink)',
                  fontWeight: (isInc || isExc) ? 600 : 400,
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {opt.label}
                </span>
                {opt.count !== undefined && (
                  <span style={{
                    fontFamily: 'system-ui', fontSize: 10, color: 'var(--ink3)',
                    flexShrink: 0,
                  }}>
                    {opt.count}
                  </span>
                )}
              </button>

              {/* Exclude button — appears on hover */}
              {(isHovered || isExc) && !isInc && (
                <button
                  onClick={() => toggle(def.key, opt.value, 'exc')}
                  title="Exclude this value"
                  style={{
                    padding: '5px 7px', background: 'none', border: 'none',
                    cursor: 'pointer', borderLeft: '1px solid var(--rule-lt)',
                    color: isExc ? '#cc3333' : 'var(--ink3)',
                    fontSize: 11, lineHeight: 1, flexShrink: 0,
                    transition: 'color .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#cc3333'}
                  onMouseLeave={e => !isExc && ((e.currentTarget as HTMLElement).style.color = 'var(--ink3)')}
                >
                  {isExc ? '✕' : '⊘'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* See more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 5, fontFamily: 'system-ui', fontSize: 11, fontWeight: 600,
            color: 'var(--navy)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 0',
          }}
        >
          {expanded
            ? '↑ Show less'
            : `↓ ${def.options.length - maxShown} more`}
        </button>
      )}
    </div>
  )
}
