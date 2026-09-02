import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from '../exercise/types'
import { groupExerciseTemplates } from './grouping'
import type { ExerciseTemplateRecord } from './repository'

const record = (id: string, name: string, overrides: Partial<ExerciseTemplateRecord['config']> = {}): ExerciseTemplateRecord => ({
  id, name, config: { ...defaultExerciseConfig, ...overrides }, createdAt: '', updatedAt: '',
})

describe('agrupación de plantillas', () => {
  it('separa las familias PPPD, estroboscópicas, imágenes rápidas, generales y personales', () => {
    const groups = groupExerciseTemplates([
      record('template-h1', 'H1', { clinicalProtocol: 'pppd', purpose: 'visual_habituation' }),
      record('template-o1', 'O1', { clinicalProtocol: 'pppd', purpose: 'optokinetic' }),
      record('template-f1', 'F1', { clinicalProtocol: 'pppd', purpose: 'guided_functional' }),
      record('template-strobe', 'Estrobo', { clinicalProtocol: 'stroboscopic_experimental', purpose: 'visual_habituation' }),
      record('template-rapid-images-soft', 'Imágenes rápidas', { purpose: 'cognitive_visual' }),
      record('template-base', 'Base'),
      record('custom', 'Mía'),
    ])
    expect(groups.map((group) => group.label)).toEqual(['PPPD · Habituación visual', 'PPPD · Optocinético', 'PPPD · Funcional', 'Estroboscópicos · experimental', 'Imágenes rápidas · cognitivo-visual', 'Mis plantillas', 'Plantillas generales'])
  })
})
