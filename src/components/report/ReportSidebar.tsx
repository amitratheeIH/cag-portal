'use client'

// ReportSidebar.tsx
import React, { useState } from 'react'
import { afcLabel } from '@/lib/taxonomy-labels'

// ── Topics taxonomy: sub_topic → { parentId, parentLabel, subLabel } ─
const TOPICS_MAP: Record<string,{ parentId:string; parentLabel:string; subLabel:string }> = {
  // Labour & Social Welfare
  construction_workers:       { parentId:'labour_welfare', parentLabel:'Labour & Social Welfare', subLabel:'Building & Construction Worker Welfare' },
  unorganised_workers:        { parentId:'labour_welfare', parentLabel:'Labour & Social Welfare', subLabel:'Social Security for Unorganised Workers' },
  labour_standards:           { parentId:'labour_welfare', parentLabel:'Labour & Social Welfare', subLabel:'Labour Standards & Enforcement' },
  esic:                       { parentId:'labour_welfare', parentLabel:'Labour & Social Welfare', subLabel:'ESIC Health Insurance' },
  epfo:                       { parentId:'labour_welfare', parentLabel:'Labour & Social Welfare', subLabel:'EPFO Provident Fund' },
  child_labour:               { parentId:'labour_welfare', parentLabel:'Labour & Social Welfare', subLabel:'Child Labour Elimination' },
  // Health
  public_health:              { parentId:'health',         parentLabel:'Health',                  subLabel:'Public Health Services' },
  health_insurance:           { parentId:'health',         parentLabel:'Health',                  subLabel:'Government Health Insurance' },
  ayush:                      { parentId:'health',         parentLabel:'Health',                  subLabel:'AYUSH Services' },
  drug_regulation:            { parentId:'health',         parentLabel:'Health',                  subLabel:'Drug Regulation & Quality' },
  // Education
  school_education:           { parentId:'education',      parentLabel:'Education',               subLabel:'School Education' },
  higher_education:           { parentId:'education',      parentLabel:'Education',               subLabel:'Higher Education' },
  mid_day_meal:               { parentId:'education',      parentLabel:'Education',               subLabel:'Mid-Day Meal Scheme' },
  // Agriculture
  crop_production:            { parentId:'agriculture',    parentLabel:'Agriculture',             subLabel:'Crop Production & Support' },
  irrigation:                 { parentId:'agriculture',    parentLabel:'Agriculture',             subLabel:'Irrigation Infrastructure' },
  fertiliser:                 { parentId:'agriculture',    parentLabel:'Agriculture',             subLabel:'Fertiliser Subsidy' },
  // Urban development
  smart_cities:               { parentId:'urban',          parentLabel:'Urban Development',       subLabel:'Smart Cities Mission' },
  urban_housing:              { parentId:'urban',          parentLabel:'Urban Development',       subLabel:'Urban Housing' },
  swachh_bharat:              { parentId:'urban',          parentLabel:'Urban Development',       subLabel:'Swachh Bharat (Urban)' },
  // Rural development
  mgnregs:                    { parentId:'rural',          parentLabel:'Rural Development',       subLabel:'MGNREGS' },
  pmgsy:                      { parentId:'rural',          parentLabel:'Rural Development',       subLabel:'PMGSY Rural Roads' },
  rural_housing:              { parentId:'rural',          parentLabel:'Rural Development',       subLabel:'Rural Housing' },
  // Social welfare
  women_welfare:              { parentId:'social_welfare', parentLabel:'Social Welfare',          subLabel:'Women & Child Development' },
  sc_st_welfare:              { parentId:'social_welfare', parentLabel:'Social Welfare',          subLabel:'SC/ST Welfare Schemes' },
  disability:                 { parentId:'social_welfare', parentLabel:'Social Welfare',          subLabel:'Disability Services' },
  elderly:                    { parentId:'social_welfare', parentLabel:'Social Welfare',          subLabel:'Elderly Care' },
  // Environment
  forest_environment:         { parentId:'environment',    parentLabel:'Environment & Forests',   subLabel:'Forest Management' },
  pollution_control:          { parentId:'environment',    parentLabel:'Environment & Forests',   subLabel:'Pollution Control' },
  renewable_energy:           { parentId:'environment',    parentLabel:'Environment & Forests',   subLabel:'Renewable Energy' },
}

function topicFallback(id: string) {
  return { parentId: 'other', parentLabel: 'Other Topics', subLabel: id.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()) }
}

