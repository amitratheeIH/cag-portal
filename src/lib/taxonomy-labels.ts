// src/lib/taxonomy-labels.ts
//
// Reads taxonomy data from MongoDB (collections: taxonomy_afc, taxonomy_topics).
// No filesystem access — works on Vercel and every deployment target.
//
// To populate the collections, run once from the pipeline repo:
//   python scripts/sync_taxonomies.py
//
// Called ONLY from server components / server-side code.
// Client components receive the pre-built maps as props.

import { getDb } from '@/lib/mongodb'

interface TaxonomyEntry {
  id:         string
  level:      string
  parent_id?: string | null
  label?:     { en?: string }
}

// ─── AFC (Audit Findings Categories) ─────────────────────────────────────────

export interface AfcMeta {
  parentId:    string
  parentLabel: string
  subLabel:    string
}

let _afcMetaCache:   Record<string, AfcMeta>  | null = null
let _afcLabelsCache: Record<string, string>   | null = null

async function buildAfcIndex() {
  const db      = await getDb()
  const entries = await db.collection<TaxonomyEntry>('taxonomy_afc').find({}).toArray() as TaxonomyEntry[]

  const byId: Record<string, TaxonomyEntry> = {}
  for (const e of entries) byId[e.id] = e

  const labels: Record<string, string>  = {}
  const meta:   Record<string, AfcMeta> = {}

  for (const e of entries) {
    const label = e.label?.en || e.id
    labels[e.id] = label

    if (e.level === 'category') {
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

  _afcLabelsCache = labels
  _afcMetaCache   = meta
}

export async function getAfcLabels(): Promise<Record<string, string>> {
  if (!_afcLabelsCache) await buildAfcIndex()
  return _afcLabelsCache!
}

export async function afcLabel(id: string): Promise<string> {
  const labels = await getAfcLabels()
  return labels[id] ?? id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

export async function getAfcMeta(): Promise<Record<string, AfcMeta>> {
  if (!_afcMetaCache) await buildAfcIndex()
  return _afcMetaCache!
}

// ─── Topics ───────────────────────────────────────────────────────────────────

export interface TopicMeta {
  parentId:    string
  parentLabel: string
  subLabel:    string
}

let _topicMetaCache:   Record<string, TopicMeta> | null = null
let _topicLabelsCache: Record<string, string>    | null = null

async function buildTopicIndex() {
  const db      = await getDb()
  const entries = await db.collection<TaxonomyEntry>('taxonomy_topics').find({}).toArray() as TaxonomyEntry[]

  const byId: Record<string, TaxonomyEntry> = {}
  for (const e of entries) byId[e.id] = e

  const labels: Record<string, string>    = {}
  const meta:   Record<string, TopicMeta> = {}

  for (const e of entries) {
    const label = e.label?.en || e.id
    labels[e.id] = label

    if (e.level === 'topic') {
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

  _topicLabelsCache = labels
  _topicMetaCache   = meta
}

export async function getTopicLabels(): Promise<Record<string, string>> {
  if (!_topicLabelsCache) await buildTopicIndex()
  return _topicLabelsCache!
}

export async function topicLabel(id: string): Promise<string> {
  const labels = await getTopicLabels()
  return labels[id] ?? id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

export async function getTopicMeta(): Promise<Record<string, TopicMeta>> {
  if (!_topicMetaCache) await buildTopicIndex()
  return _topicMetaCache!
}
