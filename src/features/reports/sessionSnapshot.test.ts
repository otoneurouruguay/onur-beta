import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from '../exercise/types'
import type { SessionAssignmentRecord } from '../sessions/repository'
import { sessionReportSnapshotItem } from './sessionSnapshot'

describe('sesiones en el informe final', () => {
  it('conserva la anulación y su motivo en la instantánea versionada', () => {
    const session = {
      id: 'session-1', patientId: 'patient-1', patientName: 'Paciente', treatmentCycleId: 'cycle-1', sessionPlanId: 'plan-1',
      title: 'Sesión de prueba', instructions: '', mode: 'in_person', exercises: [defaultExerciseConfig],
      availableFrom: '2026-07-28T00:00:00.000Z', availableUntil: '', status: 'revoked', createdAt: '2026-07-28T00:00:00.000Z',
      activeSeconds: 0, completedAt: '', initialDiscomfort: null, finalDiscomfort: null, perceivedDifficulty: null, patientComment: '',
      revokedAt: '2026-07-28T12:00:00.000Z', revokedBy: 'professional-1', revokedReason: 'Era una sesión de prueba',
    } satisfies SessionAssignmentRecord
    expect(sessionReportSnapshotItem(session)).toMatchObject({
      status: 'revoked',
      revokedAt: '2026-07-28T12:00:00.000Z',
      revokedReason: 'Era una sesión de prueba',
    })
  })

  it('conserva auditoría y omisiones de una sesión retrospectiva', () => {
    const session = {
      id: 'session-2', patientId: 'patient-1', patientName: 'Paciente', treatmentCycleId: 'cycle-1', sessionPlanId: 'plan-2',
      title: 'Sesión Quest', instructions: '', mode: 'in_person', exercises: [defaultExerciseConfig],
      availableFrom: '2026-07-20T00:00:00.000Z', availableUntil: '', status: 'completed', createdAt: '2026-07-21T00:00:00.000Z',
      activeSeconds: 0, completedAt: '2026-07-20T14:00:00.000Z', initialDiscomfort: null, finalDiscomfort: null, perceivedDifficulty: null, patientComment: '',
      registeredRetrospectively: true, actualPerformedAt: '2026-07-20T14:00:00.000Z', retrospectiveRecordedAt: '2026-07-21T09:00:00.000Z', retrospectiveRecordedBy: 'professional-1', retrospectiveWithoutMetrics: true, retrospectiveDevice: 'quest',
      eventLog: [{ type: 'retrospective_session_recorded', at: '2026-07-20T14:00:00.000Z', omitted_exercises: [{ exerciseIndex: 0, exerciseName: defaultExerciseConfig.name, reason: 'No fue tolerado' }] }],
    } satisfies SessionAssignmentRecord
    expect(sessionReportSnapshotItem(session)).toMatchObject({ registeredRetrospectively: true, retrospectiveWithoutMetrics: true, retrospectiveDevice: 'quest' })
    expect(sessionReportSnapshotItem(session).eventLog?.[0].omitted_exercises?.[0].reason).toBe('No fue tolerado')
  })
})
