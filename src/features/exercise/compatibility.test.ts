import { describe, expect, it } from 'vitest'
import { analyzeExerciseCompatibility, applyExercisePurpose, isVrBoxPurposeSupported } from './compatibility'
import { defaultExerciseConfig, type CognitiveTaskMode, type ExerciseAdvanceMode, type ExerciseConfig, type ExerciseDoseMode, type ExercisePosture, type ExercisePurpose, type ExerciseSurface, type MotionDirection } from './types'

function exercise(purpose: ExercisePurpose, overrides: Partial<ExerciseConfig> = {}) {
  return { ...applyExercisePurpose(defaultExerciseConfig, purpose), ...overrides }
}

describe('coherencia clínica y espacial de ejercicios', () => {
  it.each([
    ['gaze_stabilization', 'standard', true],
    ['gaze_stabilization', 'vr_box', false],
    ['gaze_stabilization', 'quest_browser', false],
    ['gaze_stabilization_x2', 'standard', true],
    ['gaze_stabilization_x2', 'vr_box', false],
    ['gaze_stabilization_x2', 'quest_browser', false],
    ['gaze_substitution_remembered', 'standard', true],
    ['gaze_substitution_remembered', 'vr_box', false],
    ['gaze_substitution_remembered', 'quest_browser', false],
    ['smooth_pursuit', 'standard', true],
    ['smooth_pursuit', 'vr_box', true],
    ['smooth_pursuit', 'quest_browser', true],
    ['saccades', 'standard', true],
    ['saccades', 'vr_box', true],
    ['saccades', 'quest_browser', true],
    ['optokinetic', 'standard', true],
    ['optokinetic', 'vr_box', true],
    ['optokinetic', 'quest_browser', true],
    ['visual_habituation', 'standard', true],
    ['visual_habituation', 'vr_box', true],
    ['visual_habituation', 'quest_browser', true],
    ['cognitive_visual', 'standard', true],
    ['cognitive_visual', 'vr_box', false],
    ['cognitive_visual', 'quest_browser', false],
    ['guided_functional', 'standard', true],
    ['guided_functional', 'vr_box', false],
    ['guided_functional', 'quest_browser', false],
    ['custom_free', 'standard', true],
    ['custom_free', 'vr_box', true],
    ['custom_free', 'quest_browser', true],
  ] as const)('%s en %s: válido=%s', (purpose, displayMode, valid) => {
    const configured = exercise(purpose, {
      displayMode,
      doseMode: displayMode === 'vr_box' ? 'time' : exercise(purpose).doseMode,
      advanceMode: displayMode === 'vr_box' ? 'automatic' : exercise(purpose).advanceMode,
    })
    expect(analyzeExerciseCompatibility(configured).valid).toBe(valid)
  })

  it.each(['vr_box', 'quest_browser'] as const)('bloquea RVO x1 en %s sin anclaje espacial', (displayMode) => {
    const analysis = analyzeExerciseCompatibility(exercise('gaze_stabilization', { displayMode, doseMode: 'time', advanceMode: 'automatic' }))
    expect(analysis.valid).toBe(false)
    expect(analysis.issues.some((item) => item.code === 'gaze-headset')).toBe(true)
  })

  it.each(['vr_box', 'quest_browser'] as const)('bloquea RVO x2 y objetivo recordado en %s sin referencia estable', (displayMode) => {
    const x2 = analyzeExerciseCompatibility(exercise('gaze_stabilization_x2', { displayMode, doseMode: 'time', advanceMode: 'automatic' }))
    const remembered = analyzeExerciseCompatibility(exercise('gaze_substitution_remembered', { displayMode, doseMode: 'time', advanceMode: 'automatic' }))
    expect(x2.issues.some((item) => item.code === 'gaze-x2-headset')).toBe(true)
    expect(remembered.issues.some((item) => item.code === 'remembered-headset')).toBe(true)
  })

  it.each(['vr_box', 'quest_browser'] as const)('admite optocinético coherente en %s', (displayMode) => {
    const analysis = analyzeExerciseCompatibility(exercise('optokinetic', { displayMode, doseMode: 'time', advanceMode: 'automatic' }))
    expect(analysis.valid).toBe(true)
    expect(analysis.explanation).toContain('cabeza quieta')
  })

  it('habilita Cardboard para el grupo visual seguro y RVO x1 presencial con anclaje 3DoF', () => {
    for (const purpose of ['smooth_pursuit', 'saccades', 'optokinetic', 'visual_habituation', 'custom_free'] as const) {
      const analysis = analyzeExerciseCompatibility(exercise(purpose, { displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic' }))
      expect(analysis.valid, purpose).toBe(true)
    }
    const gaze = analyzeExerciseCompatibility(exercise('gaze_stabilization', { displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic', supervision: 'direct_clinician' }))
    expect(gaze.valid).toBe(true)
    expect(gaze.explanation).toContain('anclaje angular 3DoF')
    for (const purpose of ['gaze_stabilization_x2', 'gaze_substitution_remembered', 'cognitive_visual', 'guided_functional'] as const) {
      const analysis = analyzeExerciseCompatibility(exercise(purpose, { displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic' }))
      expect(analysis.valid, purpose).toBe(false)
    }
  })

  it('mantiene RVO x1 bloqueado en VR Box común y sin supervisión directa', () => {
    expect(analyzeExerciseCompatibility(exercise('gaze_stabilization', { displayMode: 'vr_box', doseMode: 'time', advanceMode: 'automatic' })).issues.some((item) => item.code === 'gaze-headset')).toBe(true)
    expect(analyzeExerciseCompatibility(exercise('gaze_stabilization', { displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic' })).issues.some((item) => item.code === 'cardboard-gaze-supervision')).toBe(true)
  })

  it('no permite conservar Cardboard fuera de VR Box', () => {
    const analysis = analyzeExerciseCompatibility(exercise('smooth_pursuit', { displayMode: 'standard', cardboardEnabled: true }))
    expect(analysis.issues.some((item) => item.code === 'cardboard-display-mode')).toBe(true)
  })

  it.each(['vr_box', 'quest_browser'] as const)('bloquea tareas físicas en %s', (displayMode) => {
    const analysis = analyzeExerciseCompatibility(exercise('guided_functional', { displayMode, doseMode: 'time', advanceMode: 'automatic' }))
    expect(analysis.valid).toBe(false)
    expect(analysis.issues.some((item) => item.code === 'functional-headset')).toBe(true)
  })

  it('bloquea un optocinético estático aunque el nombre diga lo contrario', () => {
    const analysis = analyzeExerciseCompatibility(exercise('optokinetic', { backgroundSpeed: 0 }))
    expect(analysis.valid).toBe(false)
    expect(analysis.issues.some((item) => item.code === 'visual-motion')).toBe(true)
  })

  it('limita la intermitencia visual a una exposición presencial conservadora', () => {
    const strobe = exercise('visual_habituation', {
      strobeEnabled: true, displayMode: 'standard', posture: 'seated', surface: 'firm', supervision: 'direct_clinician',
      doseMode: 'time', advanceMode: 'manual', durationSeconds: 20, rounds: 1,
    })
    expect(analyzeExerciseCompatibility(strobe).valid).toBe(true)
    expect(analyzeExerciseCompatibility({ ...strobe, strobeFrequencyHz: 4 }).issues.some((item) => item.code === 'strobe-frequency')).toBe(true)
    expect(analyzeExerciseCompatibility({ ...strobe, displayMode: 'vr_box', advanceMode: 'automatic' }).issues.some((item) => item.code === 'strobe-headset')).toBe(true)
    expect(analyzeExerciseCompatibility({ ...strobe, supervision: 'independent_after_approval' }).issues.some((item) => item.code === 'strobe-supervision')).toBe(true)
  })

  it('admite seguimiento ocular muy lento y metrónomo de ritmo y tono configurables', () => {
    expect(analyzeExerciseCompatibility(exercise('smooth_pursuit', { objectSpeedHz: 0.1 })).valid).toBe(true)
    expect(analyzeExerciseCompatibility(exercise('smooth_pursuit', { objectSpeedHz: 0.01 })).issues.some((item) => item.code === 'tracking-speed')).toBe(true)
    expect(analyzeExerciseCompatibility(exercise('gaze_stabilization', { metronomeEnabled: true, metronomeHz: 0.1, metronomeToneHz: 220 })).valid).toBe(true)
    expect(analyzeExerciseCompatibility(exercise('gaze_stabilization', { metronomeEnabled: true, metronomeHz: 5 })).issues.some((item) => item.code === 'metronome-rate')).toBe(true)
  })

  it('configura cada propósito con parámetros coherentes', () => {
    expect(applyExercisePurpose(defaultExerciseConfig, 'gaze_stabilization_x2')).toMatchObject({ kind: 'visual_stimulus', displayMode: 'standard', objectEnabled: true, objectMode: 'tracking', backgroundSpeed: 0 })
    expect(applyExercisePurpose(defaultExerciseConfig, 'gaze_substitution_remembered')).toMatchObject({ kind: 'visual_stimulus', displayMode: 'standard', doseMode: 'repetitions', advanceMode: 'manual', objectMode: 'fixed' })
    expect(applyExercisePurpose(defaultExerciseConfig, 'smooth_pursuit')).toMatchObject({ kind: 'visual_stimulus', objectEnabled: true, objectMode: 'tracking', backgroundSpeed: 0 })
    expect(applyExercisePurpose(defaultExerciseConfig, 'saccades')).toMatchObject({ kind: 'visual_stimulus', objectEnabled: true, objectMode: 'saccades', backgroundSpeed: 0 })
    expect(applyExercisePurpose(defaultExerciseConfig, 'optokinetic')).toMatchObject({ kind: 'visual_stimulus', objectEnabled: false, backgroundType: 'bars' })
    expect(applyExercisePurpose(defaultExerciseConfig, 'immersive_context')).toMatchObject({ kind: 'visual_stimulus', displayMode: 'quest_browser', immersiveScenarioId: 'street_quiet', doseMode: 'time', advanceMode: 'automatic', supervision: 'direct_clinician', rounds: 1 })
    expect(applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual')).toMatchObject({ kind: 'visual_stimulus', displayMode: 'standard', doseMode: 'time', advanceMode: 'manual', cognitiveTaskMode: 'rare_target' })
    expect(applyExercisePurpose(defaultExerciseConfig, 'guided_functional')).toMatchObject({ kind: 'guided_physical', displayMode: 'standard', doseMode: 'repetitions', advanceMode: 'manual' })
  })

  it('actualiza el nombre al cambiar de finalidad para no rotular mal la plantilla', () => {
    expect(applyExercisePurpose(defaultExerciseConfig, 'optokinetic').name).toBe('Estimulación optocinética')
    expect(applyExercisePurpose(defaultExerciseConfig, 'saccades').name).toBe('Sacadas visuales')
    expect(applyExercisePurpose(defaultExerciseConfig, 'custom_free').name).toBe('Libre · configuración profesional')
  })

  it('modo Libre no aplica las reglas clínicas de RVO, pero mantiene límites técnicos de VR Box', () => {
    const arbitrary = exercise('custom_free', { objectMode: 'saccades', backgroundType: 'spiral', backgroundSpeed: 80 })
    expect(analyzeExerciseCompatibility(arbitrary)).toMatchObject({ valid: true })
    const impossibleInVr = analyzeExerciseCompatibility({ ...arbitrary, displayMode: 'vr_box', doseMode: 'repetitions', advanceMode: 'manual' })
    expect(impossibleInVr.valid).toBe(false)
    expect(impossibleInVr.issues.map((item) => item.code)).toEqual(expect.arrayContaining(['vr-dose', 'vr-advance']))
  })

  it('bloquea tareas cognitivas dentro de visores y la respuesta táctil durante RVO', () => {
    const cognitive = exercise('cognitive_visual')
    expect(analyzeExerciseCompatibility({ ...cognitive, displayMode: 'vr_box', advanceMode: 'automatic' }).issues.some((item) => item.code === 'cognitive-headset')).toBe(true)
    const dualTask = exercise('gaze_stabilization', { cognitiveTaskMode: 'go_no_go', cognitiveResponseMode: 'screen_tap', doseMode: 'time', advanceMode: 'manual' })
    expect(analyzeExerciseCompatibility(dualTask).issues.some((item) => item.code === 'cognitive-touch-head')).toBe(true)
  })

  it('admite una doble tarea verbal en pantalla 2D pero conserva la nota de revisión', () => {
    const dualTask = exercise('gaze_stabilization', { cognitiveTaskMode: 'go_no_go', cognitiveResponseMode: 'verbal', doseMode: 'time', advanceMode: 'manual' })
    const analysis = analyzeExerciseCompatibility(dualTask)
    expect(analysis.valid).toBe(true)
    expect(analysis.clinicalNote).toContain('no una prueba diagnóstica')
  })

  it('ejecuta 360° solo en Quest WebXR o Cardboard 3DoF y respeta el máximo del medio', () => {
    const quest = exercise('immersive_context')
    expect(analyzeExerciseCompatibility(quest).valid).toBe(true)
    expect(analyzeExerciseCompatibility({ ...quest, displayMode: 'vr_box', cardboardEnabled: true }).valid).toBe(true)
    expect(analyzeExerciseCompatibility({ ...quest, displayMode: 'vr_box', cardboardEnabled: false }).issues.some((item) => item.code === 'immersive-cardboard')).toBe(true)
    expect(analyzeExerciseCompatibility({ ...quest, displayMode: 'standard' }).issues.some((item) => item.code === 'immersive-headset')).toBe(true)
    expect(analyzeExerciseCompatibility({ ...quest, durationSeconds: 61 }).issues.some((item) => item.code === 'immersive-duration')).toBe(true)
    expect(analyzeExerciseCompatibility({ ...quest, rounds: 2 }).issues.some((item) => item.code === 'immersive-rounds')).toBe(true)
  })

  it('permite referencia espacial solo en escenas fijas y sonido ambiente trazable solo en Quest', () => {
    const cafe = exercise('immersive_context', { immersiveScenarioId: 'cafe_comfy', objectEnabled: true, objectMode: 'fixed', immersiveAudioEnabled: true, immersiveAudioVolume: 20 })
    expect(analyzeExerciseCompatibility(cafe).valid).toBe(true)
    expect(analyzeExerciseCompatibility({ ...cafe, displayMode: 'vr_box', cardboardEnabled: true }).issues.some((item) => item.code === 'immersive-audio-device')).toBe(true)
    expect(analyzeExerciseCompatibility({ ...cafe, immersiveAudioVolume: 80 }).issues.some((item) => item.code === 'immersive-audio-volume')).toBe(true)
    const moving = exercise('immersive_context', { immersiveScenarioId: 'urban_ride_nyc', objectEnabled: true, objectMode: 'fixed' })
    expect(analyzeExerciseCompatibility(moving).issues.some((item) => item.code === 'immersive-target-scene')).toBe(true)
  })

  it('verifica exhaustivamente las combinaciones operativas de VR Box', () => {
    const purposes = Object.keys({
      gaze_stabilization: 1, gaze_stabilization_x2: 1, gaze_substitution_remembered: 1,
      smooth_pursuit: 1, saccades: 1, optokinetic: 1, visual_habituation: 1,
      immersive_context: 1, cognitive_visual: 1, guided_functional: 1, custom_free: 1,
    }) as ExercisePurpose[]
    const doses: ExerciseDoseMode[] = ['time', 'repetitions']
    const advances: ExerciseAdvanceMode[] = ['automatic', 'manual']
    const postures: ExercisePosture[] = ['seated', 'standing', 'walking']
    const surfaces: ExerciseSurface[] = ['firm', 'unstable']
    const cognition: CognitiveTaskMode[] = ['none', 'rare_target']
    const metronomes = [false, true]
    const cardboardProfiles = [false, true]
    let checked = 0

    for (const purpose of purposes) for (const doseMode of doses) for (const advanceMode of advances) {
      for (const posture of postures) for (const surface of surfaces) for (const cognitiveTaskMode of cognition) for (const metronomeEnabled of metronomes) for (const cardboardEnabled of cardboardProfiles) {
        const configured = exercise(purpose, { displayMode: 'vr_box', cardboardEnabled, doseMode, advanceMode, posture, surface, cognitiveTaskMode, metronomeEnabled, supervision: (purpose === 'gaze_stabilization' && cardboardEnabled) || purpose === 'immersive_context' ? 'direct_clinician' : 'independent_after_approval' })
        const expected = isVrBoxPurposeSupported(purpose)
          && (purpose !== 'gaze_stabilization' || cardboardEnabled)
          && (purpose !== 'immersive_context' || cardboardEnabled)
          && doseMode === 'time' && advanceMode === 'automatic'
          && posture === 'seated' && surface === 'firm'
          && cognitiveTaskMode === 'none' && !metronomeEnabled
        expect(analyzeExerciseCompatibility(configured).valid, JSON.stringify({ purpose, cardboardEnabled, doseMode, advanceMode, posture, surface, cognitiveTaskMode, metronomeEnabled })).toBe(expected)
        checked += 1
      }
    }
    expect(checked).toBe(2112)
  })

  it('verifica todas las direcciones de los fondos móviles compatibles con VR Box', () => {
    const linear: MotionDirection[] = ['left', 'right', 'up', 'down', 'up_left', 'up_right', 'down_left', 'down_right']
    const rotational: MotionDirection[] = ['clockwise', 'counterclockwise']
    const directions = [...linear, ...rotational]
    const patterns = ['bars', 'checkerboard', 'dots', 'spiral'] as const
    let checked = 0

    for (const purpose of ['optokinetic', 'visual_habituation'] as const) for (const backgroundType of patterns) for (const backgroundDirection of directions) {
      const analysis = analyzeExerciseCompatibility(exercise(purpose, {
        displayMode: 'vr_box', doseMode: 'time', advanceMode: 'automatic', backgroundType, backgroundDirection,
      }))
      expect(analysis.valid, JSON.stringify({ purpose, backgroundType, backgroundDirection })).toBe(backgroundType === 'spiral' ? rotational.includes(backgroundDirection) : linear.includes(backgroundDirection))
      checked += 1
    }
    expect(checked).toBe(80)
  })
})
