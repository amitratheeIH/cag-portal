'use client'

import { ml, type FlatUnit } from '@/types'

interface TOCSidebarProps {
  units: FlatUnit[]
  currentIndex: number
  onNavigate: (index: number) => void
}

export function TOCSidebar({ units, currentIndex, onNavigate }: TOCSidebarProps) {
  const current = units[currentIndex]
  const progress = units.length > 0 ? Math.round(((currentIndex + 1) / units.length) * 100) : 0

  // Build tree: roots and their children
  const roots = units.filter(u => !u.parent_id)

  return (
    <nav
      className="flex flex-col h-full"
      aria-label="Table of contents"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-lt)' }}
      >
        <div className="text-[10px] font-bold tracking-[1.3px] uppercase text-cag-text3 mb-2">
          Contents
        </div>
        {/* Progress bar */}
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--border-lt)' }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Reading progress: ${progress}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'var(--saffron)' }}
          />
        </div>
      </div>

      {/* TOC list */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {roots.map((root) => (
          <TOCRootItem
            key={root.unit_id}
            root={root}
            units={units}
            currentIndex={currentIndex}
            current={current}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  )
}

function TOCRootItem({
  root, units, currentIndex, current, onNavigate
}: {
  root: FlatUnit
  units: FlatUnit[]
  currentIndex: number
  current: FlatUnit | undefined
  onNavigate: (i: number) => void
}) {
  const children = units.filter(u => u.parent_id === root.unit_id)
  const isCurrentRoot = current?.unit_id === root.unit_id
  const isInsideRoot = current?.parent_id === root.unit_id

  // Chapter is "open" if current unit is inside it or is it
  const isOpen = isCurrentRoot || isInsideRoot

  // Chapter number extraction
  const chMatch = (ml(root.title) || '').match(/Chapter\s+(\d+)/i)
  const chLabel = chMatch
    ? `CH${chMatch[1]}`
    : root.unit_type === 'preface' ? 'PRE'
    : root.unit_type === 'executive_summary' ? 'ES'
    : root.unit_type.slice(0, 3).toUpperCase()

  const isFlat = children.length === 0

  if (isFlat) {
    // Preface, Executive Summary — flat, no children
    return (
      <button
        className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] transition-colors border-l-[3px]"
        style={{
          borderLeftColor: isCurrentRoot ? 'var(--saffron)' : 'transparent',
          background: isCurrentRoot ? '#EEF3FB' : 'transparent',
          color: isCurrentRoot ? 'var(--navy)' : 'var(--text-2)',
          fontWeight: isCurrentRoot ? 600 : 400,
        }}
        onClick={() => onNavigate(root.index)}
        aria-current={isCurrentRoot ? 'page' : undefined}
      >
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: isCurrentRoot ? 'var(--saffron)' : 'var(--navy)', color: '#fff' }}
        >
          {chLabel}
        </span>
        <span className="flex-1 min-w-0 line-clamp-2 leading-snug">
          {ml(root.title) || root.unit_id}
        </span>
      </button>
    )
  }

  return (
    <div>
      {/* Chapter header */}
      <button
        className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] transition-colors border-l-[3px]"
        style={{
          borderLeftColor: isCurrentRoot ? 'var(--saffron)' : isInsideRoot ? 'var(--navy)' : 'transparent',
          background: isCurrentRoot ? '#EEF3FB' : isInsideRoot ? '#F5F8FE' : 'transparent',
          color: (isCurrentRoot || isInsideRoot) ? 'var(--navy)' : 'var(--text-2)',
          fontWeight: (isCurrentRoot || isInsideRoot) ? 600 : 400,
        }}
        onClick={() => onNavigate(root.index)}
        aria-expanded={isOpen}
        aria-current={isCurrentRoot ? 'page' : undefined}
      >
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            background: (isCurrentRoot || isInsideRoot) ? 'var(--saffron)' : 'var(--navy)',
            color: '#fff'
          }}
        >
          {chLabel}
        </span>
        <span className="flex-1 min-w-0 line-clamp-2 leading-snug text-left">
          {ml(root.title) || root.unit_id}
        </span>
        <span
          className="flex-shrink-0 transition-transform duration-200 text-cag-text3"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
          aria-hidden="true"
        >
          ›
        </span>
      </button>

      {/* Sections — shown when chapter is active */}
      {isOpen && children.length > 0 && (
        <div className="pb-1">
          {children.map(sec => {
            const isCurrent = currentIndex === sec.index
            return (
              <button
                key={sec.unit_id}
                className="w-full text-left flex items-center gap-2.5 pl-9 pr-3.5 py-1.5 text-[12px] transition-colors border-l-[3px]"
                style={{
                  borderLeftColor: isCurrent ? 'var(--saffron)' : 'transparent',
                  background: isCurrent ? '#EEF3FB' : 'transparent',
                  color: isCurrent ? 'var(--navy)' : 'var(--text-3)',
                  fontWeight: isCurrent ? 600 : 400,
                }}
                onClick={() => onNavigate(sec.index)}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: isCurrent ? 'var(--saffron)' : 'var(--border)' }}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0 line-clamp-2 leading-snug text-left">
                  {ml(sec.title) || sec.unit_id}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
