import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig, type ExerciseConfig } from '../exercise/types'
import type { ExerciseTemplateRecord } from './repository'
import { defaultExerciseTemplateFilters, filterExerciseTemplates, hasActiveExerciseTemplateFilters } from './filtering'

function template(id: string, name: string, overrides: Partial<ExerciseConfig>): ExerciseTemplateRecord {
  return {
    id,
    name,
    config: { ...defaultExerciseConfig, name, ...overrides },
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  }
}

const templates = [
  template('template-rvo', 'Estabilización rápida', { purpose: 'gaze_stabilization', displayMode: 'standard', doseMode: 'time' }),
  template('template-pppd', 'PPPD · habituación', { purpose: 'visual_habituation', clinicalProtocol: 'pppd', backgroundType: 'bars', backgroundSpeed: 25 }),
  template('template-cardboard', 'Seguimiento Cardboard', { purpose: 'smooth_pursuit', displayMode: 'vr_box', cardboardEnabled: true, objectMode: 'tracking' }),
  template('template-functional', 'Marcha guiada', { kind: 'guided_physical', purpose: 'guided_functional', doseMode: 'repetitions', objectEnabled: false }),
  template('template-oscillating', 'Fondo oscilante', { purpose: 'visual_habituation', backgroundType: 'bars', backgroundSpeed: 0, backgroundMotionMode: 'oscillating', backgroundFrequencyHz: 0.2, backgroundAmplitudePercent: 20 }),
  template('personal-1', 'Plantilla del consultorio', { purpose: 'custom_free' }),
]

describe('exercise template filtering', () => {
  it('busca sin distinguir mayúsculas ni tildes', () => {
    const result = filterExerciseTemplates(templates, { ...defaultExerciseTemplateFilters, query: 'estabilizacion' })
    expect(result.map((item) => item.id)).toEqual(['template-rvo'])
  })

  it('combina filtros con lógica AND', () => {
    const result = filterExerciseTemplates(templates, {
      ...defaultExerciseTemplateFilters,
      device: 'cardboard',
      purpose: 'smooth_pursuit',
      stimulus: 'moving_target',
    })
    expect(result.map((item) => item.id)).toEqual(['template-cardboard'])
  })

  it('diferencia protocolo, tarea física y plantillas personales', () => {
    expect(filterExerciseTemplates(templates, { ...defaultExerciseTemplateFilters, protocol: 'pppd' }).map((item) => item.id)).toEqual(['template-pppd'])
    expect(filterExerciseTemplates(templates, { ...defaultExerciseTemplateFilters, stimulus: 'physical', dose: 'repetitions' }).map((item) => item.id)).toEqual(['template-functional'])
    expect(filterExerciseTemplates(templates, { ...defaultExerciseTemplateFilters, protocol: 'personal' }).map((item) => item.id)).toEqual(['personal-1'])
  })

  it('reconoce como móvil un fondo oscilante aunque su velocidad continua sea cero', () => {
    const result = filterExerciseTemplates(templates, { ...defaultExerciseTemplateFilters, stimulus: 'moving_background' })
    expect(result.map((item) => item.id)).toEqual(expect.arrayContaining(['template-pppd', 'template-oscillating']))
  })

  it('detecta y restablece filtros activos', () => {
    expect(hasActiveExerciseTemplateFilters(defaultExerciseTemplateFilters)).toBe(false)
    expect(hasActiveExerciseTemplateFilters({ ...defaultExerciseTemplateFilters, query: 'RVO' })).toBe(true)
  })
})
