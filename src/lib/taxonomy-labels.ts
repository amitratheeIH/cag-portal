// lib/taxonomy-labels.ts
// Single source of truth for human-readable labels.
// Used by both ReportSidebar (client) and ReaderClient (client).

export const AFC_LABELS: Record<string, string> = {
  // Financial
  wasteful_expenditure:              'Wasteful Expenditure',
  infructuous_expenditure:           'Infructuous Expenditure',
  avoidable_expenditure:             'Avoidable Expenditure',
  excess_payment:                    'Excess Payment',
  irregular_expenditure:             'Irregular / Unauthorised Expenditure',
  advances_management:               'Advance Payments & Imprest Irregularities',
  misappropriation_fraud:            'Misappropriation, Fraud & Embezzlement',
  writeoff_losses:                   'Write-Off & Unrecouped Losses',
  autonomous_excess_admin_expenditure:'Excessive Administrative Expenditure',
  // Revenue
  short_levy:                        'Short Levy / Under-Assessment',
  non_collection:                    'Non-Collection of Government Dues',
  noncollection_arrears:             'Revenue Arrears Not Pursued',
  revenue_foregone:                  'Revenue Foregone / Waived',
  financial_reporting_failures:      'Financial Reporting Failures',
  // Compliance
  statutory_act_violation:           'Violation of Act Provisions',
  gfr_violation:                     'Violation of General Financial Rules (GFR)',
  // Scheme implementation
  target_coverage_shortfall:         'Coverage Targets Not Achieved',
  target_physical_missed:            'Physical Targets Not Met',
  target_funds_unspent:              'Funds Not Utilised — Lapsed / Surrendered',
  wrong_beneficiary:                 'Wrong / Ineligible Beneficiary Selected',
  beneficiary_excluded:              'Eligible Beneficiary Excluded',
  last_mile_delivery:                'Last Mile Delivery Failure',
  scheme_design_failure:             'Scheme Design & Appraisal Failure',
  fund_diversion_scheme:             'Diversion / Misuse of Scheme Funds',
  // Effectiveness
  effectiveness_objective_not_met:   'Programme Objectives Not Achieved',
  effectiveness_beneficiary_satisfaction: 'Low Beneficiary Satisfaction',
  // Grants
  uc_failure:                        'Utilisation Certificate (UC) Failures',
  uc_partial_utilisation:            'Grants Partially Utilised',
  grant_diversion:                   'Diversion / Misuse of Grants',
  loan_recovery:                     'Government Loan Recovery Failures',
  social_audit_not_actioned:         'Social Audit Findings Not Acted Upon',
  // DBT
  dbt_failure:                       'DBT Payment System Failures',
  dbt_delay:                         'DBT Payments Significantly Delayed',
  subsidy_leakage:                   'Subsidy Leakage & Mis-Targeting',
  // Data & records
  data_incomplete:                   'Incomplete / Missing Records',
  data_inconsistent:                 'Inconsistent Data Across Systems',
  records_not_maintained:            'Mandatory Registers Not Maintained',
  records_not_reconciled:            'Financial Records Not Reconciled',
  // IT
  it_not_integrated:                 'IT Systems Not Integrated',
  // Monitoring
  monitoring_no_inspection:          'No Site Inspection / Physical Verification',
  monitoring_no_internal_audit:      'Internal Audit Not Conducted',
  social_audit_not_conducted:        'Mandatory Social Audit Not Conducted',
  // Asset management
  idle_assets:                       'Idle / Non-Functional Assets',
  poor_maintenance:                  'Inadequate Maintenance of Assets',
  land_asset_management:             'Government Land & Property Management Failures',
  // Follow-up
  para_recurrence:                   'Recurrence of Audit Findings',
}

export function afcLabel(id: string): string {
  return AFC_LABELS[id] || id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}
