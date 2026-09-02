import type { QualityStatus, SuggestionStatus } from '../../types/domain'
import type { CycleStudyPhase } from '../documents/types'

export type StudyType = 'posturography' | 'vhit'
export type MetricValueKind = 'numeric' | 'categorical' | 'boolean' | 'text'
export type MetricSide = 'left' | 'right' | 'bilateral' | 'unknown' | ''

export interface MetricDefinition {
  code: string
  label: string
  domain: StudyType
  valueKind: MetricValueKind
  allowedUnits: string[]
  requiresUnit: boolean
  requiresCondition?: boolean
  zeroAllowed: boolean | 'unknown'
}

export interface MetricRowInput {
  clientId: string
  metricCode: string
  rawValue: string
  unitCode: string
  conditionCode: string
  side: MetricSide
  axis: string
  trialNumber: string
  sourceLocation: string
}

export interface MetricQualityIssue {
  ruleCode: string
  severity: Exclude<QualityStatus, 'ok'>
  message: string
}

export interface NormalizedMetricRow extends MetricRowInput {
  normalizedNumericValue: number | null
  normalizedTextValue: string | null
  normalizationRuleVersion: string
  qualityStatus: QualityStatus | 'not_applicable'
  issues: MetricQualityIssue[]
}

export interface ClinicalStudyReview {
  id: string
  patientId: string
  patientName: string
  treatmentCycleId: string
  sourceDocumentId: string
  sourceFilename: string
  studyType: StudyType
  cyclePhase: CycleStudyPhase
  performedAt: string
  deviceName: string
  softwareVersion: string
  protocolCode: string
  protocolVersion: string
  calculationMethodVersion: string
  status: 'draft' | 'reviewed' | 'finalized'
  qualityNotes: string
  interpretable: boolean
  metrics: MetricRowInput[]
}

export interface ClinicalStudySummary {
  id: string
  patientId: string
  patientName: string
  treatmentCycleId: string
  sourceFilename: string
  studyType: StudyType
  cyclePhase: CycleStudyPhase
  performedAt: string
  deviceName: string
  protocolCode: string
  protocolVersion: string
  status: ClinicalStudyReview['status']
  interpretable: boolean
  metricCount: number
  issueCount: number
}

export interface SaveStudyImportInput {
  studyId: string
  metrics: NormalizedMetricRow[]
  qualityNotes: string
  interpretable: boolean
}

export interface SaveStudyImportResult {
  metricCount: number
  issueCount: number
  suggestionCount: number
}

export interface StatisticalSuggestionRecord {
  id: string
  patientId: string
  patientName: string
  studyId: string
  treatmentCycleId: string
  studyLabel: string
  ruleCode: string
  ruleTitle: string
  summary: string
  limitation: string
  observedResult: Record<string, unknown>
  createdAt: string
  status: SuggestionStatus
  professionalText: string
}
