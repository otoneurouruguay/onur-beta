import { beforeEach, describe, expect, it } from 'vitest'
import { listExerciseTemplates } from '../templates/repository'
import { pathologyRecommendations, validatePathologyRecommendationCatalog } from './catalog'

describe('recomendaciones por patología', () => {
  beforeEach(() => localStorage.clear())

  it('incluye las patologías comunes solicitadas y solo cita fuentes existentes', () => {
    expect(pathologyRecommendations.map((item) => item.id)).toEqual(expect.arrayContaining(['motion_sickness', 'vestibular_migraine', 'visually_induced_dizziness', 'pppd', 'bppv']))
    expect(validatePathologyRecommendationCatalog()).toBe(true)
  })

  it('todas las recomendaciones ofrecen al menos una plantilla realmente cargada', async () => {
    const templates = await listExerciseTemplates()
    const templateIds = new Set(templates.map((template) => template.id))
    for (const pathology of pathologyRecommendations) {
      expect(pathology.options.length, pathology.label).toBeGreaterThan(0)
      for (const option of pathology.options) {
        expect(option.templateIds.length, `${pathology.label} · ${option.title}`).toBeGreaterThan(0)
        expect(option.templateIds.every((id) => templateIds.has(id)), `${pathology.label} · ${option.title}`).toBe(true)
      }
    }
  })
})
