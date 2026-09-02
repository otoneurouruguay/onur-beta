import { describe, expect, it } from 'vitest'
import { validateClinicalEpisode } from './schema'
import { createEmptyClinicalEpisode } from './types'

describe('validación del episodio clínico', () => {
  it('permite guardar un borrador incompleto', () => {
    const values = createEmptyClinicalEpisode('cycle-1')
    expect(validateClinicalEpisode(values)).toEqual({})
  })

  it('exige seguridad, déficit y meta antes de confirmar', () => {
    const values = createEmptyClinicalEpisode('cycle-1')
    values.status = 'reviewed'
    const errors = validateClinicalEpisode(values)
    expect(errors.fallRisk).toBeTruthy()
    expect(errors.measuredImpairments).toBeTruthy()
    expect(errors.participationGoals).toBeTruthy()
    expect(errors.stopRules).toBeTruthy()
  })
})
