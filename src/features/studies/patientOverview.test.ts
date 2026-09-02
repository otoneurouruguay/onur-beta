import { describe, expect, it } from 'vitest'
import { buildPatientStudyOverview } from './patientOverview'
import type { ClinicalStudySummary } from './types'

function study(overrides: Partial<ClinicalStudySummary>): ClinicalStudySummary {
  return {
    id: 'study', patientId: 'patient-1', patientName: 'Paciente', treatmentCycleId: 'cycle-1',
    sourceFilename: 'estudio.pdf', studyType: 'posturography', cyclePhase: 'initial',
    performedAt: '2026-08-01T12:00:00.000Z', deviceName: '', protocolCode: 'bap',
    protocolVersion: '1', status: 'draft', interpretable: false, metricCount: 0, issueCount: 0,
    ...overrides,
  }
}

describe('resumen de estudios dentro del perfil del paciente', () => {
  it('separa los espacios inicial y final del ciclo activo y conserva los informes', () => {
    const initial = study({ id: 'initial' })
    const final = study({ id: 'final', cyclePhase: 'final' })
    const report = study({ id: 'report', studyType: 'vhit', cyclePhase: 'unspecified' })
    const anotherCycle = study({ id: 'old', treatmentCycleId: 'cycle-old' })
    const anotherPatient = study({ id: 'other', patientId: 'patient-2' })

    const overview = buildPatientStudyOverview(
      [initial, final, report, anotherCycle, anotherPatient],
      'patient-1',
      'cycle-1',
    )

    expect(overview.initialPosturography?.id).toBe('initial')
    expect(overview.finalPosturography?.id).toBe('final')
    expect(overview.reports.map((item) => item.id)).toEqual(['report'])
    expect(overview.patientStudies.map((item) => item.id)).toEqual(['initial', 'final', 'report', 'old'])
  })
})
