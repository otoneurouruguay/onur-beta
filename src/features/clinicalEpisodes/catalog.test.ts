import { describe, expect, it } from 'vitest'
import { buildEpisodeClinicalSummary, pathologyModules } from './catalog'
import { createEmptyClinicalEpisode } from './types'
import { exerciseFromClinicalSuggestion } from './suggestionExercise'
import { defaultExerciseConfig } from '../exercise/types'

describe('gobernanza del episodio clínico', () => {
  it('incluye los módulos específicos solicitados', () => {
    expect(pathologyModules.map((module) => module.id)).toEqual(expect.arrayContaining([
      'unilateral_hypofunction', 'bilateral_hypofunction', 'bppv', 'pppd',
      'vestibular_migraine', 'meniere', 'presbyvestibulopathy', 'mild_tbi', 'vestibular_schwannoma',
    ]))
  })

  it('no sugiere rehabilitación durante una crisis activa de Ménière', () => {
    const episode = createEmptyClinicalEpisode('cycle-1')
    episode.diagnosisCode = 'meniere'
    episode.pathologyFindings.activeAttack = 'yes'
    const summary = buildEpisodeClinicalSummary(episode)
    expect(summary.suggestions).toHaveLength(0)
    expect(summary.warnings.join(' ')).toMatch(/crisis activa/i)
  })

  it('no habilita una batería PPPD si no se documentan tres meses', () => {
    const episode = createEmptyClinicalEpisode('cycle-1')
    episode.diagnosisCode = 'pppd'
    episode.pathologyFindings.mostDaysThreeMonths = 'no'
    expect(buildEpisodeClinicalSummary(episode).suggestions).toHaveLength(0)
  })

  it('retira tareas de marcha ante riesgo alto de caída', () => {
    const episode = createEmptyClinicalEpisode('cycle-1')
    episode.anamnesis.fallRisk = 'high'
    episode.phase = 'chronic'
    episode.pathologyFindings.centralSignsExcluded = 'yes'
    expect(buildEpisodeClinicalSummary(episode).suggestions.some((suggestion) => /marcha/i.test(suggestion.title))).toBe(false)
  })

  it('convierte una sugerencia en un ejercicio trazable y editable', () => {
    const values = createEmptyClinicalEpisode('cycle-1')
    values.phase = 'chronic'
    values.pathologyFindings.centralSignsExcluded = 'yes'
    const episode = { ...values, id: 'episode-1', patientId: 'patient-1', createdAt: '', updatedAt: '', reviewedAt: '', reviewedBy: '' }
    const suggestion = buildEpisodeClinicalSummary(episode).suggestions[0]
    const exercise = exerciseFromClinicalSuggestion(suggestion, episode, [{ id: suggestion.templateId!, name: suggestion.title, config: defaultExerciseConfig, createdAt: '', updatedAt: '' }])
    expect(exercise).toMatchObject({ selectionOrigin: 'suggested', clinicalEpisodeId: 'episode-1', clinicalSuggestionId: suggestion.id })
    expect(exercise?.clinicalRationale).toBeTruthy()
  })
})
