'use client'

import { ml, type FlatUnit, type ContentUnit, type ContentBlock } from '@/types'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'

interface UnitPanelProps {
  unit: FlatUnit
  unitFile?: ContentUnit
  blocks: ContentBlock[]
  prevUnit?: FlatUnit
  nextUnit?: FlatUnit
  onNavigate: (index: number) => void
  reportTitle: string
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  preface: 'Preface',
  executive_summary: 'Executive Summary',
  chapter: 'Chapter',
  section: 'Section',
  appendix: 'Appendix',
  annexure: 'Annexure',
}

const UNIT_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  preface:           { bg: '#E8EAF6', text: '#3949AB' },
  executive_summary: { bg: '#E0F2F1', text: '#00695C' },
  chapter:           { bg: 'var(--navy)', text: '#fff' },
  section:           { bg: 'var(--border-lt)', text: 'var(--navy)' },
  appendix:          { bg: '#FFF3E8', text: '#E65100' },
  annexure:          { bg: '#FFF3E8', text: '#E65100' },
}

export function UnitPanel({
  unit, unitFile, blocks, prevUnit, nextUnit, onNavigate, reportTitle
}: UnitPanelProps) {
  const title = ml(unitFile?.title || unit.title)
  const execSum = ml(unitFile?.executive_summary || unit.executive_summary)
  const typeStyle = UNIT_TYPE_STYLES[unit.unit_type] || UNIT_TYPE_STYLES.section
  const typeLabel = UNIT_TYPE_LABELS[unit.unit_type] || unit.unit_type

  // Resolved meta from first block
  const rm = blocks[0]?.resolved_meta

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Unit content ─────────────────────────────── */}
      <div className="flex-1 max-w-[820px] mx-auto w-full px-8 py-8">

        {/* Unit header */}
        <header className="mb-7 pb-5 border-b" style={{ borderColor: 'var(--border-lt)' }}>

          {/* Type badge */}
          <span
            className="inline-flex items-center text-[10.5px] font-bold tracking-[1.1px] uppercase
                       px-2.5 py-1 rounded-full mb-3"
            style={{ background: typeStyle.bg, color: typeStyle.text }}
          >
            {typeLabel}
          </span>

          {/* Title */}
          {title && (
            <h1
              className="font-serif text-[26px] font-bold leading-snug mb-2"
              style={{ color: 'var(--navy)' }}
            >
              {title}
            </h1>
          )}

          {/* Executive summary / subtitle */}
          {execSum && (
            <p className="text-[14px] text-cag-text2 leading-relaxed mt-2">
              {execSum}
            </p>
          )}

          {/* Meta pills */}
          {rm && (
            <div className="flex flex-wrap gap-2 mt-4">
              {rm.audit_type?.[0] && (
                <MetaPill label="Audit type" value={rm.audit_type[0].replace('ATYPE-', '')} />
              )}
              {rm.audit_period && (
                <MetaPill
                  label="Period"
                  value={`${rm.audit_period.start_year}–${rm.audit_period.end_year}`}
                />
              )}
              {unit.para_number && (
                <MetaPill label="Para" value={unit.para_number} />
              )}
            </div>
          )}
        </header>

        {/* Blocks */}
        <div role="region" aria-label="Report content">
          {blocks.length === 0 ? (
            <div className="text-cag-text3 text-sm italic py-8 text-center">
              No content blocks for this unit.
            </div>
          ) : (
            blocks.map(block => (
              <BlockRenderer key={block.block_id} block={block} />
            ))
          )}
        </div>
      </div>

      {/* ── Bottom navigation ────────────────────────── */}
      <div
        className="max-w-[820px] mx-auto w-full px-8 py-6 border-t flex items-center justify-between gap-4"
        style={{ borderColor: 'var(--border-lt)' }}
      >
        {prevUnit ? (
          <NavCard unit={prevUnit} direction="prev" onClick={() => onNavigate(prevUnit.index)} />
        ) : <div />}

        {nextUnit ? (
          <NavCard unit={nextUnit} direction="next" onClick={() => onNavigate(nextUnit.index)} />
        ) : <div />}
      </div>

    </div>
  )
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full border"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
    >
      <strong style={{ color: 'var(--text-2)' }}>{label}:</strong> {value}
    </span>
  )
}

function NavCard({
  unit, direction, onClick
}: {
  unit: FlatUnit
  direction: 'prev' | 'next'
  onClick: () => void
}) {
  const title = ml(unit.title) || unit.unit_id
  const typeLabel = UNIT_TYPE_LABELS[unit.unit_type] || unit.unit_type
  const isPrev = direction === 'prev'

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border max-w-[280px]
                  hover:border-navy hover:shadow-card transition-all group text-left`}
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label={`${isPrev ? 'Previous' : 'Next'}: ${title}`}
    >
      {isPrev && (
        <svg
          className="flex-shrink-0 text-cag-border group-hover:text-navy transition-colors"
          width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="m15 18-6-6 6-6"/>
        </svg>
      )}
      <div className={`flex-1 min-w-0 ${isPrev ? '' : 'text-right'}`}>
        <div className="text-[10px] font-bold tracking-wide uppercase text-cag-text3 mb-0.5">
          {isPrev ? '← Previous' : 'Next →'}
        </div>
        <div className="text-[13px] font-semibold text-cag-text leading-snug line-clamp-2">
          {title}
        </div>
        <div className="text-[11px] text-cag-text3 mt-0.5">{typeLabel}</div>
      </div>
      {!isPrev && (
        <svg
          className="flex-shrink-0 text-cag-border group-hover:text-navy transition-colors"
          width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="m9 18 6-6-6-6"/>
        </svg>
      )}
    </button>
  )
}
