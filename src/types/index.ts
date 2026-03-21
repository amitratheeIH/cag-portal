// ── Multilingual string ──────────────────────────────────────
export type MLString = Record<string, string>

export function ml(obj: MLString | string | undefined | null, lang = 'en'): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj[lang] || obj['en'] || Object.values(obj)[0] || ''
}

// ── Catalog / Report listing ─────────────────────────────────
export interface CatalogEntry {
  _id?: string
  product_id: string
  product_type: string
  year: number
  jurisdiction: string
  slug?: string
  title: MLString
  summary?: MLString
  audit_type?: string[]
  report_sector?: string[]
  topics?: string[]
  audit_findings_categories?: string[]
  audit_period?: { start_year: number; end_year: number }
  state_ut_id?: string
  audit_status?: string
  tabling_dates?: { lower_house?: string; upper_house?: string }
  published_date?: string
  report_number?: { number: number; year: number }
  has_atn?: boolean
  report_path: string
  last_indexed?: string
}

// ── Report metadata (from report_meta collection) ────────────
export interface ReportMeta {
  _id?: string
  product_id: string
  product_type: string
  year: number
  folder_path: string
  metadata: {
    common: {
      product_id: string
      title: MLString
      summary?: MLString
      slug?: string
      year: number
      languages: string[]
      default_language: string
      published_date?: string
    }
    specific: {
      inheritable: {
        audit_type?: string[]
        report_sector?: string[]
        audit_period?: { start_year: number; end_year: number }
        topics?: string[]
        main_audited_entities?: unknown[]
        dpc_act_sections?: string[]
        examination_coverage?: { coverage_type: string }
      }
      report_level: {
        jurisdiction: string
        audit_report_status?: string
        report_number?: { number: number; year: number }
        state_ut?: { id: string; name: MLString }
        tabling?: {
          applicable: boolean
          lower_house?: { name: MLString; date_of_placing?: string }
        }
        signed_by?: { name: MLString; designation: MLString; date?: string; place?: MLString }
        countersigned_by?: { name: MLString; designation: MLString; date?: string; place?: MLString }
      }
    }
  }
  structure_summary?: {
    content_unit_count: number
    front_matter_count: number
    back_matter_count: number
  }
  audit_findings_categories?: string[]
}

// ── Content Unit (from structure.json or units/*.json) ───────
export interface ContentUnit {
  unit_id: string
  unit_type: 'chapter' | 'section' | 'preface' | 'executive_summary' | 'appendix' | 'annexure'
  seq: number
  parent_id?: string | null
  children?: string[]  // child unit_ids — written by structure.json (parent_id may be absent)
  title?: MLString
  executive_summary?: MLString
  slug?: string
  para_number?: string
  toc_include?: boolean
  children?: string[]
  metadata?: {
    audit_type?: string[]
    report_sector?: string[]
    audit_period?: { start_year: number; end_year: number }
    topics?: string[]
    audit_findings_categories?: string[]
    primary_schemes?: string[]
    main_audited_entities?: unknown[]
    dpc_act_sections?: string[]
  }
}

export interface ReportStructure {
  product_id: string
  front_matter: ContentUnit[]
  content_units: ContentUnit[]
  back_matter: ContentUnit[]
}

// ── Content Block (from NDJSON files) ────────────────────────
export interface ContentBlock {
  block_id: string
  block_type: string
  unit_id: string
  seq: number
  para_number?: string
  lang?: string
  toc_include?: boolean
  group_id?: string
  group_role?: string
  footnote_ids?: string[]
  block_metadata?: {
    audit_findings_categories?: string[]
    key_findings?: string[]
    referenced_entities?: string[]
  }
  annotations?: Annotation[]
  content: BlockContent
  resolved_meta?: {
    audit_type?: string[]
    report_sector?: string[]
    topics?: string[]
    audit_findings_categories?: string[]
    audit_period?: { start_year: number; end_year: number }
    main_audited_entities?: unknown[]
    dpc_act_sections?: string[]
    examination_coverage?: { coverage_type: string }
  }
}