// ── AFC taxonomy ─────────────────────────────────────────────
const AFC_MAP: Record<string,{ parentId:string; parentLabel:string; subLabel:string }> = {
  wasteful_expenditure:              { parentId:'financial',      parentLabel:'Financial Irregularities',           subLabel:'Wasteful Expenditure' },
  infructuous_expenditure:           { parentId:'financial',      parentLabel:'Financial Irregularities',           subLabel:'Infructuous Expenditure' },
  avoidable_expenditure:             { parentId:'financial',      parentLabel:'Financial Irregularities',           subLabel:'Avoidable Expenditure' },
  excess_payment:                    { parentId:'financial',      parentLabel:'Financial Irregularities',           subLabel:'Excess Payment' },
  irregular_expenditure:             { parentId:'financial',      parentLabel:'Financial Irregularities',           subLabel:'Irregular / Unauthorised Expenditure' },
  autonomous_excess_admin_expenditure:{ parentId:'enterprises',   parentLabel:'Autonomous Body Failures',          subLabel:'Excessive Administrative Expenditure' },
  short_levy:                        { parentId:'revenue',        parentLabel:'Revenue & Receipts Failures',        subLabel:'Short Levy / Under-Assessment' },
  non_collection:                    { parentId:'revenue',        parentLabel:'Revenue & Receipts Failures',        subLabel:'Non-Collection of Government Dues' },
  noncollection_arrears:             { parentId:'revenue',        parentLabel:'Revenue & Receipts Failures',        subLabel:'Revenue Arrears Not Pursued' },
  statutory_act_violation:           { parentId:'compliance',     parentLabel:'Regulatory & Statutory Compliance',  subLabel:'Violation of Act Provisions' },
  gfr_violation:                     { parentId:'compliance',     parentLabel:'Regulatory & Statutory Compliance',  subLabel:'Violation of GFR' },
  target_coverage_shortfall:         { parentId:'scheme',         parentLabel:'Programme & Scheme Implementation',  subLabel:'Coverage Targets Not Achieved' },
  target_physical_missed:            { parentId:'scheme',         parentLabel:'Programme & Scheme Implementation',  subLabel:'Physical Targets Not Met' },
  target_funds_unspent:              { parentId:'scheme',         parentLabel:'Programme & Scheme Implementation',  subLabel:'Funds Lapsed / Not Utilised' },
  beneficiary_excluded:              { parentId:'scheme',         parentLabel:'Programme & Scheme Implementation',  subLabel:'Eligible Beneficiary Excluded' },
  effectiveness_objective_not_met:   { parentId:'effectiveness',  parentLabel:'Effectiveness Failures',             subLabel:'Programme Objectives Not Achieved' },
  effectiveness_beneficiary_satisfaction:{ parentId:'effectiveness', parentLabel:'Effectiveness Failures',          subLabel:'Low Beneficiary Satisfaction' },
  uc_partial_utilisation:            { parentId:'grants',         parentLabel:'Grants-in-Aid & Loans',              subLabel:'Grants Partially Utilised' },
  dbt_delay:                         { parentId:'dbt',            parentLabel:'Direct Benefit Transfer Failures',   subLabel:'DBT Payments Significantly Delayed' },
  data_incomplete:                   { parentId:'data',           parentLabel:'Poor Data Quality',                  subLabel:'Incomplete / Missing Records' },
  data_inconsistent:                 { parentId:'data',           parentLabel:'Poor Data Quality',                  subLabel:'Inconsistent Data Across Systems' },
  records_not_maintained:            { parentId:'records',        parentLabel:'Records Management Failures',        subLabel:'Mandatory Registers Not Maintained' },
  records_not_reconciled:            { parentId:'records',        parentLabel:'Records Management Failures',        subLabel:'Financial Records Not Reconciled' },
  it_not_integrated:                 { parentId:'it',             parentLabel:'IT & Digital Governance',            subLabel:'Systems Not Integrated' },
  monitoring_no_inspection:          { parentId:'monitoring',     parentLabel:'Monitoring & Oversight Failure',     subLabel:'No Site Inspection' },
  monitoring_no_internal_audit:      { parentId:'monitoring',     parentLabel:'Monitoring & Oversight Failure',     subLabel:'Internal Audit Not Conducted' },
  social_audit_not_conducted:        { parentId:'monitoring',     parentLabel:'Monitoring & Oversight Failure',     subLabel:'Social Audit Not Conducted' },
  para_recurrence:                   { parentId:'followup',       parentLabel:'Audit Follow-Up & Compliance',       subLabel:'Recurrence of Audit Findings' },
}

