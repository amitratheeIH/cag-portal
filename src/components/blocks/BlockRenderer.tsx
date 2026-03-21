'use client'

import { ml, type ContentBlock, type ListItem, type RichboxBodyItem } from '@/types'

// ── HTML sanitiser (inline subset only) ─────────────────────
function safe(text: string): string {
  // Allow only safe inline tags, escape everything else
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?(strong|em|u|sup|sub|del|code|mark|br)(\s[^>]*)?)&gt;/gi, '<$1>')
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

// ── Main dispatcher ──────────────────────────────────────────
export function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.block_type) {
    case 'paragraph':         return <ParagraphBlock block={block} />
    case 'heading':           return <HeadingBlock block={block} />
    case 'list':              return <ListBlock block={block} />
    case 'recommendation':    return <RecommendationBlock block={block} />
    case 'richbox':
    case 'executive_summary_block': return <RichboxBlock block={block} />
    case 'table':             return <TableBlock block={block} />
    case 'image':
    case 'figure':
    case 'map':               return <ImageBlock block={block} />
    case 'signature_block':   return <SignatureBlock block={block} />
    case 'divider':           return <hr className="my-6 border-cag-border" />
    default:                  return null
  }
}

// ── Paragraph ────────────────────────────────────────────────
function ParagraphBlock({ block }: { block: ContentBlock }) {
  const text = ml(block.content.text)
  if (!text) return null
  const pt = block.content.para_type || 'normal'

  const baseClass = 'text-[15px] leading-[1.8] text-cag-text mb-4 text-justify hyphens-auto'
  const variants: Record<string, string> = {
    normal: baseClass,
    finding: `${baseClass} border-l-4 pl-4 py-2 rounded-r-md`,
    note: `${baseClass} text-cag-text2 text-sm`,
    observation: `${baseClass} border-l-4 pl-4 py-2 rounded-r-md`,
  }
  const cls = variants[pt] || baseClass
  const style: React.CSSProperties = {}
  if (pt === 'finding' || pt === 'observation') {
    style.borderColor = 'var(--saffron)'
    style.background = 'var(--saffron-lt)'
  }

  return (
    <div className="block-para">
      {block.para_number && (
        <span className="font-mono text-[11px] text-cag-text3 block mb-1">
          {block.para_number}
        </span>
      )}
      <p
        className={cls}
        style={style}
        dangerouslySetInnerHTML={{ __html: safe(text) }}
      />
    </div>
  )
}

// ── Heading ──────────────────────────────────────────────────
function HeadingBlock({ block }: { block: ContentBlock }) {
  const text = ml(block.content.text)
  if (!text) return null
  const level = block.content.level || 2

  const cls: Record<number, string> = {
    1: 'font-serif text-2xl font-bold text-navy mt-8 mb-3',
    2: 'font-serif text-xl font-bold text-navy mt-6 mb-2',
    3: 'font-serif text-lg font-semibold text-navy-light mt-5 mb-2',
    4: 'font-semibold text-base text-cag-text2 mt-4 mb-1',
  }

  const Tag = `h${Math.min(level + 1, 6)}` as keyof JSX.IntrinsicElements
  return (
    <Tag className={cls[level] || cls[2]}
         dangerouslySetInnerHTML={{ __html: safe(text) }} />
  )
}

