// lib/taxonomy-labels.ts
//
// Reads labels directly from the taxonomy JSON files in the repo.
// Never needs manual updating — add new categories to the JSON files
// and they automatically appear here.
//
// Called ONLY from server components / server-side code.
// Client components receive the pre-built maps as props.

import { readFileSync } from 'fs'
import { join } from 'path'

interface TaxonomyEntry {
  id: string
  level: string
  parent_id?: string
  label?: { en?: string; [lang: string]: string | undefined }
}

function loadTaxonomy(filename: string): TaxonomyEntry[] {
  try {
    const p = join(process.cwd(), 'schemas', filename)
    const raw = readFileSync(p, 'utf-8')
    return JSON.parse(raw).entries || []
  } catch {
    return []
  }
}

// ── AFC labels ────────────────────────────────────────────────

let _afcCache: Record<string, string> | null = null

export function getAfcLabels(): Record<string, string> {
  if (_afcCache) return _afcCache
  const entries = loadTaxonomy('taxonomy_audit_findings_audit_report.json')
  _afcCache = {}
  for (const e of entries) {
    const label = e.label?.en || e.id
    _afcCache[e.id] = label
  }
  return _afcCache
}

export function afcLabel(id: string): string {
  return getAfcLabels()[id] || id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

// ── AFC hierarchy: id → { parentId, parentLabel, subLabel } ──

export interface AfcMeta {
  parentId:    string
  parentLabel: string
  subLabel:    string
}

let _afcMetaCache: Record<string, AfcMeta> | null = null

export function getAfcMeta(): Record<string, AfcMeta> {
  if (_afcMetaCache) return _afcMetaCache
  const entries = loadTaxonomy('taxonomy_audit_findings_audit_report.json')
  const byId: Record<string, TaxonomyEntry> = {}
  for (const e of entries) byId[e.id] = e

  _afcMetaCache = {}
  for (const e of entries) {
    if (e.level === 'category') continue
    const parent = e.parent_id ? byId[e.parent_id] : null
    _afcMetaCache[e.id] = {
      parentId:    e.parent_id || 'other',
      parentLabel: parent?.label?.en || e.parent_id || 'Other',
      subLabel:    e.label?.en || e.id,
    }
  }
  return _afcMetaCache
}

// ── Topic labels ──────────────────────────────────────────────

let _topicsCache: Record<string, string> | null = null

export function getTopicLabels(): Record<string, string> {
  if (_topicsCache) return _topicsCache
  const entries = loadTaxonomy('taxonomy_topics.json')
  _topicsCache = {}
  for (const e of entries) {
    _topicsCache[e.id] = e.label?.en || e.id
  }
  return _topicsCache
}

export function topicLabel(id: string): string {
  return getTopicLabels()[id] || id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

// ── Topic hierarchy: id → { parentId, parentLabel, subLabel } ─

export interface TopicMeta {
  parentId:    string
  parentLabel: string
  subLabel:    string
}

let _topicMetaCache: Record<string, TopicMeta> | null = null

export function getTopicMeta(): Record<string, TopicMeta> {
  if (_topicMetaCache) return _topicMetaCache
  const entries = loadTaxonomy('taxonomy_topics.json')
  const byId: Record<string, TaxonomyEntry> = {}
  for (const e of entries) byId[e.id] = e

  _topicMetaCache = {}
  for (const e of entries) {
    if (e.level === 'topic') continue
    const parent = e.parent_id ? byId[e.parent_id] : null
    _topicMetaCache[e.id] = {
      parentId:    e.parent_id || 'other',
      parentLabel: parent?.label?.en || e.parent_id || 'Other',
      subLabel:    e.label?.en || e.id,
    }
  }
  return _topicMetaCache
}
