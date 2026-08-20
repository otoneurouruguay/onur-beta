import type { ClinicalStudyReview, MetricRowInput } from '../studies/types'

export type ClinicalReportType = 'evolution' | 'finalization'

export interface ClinicalReportNarratives {
  clinicalSynthesis: string
  globalEvolution: string
  generalReading: string
  mainChange: string
  sensoryIntegration: string
  initialInterpretation: string
  startingPoint: string
  finalResult: string
  finalInterpretation: string
  conclusion: string
  recommendations: string
}

export interface ClinicalReportStudyFigure {
  documentId: string
  pageNumber: number
}

export interface ClinicalReportTemplateSnapshot {
  schemaVersion: 'onur-clinical-report-v1'
  reportType: ClinicalReportType
  emissionDate: string
  narratives: ClinicalReportNarratives
  studyFigures: {
    initial: ClinicalReportStudyFigure
    final: ClinicalReportStudyFigure
  }
}

export interface ClinicalComparisonRow {
  key: string
  label: string
  initial: string
  final: string
}

export const emptyClinicalReportNarratives: ClinicalReportNarratives = {
  clinicalSynthesis: '',
  globalEvolution: '',
  generalReading: '',
  mainChange: '',
  sensoryIntegration: '',
  initialInterpretation: '',
  startingPoint: '',
  finalResult: '',
  finalInterpretation: '',
  conclusion: '',
  recommendations: '',
}

const comparisonDefinitions = [
  { key: 'composite', label: 'Puntaje compuesto', code: 'composite_score' },
  { key: 'condition-5', label: 'Condición 5', code: 'condition_score', condition: '5' },
  { key: 'condition-6', label: 'Condición 6', code: 'condition_score', condition: '6' },
  { key: 'somatosensory', label: 'Organización somatosensorial', code: 'sensory_ratio_somatosensory' },
  { key: 'visual', label: 'Organización visual', code: 'sensory_ratio_visual' },
  { key: 'vestibular', label: 'Organización vestibular', code: 'sensory_ratio_vestibular' },
  { key: 'visual-preference', label: 'Preferencia visual', code: 'visual_preference_index' },
  { key: 'area', label: 'Área registrada', code: 'los_area' },
] as const

function folded(value: string) {
  return value.trim().toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function conditionMatches(metric: MetricRowInput, expected?: string) {
  if (!expected) return true
  const condition = folded(metric.conditionCode)
  return condition === expected || condition === `c${expected}` || condition === `condicion${expected}`
}

function findMetric(study: ClinicalStudyReview | null | undefined, code: string, condition?: string) {
  return study?.metrics.find((metric) => metric.metricCode === code && conditionMatches(metric, condition))
}

function unitSuffix(unit: string) {
  if (unit === 'percent') return '%'
  if (unit === 'seconds') return ' s'
  if (unit === 'deg') return '°'
  if (unit === 'deg_s') return ' °/s'
  if (unit === 'cm2') return ' cm²'
  if (unit === 'mm2') return ' mm²'
  return ''
}

function displayMetric(metric: MetricRowInput | undefined) {
  if (!metric?.rawValue.trim()) return '—'
  return `${metric.rawValue.trim()}${unitSuffix(metric.unitCode)}`
}

export function buildClinicalComparison(initial: ClinicalStudyReview | null | undefined, final: ClinicalStudyReview | null | undefined): ClinicalComparisonRow[] {
  return comparisonDefinitions.flatMap((definition) => {
    const initialMetric = findMetric(initial, definition.code, 'condition' in definition ? definition.condition : undefined)
    const finalMetric = findMetric(final, definition.code, 'condition' in definition ? definition.condition : undefined)
    if (!initialMetric && !finalMetric) return []
    return [{ key: definition.key, label: definition.label, initial: displayMetric(initialMetric), final: displayMetric(finalMetric) }]
  })
}

export function objectiveComparisonSentence(rows: ClinicalComparisonRow[]) {
  const completeRows = rows.filter((row) => row.initial !== '—' && row.final !== '—')
  if (!completeRows.length) return ''
  return completeRows.map((row) => `${row.label}: ${row.initial} → ${row.final}`).join('; ') + '.'
}

export function isClinicalReportTemplateSnapshot(value: unknown): value is ClinicalReportTemplateSnapshot {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.schemaVersion === 'onur-clinical-report-v1' && Boolean(record.narratives) && Boolean(record.studyFigures)
}