// ── List ─────────────────────────────────────────────────────
function ListBlock({ block }: { block: ContentBlock }) {
  const items = block.content.items || []
  if (!items.length) return null
  const listType = block.content.list_type || 'unordered'
  const Tag = 'ul' // always ul; CSS counter handles ordered numbering

  return (
    <div className="mb-4">
      {block.para_number && (
        <span className="font-mono text-[11px] text-cag-text3 block mb-1">
          {block.para_number}
        </span>
      )}
      <Tag className={`space-y-2 ${listType === 'ordered' ? 'list-decimal list-inside' : ''}`}>
        {items.map((item: ListItem, i: number) => (
          <li key={i} className="text-[14.5px] leading-[1.75] text-cag-text flex gap-2.5">
            {listType !== 'ordered' && (
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--saffron)', marginTop: '0.45rem' }}
                    aria-hidden="true" />
            )}
            <span className="flex-1">
              {item.para_number && (
                <span className="font-mono text-[11px] text-cag-text3 mr-1">{item.para_number}</span>
              )}
              <span dangerouslySetInnerHTML={{ __html: safe(ml(item.text)) }} />
              {item.sub_items && item.sub_items.length > 0 && (
                <ul className="mt-1.5 ml-4 space-y-1">
                  {item.sub_items.map((sub, j) => (
                    <li key={j} className="text-[13.5px] text-cag-text2 flex gap-2">
                      <span className="text-cag-text3 flex-shrink-0">–</span>
                      <span dangerouslySetInnerHTML={{ __html: safe(ml(sub.text)) }} />
                    </li>
                  ))}
                </ul>
              )}
            </span>
          </li>
        ))}
      </Tag>
    </div>
  )
}

// ── Recommendation ───────────────────────────────────────────
function RecommendationBlock({ block }: { block: ContentBlock }) {
  const text = ml(block.content.text)
  if (!text) return null

  return (
    <div
      className="my-4 rounded-lg p-4 flex gap-3 items-start border"
      style={{
        background: 'linear-gradient(135deg, #EEF3FB 0%, #F8FAFE 100%)',
        borderColor: '#C5D5EE',
        borderLeft: '4px solid var(--navy)',
      }}
      role="note"
      aria-label="Recommendation"
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--navy)' }}
        aria-hidden="true"
      >
        <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div className="flex-1">
        {block.para_number && (
          <span className="font-mono text-[11px] text-cag-text3 block mb-1">{block.para_number}</span>
        )}
        <div className="text-[10px] font-bold tracking-widest uppercase text-navy mb-1">
          Recommendation
        </div>
        <div
          className="text-[14px] leading-relaxed text-cag-text"
          dangerouslySetInnerHTML={{ __html: safe(text) }}
        />
      </div>
    </div>
  )
}

// ── Richbox ──────────────────────────────────────────────────
const RICHBOX_STYLES: Record<string, { bg: string; border: string; iconBg: string; titleCls: string; icon: string }> = {
  executive_summary: { bg: '#E3F2FD', border: '#BBDEFB', iconBg: '#1565C0', titleCls: 'text-blue-800', icon: '📋' },
  key_data:          { bg: '#E8F5E9', border: '#C8E6C9', iconBg: '#2D7D32', titleCls: 'text-green-800', icon: '📊' },
  audit_observation: { bg: '#FFF8E1', border: '#FFE082', iconBg: '#E65100', titleCls: 'text-amber-800', icon: '🔍' },
  note:              { bg: '#F3E5F5', border: '#CE93D8', iconBg: '#6A1B9A', titleCls: 'text-purple-800', icon: 'ℹ️' },
  finding:           { bg: '#FFF3E8', border: '#FFCC80', iconBg: '#F47920', titleCls: 'text-orange-800', icon: '⚠️' },
}

function RichboxBlock({ block }: { block: ContentBlock }) {
  const btype = block.content.box_type || 'note'
  const style = RICHBOX_STYLES[btype] || RICHBOX_STYLES.note
  const labels: Record<string, string> = {
    executive_summary: 'Executive Summary',
    key_data: 'Key Data',
    audit_observation: 'Audit Observation',
    note: 'Note',
    finding: 'Finding',
  }
  const label = labels[btype] || btype.replace(/_/g, ' ')
  const titleText = ml(block.content.title)
  // Fix 6: suppress title if it duplicates the box type label (e.g. "Executive Summary")
  const isDupTitle = titleText && label && titleText.toLowerCase().trim() === label.toLowerCase().trim()
  const body = block.content.body || []

  return (
    <div
      className="my-4 rounded-lg overflow-hidden border"
      style={{ borderColor: style.border }}
      role="note"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: style.bg }}>
        <span aria-hidden="true">{style.icon}</span>
        <span className={`text-sm font-bold ${style.titleCls}`}>
          {titleText || label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 bg-white">
        {body.length > 0 ? (
          body.map((item: RichboxBodyItem, i: number) => (
            <RichboxBodyItemRenderer key={i} item={item} />
          ))
        ) : (
          <p className="text-sm text-cag-text2 leading-relaxed">
            {ml(block.content.text as Record<string,string>)}
          </p>
        )}
      </div>
    </div>
  )
}

