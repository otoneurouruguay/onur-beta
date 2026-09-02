import { beforeEach, describe, expect, it } from 'vitest'
import { dhiArgentina, emptyAssessmentResponses, scoreAssessment } from './questions'
import { assessmentComparison, cancelAssessment, completeAssessment, createAssessmentAssignment, listPatientAssessments } from './repository'

function responses(value: 0 | 2 | 4) {
  return Object.fromEntries(dhiArgentina.questions.map((question) => [question.id, value]))
}

const base = {
  patientId: 'ana-p', treatmentCycleId: 'cycle-ana-2', instrumentCode: 'DHI_AR_25' as const,
  instrumentVersion: 1, deliveryMode: 'in_person' as const, dueDate: '',
}

describe('flujo DHI versionado', () => {
  beforeEach(() => localStorage.clear())

  it('calcula total y subescalas con la clave estable de cada pregunta', () => {
    const result = scoreAssessment(responses(4))
    expect(result).toMatchObject({ answeredCount: 25, complete: true, total: 100 })
    expect(result.subscales).toEqual({ physical: 28, emotional: 36, functional: 36 })
  })

  it('crea una asignación domiciliaria vacía sin inventar resultado', async () => {
    const record = await createAssessmentAssignment({ ...base, phase: 'initial', deliveryMode: 'portal', dueDate: '2026-08-30' })
    expect(record).toMatchObject({ status: 'assigned', answeredCount: 0, totalScore: null, dueDate: '2026-08-30' })
    expect(record.responses).toEqual(emptyAssessmentResponses())
  })

  it('compara únicamente el DHI inicial y final completos del mismo ciclo', async () => {
    const initial = await createAssessmentAssignment({ ...base, phase: 'initial' })
    await completeAssessment(initial.id, responses(4))
    const final = await createAssessmentAssignment({ ...base, phase: 'final' })
    await completeAssessment(final.id, responses(2))
    const comparison = assessmentComparison(await listPatientAssessments('ana-p'), 'cycle-ana-2')
    expect(comparison).toMatchObject({ initialTotal: 100, finalTotal: 50, difference: -50, maximumScore: 100 })
    expect(comparison?.subscaleDifferences).toEqual({ physical: -14, emotional: -18, functional: -18 })
  })

  it('no permite finalizar con respuestas faltantes', async () => {
    const record = await createAssessmentAssignment({ ...base, phase: 'final' })
    await expect(completeAssessment(record.id, { ...responses(2), F9: null })).rejects.toThrow('25 respuestas')
    expect(assessmentComparison(await listPatientAssessments('ana-p'), 'cycle-ana-2')).toBeNull()
  })

  it('permite cancelar una asignación abierta y volver a asignarla sin borrar resultados finalizados', async () => {
    const pending = await createAssessmentAssignment({ ...base, phase: 'initial', deliveryMode: 'portal' })
    expect((await cancelAssessment(pending.id)).status).toBe('cancelled')
    const replacement = await createAssessmentAssignment({ ...base, phase: 'initial', deliveryMode: 'portal' })
    expect(replacement.status).toBe('assigned')
    await completeAssessment(replacement.id, responses(0))
    await expect(cancelAssessment(replacement.id)).rejects.toThrow('ya no se puede cancelar')
  })
})
