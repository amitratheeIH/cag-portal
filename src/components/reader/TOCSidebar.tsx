'use client'

import { ml, type FlatUnit } from '@/types'

interface TOCSidebarProps {
  units: FlatUnit[]
  currentIndex: number
  onNavigate: (index: number) => void
}

export function TOCSidebar({ units, currentIndex, onNavigate }: TOCSidebarProps) {
  const progress = units.length > 0 ? Math.round(((currentIndex + 1) / units.length) * 100) : 0

  return (
    <nav className="flex flex-col h-full" aria-label="Table of contents">
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-lt)' }}>
        <div className="text-[10px] font-bold tracking-[1.3px] uppercase text-cag-text3 mb-2">Contents</div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-lt)' }}
          role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Reading progress: ${progress}%`}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--saffron)' }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <TOCList units={units} currentIndex={currentIndex} onNavigate={onNavigate} />
      </div>
    </nav>
  )
}

function TOCList({ units, currentIndex, onNavigate }: TOCSidebarProps) {
  const frontMatter = units.filter(u => !u.parent_id && ['preface','executive_summary'].includes(u.unit_type))
  const chapters    = units.filter(u => !u.parent_id && u.unit_type === 'chapter')
  const backMatter  = units.filter(u => !u.parent_id && ['appendix','annexure'].includes(u.unit_type))

  return (
    <>
      {frontMatter.length > 0 && (
        <div>
          <GroupLabel>Front matter</GroupLabel>
          {frontMatter.map(u => <FlatItem key={u.unit_id} unit={u} currentIndex={currentIndex} onNavigate={onNavigate} />)}
        </div>
      )}
      {chapters.length > 0 && (
        <div>
          <GroupLabel>Chapters &amp; sections</GroupLabel>
          {chapters.map(ch => <ChapterItem key={ch.unit_id} root={ch} units={units} currentIndex={currentIndex} onNavigate={onNavigate} />)}
        </div>
      )}
      {backMatter.length > 0 && (
        <div>
          <GroupLabel>Back matter</GroupLabel>
          {backMatter.map(u => <FlatItem key={u.unit_id} unit={u} currentIndex={currentIndex} onNavigate={onNavigate} />)}
        </div>
      )}
    </>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[9px] font-bold tracking-[1.5px] uppercase text-cag-text3 opacity-60">
      {children}
    </div>
  )
}

function FlatItem({ unit, currentIndex, onNavigate }: { unit: FlatUnit; currentIndex: number; onNavigate: (i: number) => void }) {
  const isCurrent = currentIndex === unit.index
  return (
    <button
      className="w-full text-left flex items-center px-4 py-2 text-[12.5px] font-semibold border-l-2 transition-colors"
      style={{ borderLeftColor: isCurrent ? 'var(--saffron)' : 'transparent', background: isCurrent ? 'var(--navy-lt)' : 'transparent', color: isCurrent ? 'var(--navy)' : 'var(--text-2)' }}
      onClick={() => onNavigate(unit.index)} aria-current={isCurrent ? 'page' : undefined}
    >
      <span className="flex-1 min-w-0 line-clamp-2 leading-snug text-left">{ml(unit.title) || unit.unit_id}</span>
    </button>
  )
}

function ChapterItem({ root, units, currentIndex, onNavigate }: { root: FlatUnit; units: FlatUnit[]; currentIndex: number; onNavigate: (i: number) => void }) {
  const children = units.filter(u => u.parent_id === root.unit_id)
  const isCurrentRoot = currentIndex === root.index
  const isInside = units[currentIndex]?.parent_id === root.unit_id
  const isOpen = isCurrentRoot || isInside

  return (
    <div>
      <button
        className="w-full text-left flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold border-l-2 transition-colors"
        style={{ borderLeftColor: isCurrentRoot ? 'var(--saffron)' : isInside ? 'var(--navy)' : 'transparent', background: (isCurrentRoot || isInside) ? 'var(--navy-lt)' : 'transparent', color: (isCurrentRoot || isInside) ? 'var(--navy)' : 'var(--text-2)' }}
        onClick={() => onNavigate(root.index)} aria-expanded={isOpen} aria-current={isCurrentRoot ? 'page' : undefined}
      >
        <span className="flex-1 min-w-0 line-clamp-2 leading-snug text-left">{ml(root.title) || root.unit_id}</span>
        {children.length > 0 && (
          <span className="flex-shrink-0 text-cag-text3 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} aria-hidden="true">›</span>
        )}
      </button>

      {/* Sections inside chapter — shown when open */}
      {isOpen && children.map(sec => {
        const isCurrent = currentIndex === sec.index
        const secNum = sec.para_number
        const secTitle = ml(sec.title) || sec.unit_id
        return (
          <button key={sec.unit_id}
            className="w-full text-left flex items-center gap-2 pl-8 pr-4 py-1.5 text-[11.5px] border-l-2 transition-colors"
            style={{ borderLeftColor: isCurrent ? 'var(--saffron)' : 'transparent', background: isCurrent ? 'var(--navy-lt)' : 'transparent', color: isCurrent ? 'var(--navy)' : 'var(--text-3)', fontWeight: isCurrent ? 600 : 400 }}
            onClick={() => onNavigate(sec.index)} aria-current={isCurrent ? 'page' : undefined}
          >
            {secNum && <span className="flex-shrink-0 text-[10.5px]" style={{ color: 'var(--saffron)' }}>{secNum}</span>}
            <span className="flex-1 min-w-0 line-clamp-2 leading-snug text-left">{secTitle}</span>
          </button>
        )
      })}
    </div>
  )
}
