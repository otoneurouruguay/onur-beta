import { describe, expect, it } from 'vitest'
import { analyzeExerciseCompatibility, applyExercisePurpose } from '../exercise/compatibility'
import { defaultExerciseConfig, normalizeExerciseConfig, type BackgroundType, type ExerciseConfig, type LinearMotionDirection, type QuestImmersiveCoverage } from '../exercise/types'
import { validateSession } from '../sessions/schema'
import { buildQuestProceduralPhases, canUseQuestProceduralImmersion, isQuestProceduralImmersive, recommendedQuestGeometry } from './questProcedural'

function procedural(overrides: Partial<ExerciseConfig> = {}): ExerciseConfig {
  return {
    ...applyExercisePurpose(defaultExerciseConfig, 'visual_habituation'),
    displayMode: 'quest_browser', questPresentationMode: 'immersive_webxr',
    doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician',
    backgroundType: 'bars', backgroundDirection: 'left', backgroundSpeed: 20, objectEnabled: false,
    ...overrides,
  }
}

function session(exercises: ExerciseConfig[]) {
  return { title: 'Batería Quest', instructions: '', mode: 'in_person' as const, treatmentCycleId: 'cycle', availableFrom: '2026-09-01', availableUntil: '', exercises }
}

describe('modalidad procedural Quest WebXR', () => {
  it('mantiene las configuraciones antiguas en panel 2D y solo activa WebXR de forma explícita', () => {
    expect(normalizeExerciseConfig({ displayMode: 'quest_browser', purpose: 'optokinetic' }).questPresentationMode).toBe('panel_2d')
    expect(isQuestProceduralImmersive(procedural())).toBe(true)
  })

  it('elige una geometría coherente por patrón o finalidad', () => {
    expect(recommendedQuestGeometry(procedural({ backgroundType: 'bars' }))).toBe('cylinder')
    expect(recommendedQuestGeometry(procedural({ backgroundType: 'spiral' }))).toBe('front_disc')
    expect(recommendedQuestGeometry({ ...applyExercisePurpose(defaultExerciseConfig, 'saccades') })).toBe('curved_panel')
    expect(recommendedQuestGeometry({ ...applyExercisePurpose(defaultExerciseConfig, 'optic_flow'), backgroundType: 'radial_flow' })).toBe('particle_tunnel')
  })

  it('valida barras, damero y puntos en ocho direcciones, dos movimientos y tres coberturas', () => {
    const patterns: BackgroundType[] = ['bars', 'checkerboard', 'dots']
    const directions: LinearMotionDirection[] = ['left', 'right', 'up', 'down', 'up_left', 'up_right', 'down_left', 'down_right']
    const modes = ['continuous', 'oscillating'] as const
    const coverages: QuestImmersiveCoverage[] = [90, 180, 360]
    for (const backgroundType of patterns) for (const backgroundDirection of directions) for (const backgroundMotionMode of modes) for (const questImmersiveCoverage of coverages) {
      const exercise = procedural({ backgroundType, backgroundDirection, backgroundMotionMode, questImmersiveCoverage })
      expect(analyzeExerciseCompatibility(exercise).valid, `${backgroundType}/${backgroundDirection}/${backgroundMotionMode}/${questImmersiveCoverage}`).toBe(true)
      expect(validateSession(session([exercise]))).toEqual({})
    }
  })

  it('construye varias vueltas, descansos y ejercicios sin exigir una nueva sesión XR', () => {
    const phases = buildQuestProceduralPhases([
      procedural({ name: 'Barras', rounds: 2, restSeconds: 10 }),
      procedural({ name: 'Puntos', backgroundType: 'dots', rounds: 1, restSeconds: 0 }),
    ])
    expect(phases.map((phase) => phase.type)).toEqual(['exercise', 'rest', 'exercise', 'rest', 'exercise'])
    expect(phases.filter((phase) => phase.type === 'exercise')).toHaveLength(3)
  })

  it('rechaza mezclar WebXR procedural con panel 2D o escenario contextual', () => {
    const panel = { ...procedural({ name: 'Panel' }), questPresentationMode: 'panel_2d' as const }
    const contextual = applyExercisePurpose(defaultExerciseConfig, 'immersive_context')
    expect(validateSession(session([procedural(), panel])).exercises).toContain('únicamente ejercicios inmersivos procedurales')
    expect(validateSession(session([procedural(), contextual])).exercises).toContain('no se mezcla')
  })

  it('descarta modalidades sin logística coherente para este motor', () => {
    expect(canUseQuestProceduralImmersion({ ...defaultExerciseConfig, purpose: 'gaze_stabilization' })).toBe(false)
    expect(canUseQuestProceduralImmersion({ ...procedural(), strobeEnabled: true })).toBe(false)
    expect(canUseQuestProceduralImmersion({ ...procedural(), cognitiveTaskMode: 'go_no_go' })).toBe(false)
  })
})
