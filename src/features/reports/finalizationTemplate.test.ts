import { describe, expect, it } from 'vitest'
import type { ClinicalStudyReview } from '../studies/types'
import { buildClinicalComparison, isClinicalReportTemplateSnapshot, objectiveComparisonSentence } from './finalizationTemplate'

function study(values: Array<{ code: string; value: string; condition?: string }>): ClinicalStudyReview {
  return {
    id: crypto.randomUUID(), patientId: 'patient-1', patientName: 'Paciente', treatmentCycleId: 'cycle-1', sourceDocumentId: '', sourceFilename: '', studyType: 'posturography', cyclePhase: 'initial', performedAt: '2026-01-01T12:00:00.000Z', deviceName: '', softwareVersion: '', protocolCode: 'bap', protocolVersion: '1', calculationMethodVersion: '1', status: 'finalized', qualityNotes: '', interpretable: true,
    metrics: values.map((item, index) => ({ clientId: String(index), metricCode: item.code, rawValue: item.value, unitCode: 'score', conditionCode: item.condition ?? '', side: '', axis: '', trialNumber: '1', sourceLocation: 'Página 1' })),
  }
}

describe('plantilla de informe de finalización', () => {
  it('compara solamente métricas disponibles y reconoce condición 5 y 6', () => {
    const rows = buildClinicalComparison(
      study([{ code: 'composite_score', value: '75' }, { code: 'condition_score', value: '54', condition: 'C5' }]),
      study([{ code: 'composite_score', value: '93' }, { code: 'condition_score', value: '87', condition: 'Condición 5' }]),
    )
    expect(rows).toEqual([
      { key: 'composite', label: 'Puntaje compuesto', initial: '75', final: '93' },
      { key: 'condition-5', label: 'Condición 5', initial: '54', final: '87' },
    ])
    expect(objectiveComparisonSentence(rows)).toContain('Puntaje compuesto: 75 → 93')
  })

  it('distingue la instantánea nueva de informes históricos', () => {
    expect(isClinicalReportTemplateSnapshot({ sessions: [] })).toBe(false)
    expect(isClinicalReportTemplateSnapshot({ schemaVersion: 'onur-clinical-report-v1', narratives: {}, studyFigures: {} })).toBe(true)
  })
})