const AFC_COLOURS: Record<string,string> = {
  financial:'#8b1a1a', enterprises:'#8b5a1a', revenue:'#7a3a00',
  compliance:'#1a3a6b', scheme:'#245c36', effectiveness:'#5a1a6b',
  grants:'#1a5a6b', dbt:'#3a5a1a', data:'#6b3a1a',
  records:'#5a5a1a', it:'#1a1a6b', monitoring:'#6b1a5a',
  followup:'#3a3a1a', other:'#3a3a3a',
}

function buildGroups<T extends { parentId:string; parentLabel:string; subLabel:string }>(
  ids: string[],
  map: Record<string,T>,
  fallback: (id:string)=>T
): { parentId:string; parentLabel:string; subs:{id:string;label:string}[] }[] {
  const groups: Record<string,{ parentId:string; parentLabel:string; subs:{id:string;label:string}[] }> = {}
  for (const id of ids) {
    const m = map[id] || fallback(id)
    if (!groups[m.parentId]) groups[m.parentId] = { parentId:m.parentId, parentLabel:m.parentLabel, subs:[] }
    groups[m.parentId].subs.push({ id, label:m.subLabel })
  }
  return Object.values(groups)
}

// ── Reusable collapsible group row ───────────────────────────
function GroupRow({
  parentLabel, colour, subs, defaultOpen = false,
}: {
  parentLabel: string
  colour: string
  subs: { label:string; tags?:{ pnum:string; href:string }[] }[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom:'1px solid var(--rule-lt)' }}>
      <button onClick={()=>setOpen(v=>!v)} aria-expanded={open}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', padding:'9px 16px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:colour, flexShrink:0 }}/>
        <span style={{ fontFamily:'system-ui', fontSize:'12.5px', fontWeight:600, color:'var(--ink)', flex:1 }}>{parentLabel}</span>
        <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, background:colour+'18', color:colour, padding:'1px 7px', borderRadius:'10px', flexShrink:0 }}>
          {subs.length}
        </span>
        <svg width="12" height="12" fill="none" stroke="var(--ink3)" strokeWidth="2.5" viewBox="0 0 24 24"
          style={{ flexShrink:0, transition:'transform .15s', transform:open?'rotate(180deg)':'none' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{ paddingBottom:'6px' }}>
          {subs.map((sub, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'4px 16px 4px 30px' }}>
              <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:colour+'70', flexShrink:0, marginTop:'6px' }}/>
              <div style={{ flex:1 }}>
                <span style={{ fontFamily:'system-ui', fontSize:'11.5px', color:'var(--ink2)' }}>{sub.label}</span>
                {sub.tags && sub.tags.length > 0 && (
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'3px' }}>
                    {sub.tags.map(t => (
                      <a key={t.href} href={t.href} style={{
                        fontFamily:'system-ui', fontSize:'9.5px', fontWeight:600,
                        background:colour+'14', color:colour,
                        padding:'1px 7px', borderRadius:'8px',
                        border:`1px solid ${colour}30`,
                        textDecoration:'none', cursor:'pointer',
                        transition:'background .12s',
                      }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=colour+'28'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=colour+'14'}
                      title={`Go to section ${t.pnum}`}>
                        §{t.pnum}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section header (shared style) ────────────────────────────
function SectionHeader({ title, count, hint }: { title:string; count?:number; hint?:string }) {
  return (
    <div style={{ padding:'11px 16px', borderBottom:'1px solid var(--rule-lt)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'var(--ink3)' }}>{title}</span>
      {(count !== undefined || hint) && (
        <span style={{ fontFamily:'system-ui', fontSize:'10px', color:'var(--ink3)' }}>
          {count !== undefined ? count : ''}{hint ? ` ${hint}` : ''}
        </span>
      )}
    </div>
  )
}

// ── Recommendations collapsible section ──────────────────────
function RecommendationsSection({ recs }: { recs:{block_id:string; text:string}[] }) {
  const [open, setOpen] = useState(false)
  return (
    <section style={{ background:'#fff', border:'1px solid var(--rule)', borderRadius:'10px', overflow:'hidden', marginBottom:'14px' }}>
      {/* Header — always clickable */}
      <button onClick={()=>setOpen(v=>!v)} aria-expanded={open}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:'10px',
          padding:'12px 16px', background:open?'var(--green-lt)':'#fff',
          border:'none', cursor:'pointer', textAlign:'left',
          borderBottom: open ? '1px solid var(--rule-lt)' : 'none',
          transition:'background .15s',
        }}>
        <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:'var(--green)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <span style={{ fontFamily:'system-ui', fontSize:'12.5px', fontWeight:700, color:'var(--green)', flex:1 }}>
          Recommendations
        </span>
        <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, background:'var(--green-lt)', color:'var(--green)', padding:'1px 8px', borderRadius:'10px', border:'1px solid rgba(36,92,54,.2)', flexShrink:0 }}>
          {recs.length}
        </span>
        <svg width="12" height="12" fill="none" stroke="var(--green)" strokeWidth="2.5" viewBox="0 0 24 24"
          style={{ flexShrink:0, transition:'transform .15s', transform:open?'rotate(180deg)':'none' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <ol style={{ margin:0, padding:'6px 0', listStyle:'none' }}>
          {recs.map((rec, i) => (
            <li key={rec.block_id} style={{
              padding:'10px 16px',
              borderBottom: i < recs.length-1 ? '1px solid var(--rule-lt)' : 'none',
              display:'flex', gap:'10px', alignItems:'flex-start',
            }}>
              <span style={{
                flexShrink:0, width:'20px', height:'20px', borderRadius:'50%',
                background:'var(--green)', color:'#fff',
                fontFamily:'system-ui', fontSize:'10px', fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', marginTop:'2px',
              }}>{i+1}</span>
              <p style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'14.5px', lineHeight:1.6, color:'var(--ink)', margin:0, textAlign:'justify' }}>
                {rec.text.replace(/^Recommendation\s+\d+:\s*/i,'')}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// ── Main export ───────────────────────────────────────────────
interface Props {
  detailRows:     { label:string; value:string }[]
  topics:         string[]
  afcCats:        string[]
  sectionAfcMap:  Record<string,{ pnum:string; unit_id:string }[]>
  recommendations: { block_id:string; text:string }[]
  reportId:       string
}

export default function ReportSidebar({ detailRows, topics, afcCats, sectionAfcMap, recommendations, reportId }: Props) {
  const afcGroups  = buildGroups(afcCats, AFC_MAP, id => ({ parentId:'other', parentLabel:'Other Findings', subLabel: afcLabel(id) }))
  const topicGroups = buildGroups(topics, TOPICS_MAP, topicFallback)

  return (
    <>
      {/* Report Details */}
      <section style={{ background:'#fff', border:'1px solid var(--rule)', borderRadius:'10px', overflow:'hidden', marginBottom:'14px' }}>
        <div style={{ background:'var(--navy)', padding:'11px 16px' }}>
          <span style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(255,255,255,.7)' }}>Report Details</span>
        </div>
        <div>
          {detailRows.map(({ label, value }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', gap:'12px', padding:'8px 16px', borderBottom:'1px solid var(--rule-lt)' }}>
              <span style={{ fontFamily:'system-ui', fontSize:'11px', color:'var(--ink3)', fontWeight:600, flexShrink:0 }}>{label}</span>
              <span style={{ fontFamily:'system-ui', fontSize:'11px', color:'var(--ink)', textAlign:'right' }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Topics — hierarchical */}
      {topicGroups.length > 0 && (
        <section style={{ background:'#fff', border:'1px solid var(--rule)', borderRadius:'10px', overflow:'hidden', marginBottom:'14px' }}>
          <SectionHeader title="Topics" count={topicGroups.length} hint="categor" />
          {topicGroups.map(g => (
            <GroupRow key={g.parentId}
              parentLabel={g.parentLabel}
              colour={AFC_COLOURS[g.parentId]||'#7a3a00'}
              subs={g.subs.map(s=>({ label:s.label }))}
            />
          ))}
        </section>
      )}

      {/* AFC — hierarchical with clickable section refs */}
      {afcGroups.length > 0 && (
        <section style={{ background:'#fff', border:'1px solid var(--rule)', borderRadius:'10px', overflow:'hidden', marginBottom:'14px' }}>
          <SectionHeader title="Audit Finding Categories" hint="· click to expand" />
          {afcGroups.map(g => (
            <GroupRow key={g.parentId}
              parentLabel={g.parentLabel}
              colour={AFC_COLOURS[g.parentId]||'#1a3a6b'}
              subs={g.subs.map(s => ({
                label: s.label,
                tags:  (sectionAfcMap[s.id] || []).map(({ pnum, unit_id }) => ({
                  pnum,
                  href: `/report/${reportId}/read?unit=${unit_id}`,
                })),
              }))}
            />
          ))}
        </section>
      )}

      {/* Recommendations — collapsed by default */}
      {recommendations.length > 0 && (
        <RecommendationsSection recs={recommendations}/>
      )}
    </>
  )
}