function RichboxBodyItemRenderer({ item }: { item: RichboxBodyItem }) {
  switch (item.type) {
    case 'heading':
      return (
        <p className="font-bold text-[13.5px] text-cag-text mb-2 mt-3 first:mt-0">
          {safe(ml(item.text))}
        </p>
      )
    case 'paragraph':
      return (
        <p
          className="text-[13.5px] leading-relaxed text-cag-text mb-2"
          dangerouslySetInnerHTML={{ __html: safe(ml(item.text || {})) }}
        />
      )
    case 'bullets':
    case 'ordered_list': {
      const Tag = item.type === 'ordered_list' ? 'ol' : 'ul'
      return (
        <Tag className="mb-2 space-y-1 pl-4">
          {(item.items || []).map((bi, i) => (
            <li key={i} className="text-[13px] text-cag-text2 leading-relaxed list-disc">
              <span dangerouslySetInnerHTML={{ __html: safe(ml(bi.text)) }} />
            </li>
          ))}
        </Tag>
      )
    }
    default:
      return null
  }
}

// ── Table ────────────────────────────────────────────────────
function TableBlock({ block }: { block: ContentBlock }) {
  const caption  = ml(block.content.caption)
  const tableNum = block.content.table_number
  const unitNote = ml(block.content.unit_note)
  const dsRef    = block.content.dataset_ref

  return (
    <div className="my-5 overflow-x-auto">
      {(tableNum || caption) && (
        <div className="flex items-baseline gap-2 mb-2">
          {tableNum && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded text-white flex-shrink-0"
              style={{ background: 'var(--navy)' }}
            >
              Table {tableNum}
            </span>
          )}
          {caption && (
            <span className="text-[13px] font-semibold text-cag-text2">{caption}</span>
          )}
        </div>
      )}
      {unitNote && (
        <div className="text-[11px] text-cag-text3 text-right mb-1 italic">{unitNote}</div>
      )}
      <div
        className="rounded-lg border overflow-hidden text-[13px]"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="px-4 py-3 flex items-center gap-2 text-white text-[12px]"
          style={{ background: 'var(--navy)' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M3 15h18M9 3v18"/>
          </svg>
          {dsRef ? (
            <span>Dataset: <code className="font-mono opacity-75">{dsRef}</code></span>
          ) : (
            <span>Table data</span>
          )}
        </div>
        <div className="px-4 py-3 text-cag-text3 text-[12px] italic bg-cag-bg">
          Full table data available via dataset files
        </div>
      </div>
    </div>
  )
}

// ── Image / Figure / Map ─────────────────────────────────────
function ImageBlock({ block }: { block: ContentBlock }) {
  const caption = ml(block.content.caption)
  const alt     = ml(block.content.alt_text) || caption || 'Figure'

  return (
    <figure className="my-5">
      <div
        className="rounded-lg border flex flex-col items-center justify-center gap-2 py-8 px-4 text-cag-text3"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        role="img"
        aria-label={alt}
      >
        <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
        <span className="text-[12px]">{block.content.asset_ref || 'Image / Figure'}</span>
      </div>
      {caption && (
        <figcaption className="text-[12px] text-cag-text3 text-center mt-2 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

// ── Signature Block ──────────────────────────────────────────
function SignatureBlock({ block }: { block: ContentBlock }) {
  const signatories = block.content.signatories || []

  return (
    <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-lt)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {signatories.map((sig, i) => (
          <div key={i}>
            <div className="font-serif font-bold text-navy text-[15px]">
              {ml(sig.name)}
            </div>
            <div className="text-[13px] text-cag-text2 mt-0.5">{ml(sig.designation)}</div>
            {sig.date && (
              <div className="text-[12px] text-cag-text3 mt-1">Date: {sig.date}</div>
            )}
            {sig.place && (
              <div className="text-[12px] text-cag-text3">{ml(sig.place)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
