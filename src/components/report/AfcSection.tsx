'use client'

// AfcSection.tsx
// Displays audit_findings_categories in a two-level hierarchy.
// Parent categories are always visible; sub-categories collapse/expand.
// The taxonomy mapping is baked in — no DB call needed at render time.

import React, { useState } from 'react'

// ── Full parent→children taxonomy map ────────────────────────
// Sub-category ID → { parentId, parentLabel, subLabel }
const AFC_MAP: Record<string, { parentId: string; parentLabel: string; subLabel: string }> = {
  // Financial Irregularities
  wasteful_expenditure:         { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Wasteful Expenditure' },
  infructuous_expenditure:      { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Infructuous Expenditure' },
  avoidable_expenditure:        { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Avoidable Expenditure' },
  excess_payment:               { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Excess Payment' },
  irregular_expenditure:        { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Irregular / Unauthorised Expenditure' },
  advances_management:          { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Advance Payments & Imprest Irregularities' },
  misappropriation_fraud:       { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Misappropriation, Fraud & Embezzlement' },
  writeoff_losses:              { parentId: 'financial_irregularities', parentLabel: 'Financial Irregularities',          subLabel: 'Write-Off & Unrecouped Losses' },
  autonomous_excess_admin_expenditure: { parentId: 'public_enterprises', parentLabel: 'Autonomous Body / Society / Trust Failures', subLabel: 'Excessive Administrative / Overhead Expenditure' },
  // Revenue
  short_levy:                   { parentId: 'revenue_receipts',         parentLabel: 'Revenue & Receipts Failures',       subLabel: 'Short Levy / Under-Assessment' },
  non_collection:               { parentId: 'revenue_receipts',         parentLabel: 'Revenue & Receipts Failures',       subLabel: 'Non-Collection / Non-Recovery of Government Dues' },
  noncollection_arrears:        { parentId: 'revenue_receipts',         parentLabel: 'Revenue & Receipts Failures',       subLabel: 'Revenue Arrears Not Pursued' },
  statutory_act_violation:      { parentId: 'compliance',               parentLabel: 'Regulatory & Statutory Compliance', subLabel: 'Violation of Act Provisions' },
  gfr_violation:                { parentId: 'compliance',               parentLabel: 'Regulatory & Statutory Compliance', subLabel: 'Violation of General Financial Rules (GFR)' },
  // Scheme implementation
  target_coverage_shortfall:    { parentId: 'scheme_implementation',    parentLabel: 'Programme & Scheme Implementation', subLabel: 'Coverage / Beneficiary Targets Not Achieved' },
  target_physical_missed:       { parentId: 'scheme_implementation',    parentLabel: 'Programme & Scheme Implementation', subLabel: 'Physical Targets Not Met' },
  target_funds_unspent:         { parentId: 'scheme_implementation',    parentLabel: 'Programme & Scheme Implementation', subLabel: 'Funds Not Utilised — Lapsed / Surrendered' },
  beneficiary_excluded:         { parentId: 'scheme_implementation',    parentLabel: 'Programme & Scheme Implementation', subLabel: 'Eligible Beneficiary Excluded / Omitted' },
  effectiveness_objective_not_met: { parentId: 'effectiveness',         parentLabel: 'Effectiveness Failures',            subLabel: 'Programme Objectives Not Achieved' },
  effectiveness_beneficiary_satisfaction: { parentId: 'effectiveness',  parentLabel: 'Effectiveness Failures',            subLabel: 'Low Beneficiary Satisfaction' },
  last_mile_delivery:           { parentId: 'scheme_implementation',    parentLabel: 'Programme & Scheme Implementation', subLabel: 'Last Mile Delivery Failure' },
  // Grants & loans
  uc_partial_utilisation:       { parentId: 'grants_loans',             parentLabel: 'Grants-in-Aid & Loans',             subLabel: 'Grants Partially Utilised — Remainder Idle' },
  dbt_delay:                    { parentId: 'subsidy_dbt',              parentLabel: 'Subsidy & Direct Benefit Transfer',  subLabel: 'DBT Payment Significantly Delayed' },
  // Records & data
  data_incomplete:              { parentId: 'data_quality',             parentLabel: 'Poor Data Quality',                 subLabel: 'Incomplete / Missing Records' },
  data_inconsistent:            { parentId: 'data_quality',             parentLabel: 'Poor Data Quality',                 subLabel: 'Inconsistent Data Across Systems' },
  records_not_maintained:       { parentId: 'records_management',       parentLabel: 'Records Management Failures',       subLabel: 'Mandatory Registers Not Maintained' },
  records_not_reconciled:       { parentId: 'records_management',       parentLabel: 'Records Management Failures',       subLabel: 'Financial Records Not Reconciled' },
  it_not_integrated:            { parentId: 'it_governance',            parentLabel: 'IT System & Digital Governance',    subLabel: 'Systems Not Integrated' },
  // Monitoring
  monitoring_no_inspection:     { parentId: 'monitoring',               parentLabel: 'Monitoring & Oversight Failure',    subLabel: 'No Site Inspection / Physical Verification' },
  monitoring_no_internal_audit: { parentId: 'monitoring',               parentLabel: 'Monitoring & Oversight Failure',    subLabel: 'Internal Audit Not Conducted' },
  social_audit_not_conducted:   { parentId: 'monitoring',               parentLabel: 'Monitoring & Oversight Failure',    subLabel: 'Mandatory Social Audit Not Conducted' },
  // Follow-up
  para_recurrence:              { parentId: 'follow_up',                parentLabel: 'Audit Follow-Up & Compliance',      subLabel: 'Recurrence of Audit Findings' },
}

// Fallback for IDs not in the map
function fallbackLabel(id: string) {
  return id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

interface Group {
  parentId:    string
  parentLabel: string
  subs:        { id: string; label: string }[]
}

function buildGroups(afcCats: string[]): Group[] {
  const groups: Record<string, Group> = {}
  for (const id of afcCats) {
    const m = AFC_MAP[id]
    const parentId    = m?.parentId    || 'other'
    const parentLabel = m?.parentLabel || 'Other Findings'
    const subLabel    = m?.subLabel    || fallbackLabel(id)
    if (!groups[parentId]) groups[parentId] = { parentId, parentLabel, subs: [] }
    groups[parentId].subs.push({ id, label: subLabel })
  }
  return Object.values(groups)
}

const PARENT_COLOURS: Record<string, string> = {
  financial_irregularities: '#8b1a1a',
  revenue_receipts:         '#7a3a00',
  compliance:               '#1a3a6b',
  scheme_implementation:    '#245c36',
  effectiveness:            '#5a1a6b',
  grants_loans:             '#1a5a6b',
  subsidy_dbt:              '#3a5a1a',
  data_quality:             '#6b3a1a',
  records_management:       '#5a5a1a',
  it_governance:            '#1a1a6b',
  monitoring:               '#6b1a5a',
  follow_up:                '#3a3a1a',
  public_enterprises:       '#8b5a1a',
  other:                    '#3a3a3a',
}

function CategoryRow({ group }: { group: Group }) {
  const [open, setOpen] = useState(false)
  const colour = PARENT_COLOURS[group.parentId] || '#1a3a6b'

  return (
    <div style={{ borderBottom: '1px solid var(--rule-lt)' }}>
      {/* Parent row — always visible, clickable to expand */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: '10px', padding: '10px 18px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Colour dot */}
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colour, flexShrink: 0 }}/>
        {/* Parent label */}
        <span style={{ fontFamily: 'system-ui', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
          {group.parentLabel}
        </span>
        {/* Sub-count badge */}
        <span style={{
          fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700,
          background: colour + '18', color: colour,
          padding: '2px 8px', borderRadius: '10px', flexShrink: 0,
        }}>
          {group.subs.length}
        </span>
        {/* Chevron */}
        <svg width="14" height="14" fill="none" stroke="var(--ink3)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {/* Sub-categories — collapsible */}
      {open && (
        <div style={{ paddingBottom: '8px' }}>
          {group.subs.map(sub => (
            <div key={sub.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '6px 18px 6px 36px',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: colour + '80', flexShrink: 0 }}/>
              <span style={{ fontFamily: 'system-ui', fontSize: '12px', color: 'var(--ink2)' }}>
                {sub.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AfcSection({ afcCats }: { afcCats: string[] }) {
  const groups = buildGroups(afcCats)

  return (
    <section style={{ background: '#fff', border: '1px solid var(--rule)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule-lt)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)', margin: 0 }}>
          Audit Finding Categories
        </h2>
        <span style={{ fontFamily: 'system-ui', fontSize: '11px', color: 'var(--ink3)' }}>
          {groups.length} categor{groups.length === 1 ? 'y' : 'ies'} · click to expand
        </span>
      </div>
      {/* Category rows */}
      {groups.map(g => <CategoryRow key={g.parentId} group={g}/>)}
    </section>
  )
}
