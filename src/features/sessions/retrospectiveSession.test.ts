import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from '../exercise/types'
import { createRetrospectiveSessionValues, validateSession, type SessionFormValues } from './schema'

const base = (): SessionFormValues => ({
  kind: 'exercise', title: 'Sesión pasada', instructions: 'Indicaciones clínicas.', mode: 'in_person',
  treatmentCycleId: 'cycle-1', availableFrom: '2026-08-01', availableUntil: '', exercises: [{ ...defaultExerciseConfig }],
})

describe('sesión retrospectiva', () => {
  it('admite finalizar sin inventar métricas si existe observación', () => {
    const values = base()
    values.registerAsCompleted = true
    values.retrospective = createRetrospectiveSessionValues(values.exercises, values.availableFrom)
    values.retrospective.professionalObservation = 'Sesión realizada en clínica.'
    expect(validateSession(values).retrospective).toBeUndefined()
  })

  it('exige motivo para cada ejercicio omitido', () => {
    const values = base()
    values.registerAsCompleted = true
    values.retrospective = createRetrospectiveSessionValues(values.exercises, values.availableFrom)
    values.retrospective.professionalObservation = 'Sesión realizada en clínica.'
    values.retrospective.performedExerciseIndexes = []
    expect(validateSession(values).retrospective).toMatch(/omitió/i)
  })
})