export interface Annotation {
  annotation_id: string
  lang: string
  start: number
  end: number
  annotation_type: string
  source?: string
  reviewed?: boolean
}

export interface BlockContent {
  // paragraph / heading / recommendation
  text?: MLString
  level?: number           // heading level
  para_type?: string       // paragraph sub-type
  collapsed?: boolean
  // list
  items?: ListItem[]
  list_type?: string
  // richbox
  box_type?: string
  title?: MLString
  body?: RichboxBodyItem[]
  // table
  caption?: MLString
  unit_note?: MLString
  table_number?: string
  dataset_ref?: string
  source?: MLString
  notes?: MLString
  // image / figure / map
  asset_ref?: string
  alt_text?: MLString
  image_type?: string
  // signature_block
  signatories?: Signatory[]
}

export interface ListItem {
  text?: MLString
  sub_items?: Array<{ text: MLString }>
  para_number?: string
  footnote_markers?: string[]
}

export interface RichboxBodyItem {
  type: string
  text?: MLString
  level?: number
  items?: Array<{ text: MLString; sub_items?: Array<{ text: MLString }> }>
  caption?: MLString
  dataset_ref?: string
}

export interface Signatory {
  name?: MLString
  designation?: MLString
  date?: string
  place?: MLString
}

// ── Block vector (from Atlas block_vectors) ──────────────────
export interface BlockVector {
  _id?: string
  block_id: string
  product_id: string
  unit_id: string
  block_type: string
  para_type?: string
  para_number?: string
  seq: number
  text_snippet?: string
  audit_metadata?: {
    audit_findings_categories?: string[]
    key_findings?: string[]
  }
  annotations?: Annotation[]
  resolved_meta?: {
    audit_type?: string[]
    report_sector?: string[]
    topics?: string[]
    audit_findings_categories?: string[]
    audit_period?: { start_year: number; end_year: number }
    main_audited_entities?: unknown[]
    dpc_act_sections?: string[]
  }
}

// ── Flat ordered unit list (for navigation) ──────────────────
export interface FlatUnit extends ContentUnit {
  depth: number
  index: number
  sectionPath: string[]  // [chapterId, ...] for breadcrumb
}

export function buildFlatUnitList(structure: ReportStructure): FlatUnit[] {
  // structure.json written by the builder uses children[] not parent_id.
  // Algorithm:
  //   1. Build id→unit map from all units
  //   2. Determine which unit_ids appear as someone's child (child_set)
  //   3. Roots = units NOT in child_set, walked in group order (fm→cu→bm), sorted by seq
  //   4. Walk each root recursively via children[], sorted by seq, setting parent_id

  const groups = [
    structure.front_matter  || [],
    structure.content_units || [],
    structure.back_matter   || [],
  ]

  // id → unit lookup across all groups
  const byId: Record<string, ContentUnit> = {}
  groups.forEach(g => g.forEach(u => { byId[u.unit_id] = u }))

  // Set of all unit_ids that are listed as a child of some unit
  const childSet = new Set<string>()
  Object.values(byId).forEach(u => {
    (u.children || []).forEach(cid => childSet.add(cid))
  })

  const ordered: FlatUnit[] = []
  let index = 0

  function walk(u: ContentUnit, depth: number, parentId: string | null, path: string[]) {
    // Attach parent_id dynamically so getSections() works
    const flat: FlatUnit = { ...u, parent_id: parentId ?? undefined, depth, index: index++, sectionPath: path }
    ordered.push(flat)
    // Recurse into children[], sorted by seq
    const childUnits = (u.children || [])
      .map(cid => byId[cid])
      .filter(Boolean)
      .sort((a, b) => (a.seq || 0) - (b.seq || 0))
    childUnits.forEach(child => walk(child, depth + 1, u.unit_id, [...path, u.unit_id]))
  }

  // Walk each group in order; roots = not listed as any child, sorted by seq
  groups.forEach(group => {
    group
      .filter(u => !childSet.has(u.unit_id))
      .sort((a, b) => (a.seq || 0) - (b.seq || 0))
      .forEach(u => walk(u, 0, null, []))
  })

  return ordered
}
