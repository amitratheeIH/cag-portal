// src/lib/taxonomy-labels.ts
//
// Static JSON imports — bundled at build time by webpack, no filesystem
// access at runtime. Works on Vercel, standalone, and local dev identically.
//
// Place this file at:  src/lib/taxonomy-labels.ts
// Taxonomy files at:   taxonomies/taxonomy_audit_findings_audit_report.json
//                      taxonomies/taxonomy_topics.json

// Path: src/lib/ → ../../ → repo root → taxonomies/
import afcRaw    from '../../taxonomies/taxonomy_audit_findings_audit_report.json'
import topicsRaw from '../../taxonomies/taxonomy_topics.json'

interface TaxonomyEntry {
  id:         string
  level:      string
  parent_id?: string | null
  label?:     { en?: string; [lang: string]: string | undefined }
}

// ─── AFC (Audit Findings Categories) ─────────────────────────────────────────

export interface AfcMeta {
  parentId:    string
  parentLabel: string
  subLabel:    string
}

let _afcLabels:    Record<string, string>  | null = null
let _afcMetaCache: Record<string, AfcMeta> | null = null

function buildAfcIndex() {
  const entries = (afcRaw as { entries: TaxonomyEntry[] }).entries ?? []
  const byId: Record<string, TaxonomyEntry> = {}
  for (const e of entries) byId[e.id] = e

  const labels: Record<string, string>  = {}
  const meta:   Record<string, AfcMeta> = {}

  for (const e of entries) {
    const label = e.label?.en || e.id
    labels[e.id] = label

    if (e.level === 'category') {
      // Top-level — self-referential so it resolves to its own group
      meta[e.id] = { parentId: e.id, parentLabel: label, subLabel: label }
    } else {
      const parent = e.parent_id ? byId[e.parent_id] : null
      meta[e.id] = {
        parentId:    e.parent_id  || 'other',
        parentLabel: parent?.label?.en || e.parent_id || 'Other',
        subLabel:    label,
      }
    }
  }

  _afcLabels    = labels
  _afcMetaCache = meta
}

export function getAfcLabels(): Record<string, string> {
  if (!_afcLabels) buildAfcIndex()
  return _afcLabels!
}

export function afcLabel(id: string): string {
  return getAfcLabels()[id] ?? id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

export function getAfcMeta(): Record<string, AfcMeta> {
  if (!_afcMetaCache) buildAfcIndex()
  return _afcMetaCache!
}

// ─── Topics ───────────────────────────────────────────────────────────────────

export interface TopicMeta {
  parentId:    string
  parentLabel: string
  subLabel:    string
}

let _topicLabels:    Record<string, string>    | null = null
let _topicMetaCache: Record<string, TopicMeta> | null = null

function buildTopicIndex() {
  const entries = (topicsRaw as { entries: TaxonomyEntry[] }).entries ?? []
  const byId: Record<string, TaxonomyEntry> = {}
  for (const e of entries) byId[e.id] = e

  const labels: Record<string, string>    = {}
  const meta:   Record<string, TopicMeta> = {}

  for (const e of entries) {
    const label = e.label?.en || e.id
    labels[e.id] = label

    if (e.level === 'topic') {
      // Top-level — self-referential
      meta[e.id] = { parentId: e.id, parentLabel: label, subLabel: label }
    } else {
      const parent = e.parent_id ? byId[e.parent_id] : null
      meta[e.id] = {
        parentId:    e.parent_id  || 'other',
        parentLabel: parent?.label?.en || e.parent_id || 'Other',
        subLabel:    label,
      }
    }
  }

  _topicLabels    = labels
  _topicMetaCache = meta
}

export function getTopicLabels(): Record<string, string> {
  if (!_topicLabels) buildTopicIndex()
  return _topicLabels!
}

export function topicLabel(id: string): string {
  return getTopicLabels()[id] ?? id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

export function getTopicMeta(): Record<string, TopicMeta> {
  if (!_topicMetaCache) buildTopicIndex()
  return _topicMetaCache!
}
