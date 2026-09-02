import type { ExerciseConfig, ExercisePurpose, QuestImmersiveGeometry } from '../exercise/types'

export type QuestProceduralExercisePhase = { type: 'exercise'; config: ExerciseConfig; exerciseIndex: number; round: number }
export type QuestProceduralRestPhase = { type: 'rest'; seconds: number; nextName: string }
export type QuestProceduralPhase = QuestProceduralExercisePhase | QuestProceduralRestPhase

export function buildQuestProceduralPhases(exercises: ExerciseConfig[]): QuestProceduralPhase[] {
  const exercisePhases: QuestProceduralExercisePhase[] = []
  exercises.forEach((config, exerciseIndex) => {
    for (let round = 1; round <= config.rounds; round += 1) exercisePhases.push({ type: 'exercise', config, exerciseIndex, round })
  })
  const phases: QuestProceduralPhase[] = []
  exercisePhases.forEach((phase, index) => {
    phases.push(phase)
    const next = exercisePhases[index + 1]
    if (next && phase.config.restSeconds > 0) phases.push({ type: 'rest', seconds: phase.config.restSeconds, nextName: next.config.name })
  })
  return phases
}

export const questProceduralPurposeLabels: Partial<Record<ExercisePurpose, string>> = {
  optokinetic: 'Estimulación optocinética',
  visual_habituation: 'Habituación visual',
  visual_motion_fixation: 'Fijación con fondo móvil',
  pursuit_visual_conflict: 'Seguimiento con conflicto visual',
  smooth_pursuit: 'Seguimiento ocular suave',
  saccades: 'Sacadas',
  optic_flow: 'Flujo óptico',
  custom_free: 'Configuración Libre',
}

export function isQuestProceduralPurpose(purpose: ExercisePurpose) {
  return Object.prototype.hasOwnProperty.call(questProceduralPurposeLabels, purpose)
}

export function recommendedQuestGeometry(config: Pick<ExerciseConfig, 'purpose' | 'backgroundType'>): QuestImmersiveGeometry {
  if (config.purpose === 'optic_flow' || config.backgroundType === 'radial_flow') return 'particle_tunnel'
  if (config.backgroundType === 'spiral') return 'front_disc'
  if (config.purpose === 'smooth_pursuit' || config.purpose === 'saccades' || config.backgroundType === 'solid') return 'curved_panel'
  return 'sphere'
}

export function isQuestProceduralImmersive(config: ExerciseConfig) {
  return config.displayMode === 'quest_browser'
    && config.questPresentationMode === 'immersive_webxr'
    && isQuestProceduralPurpose(config.purpose)
}

export function isAnyQuestImmersive(config: ExerciseConfig) {
  return config.displayMode === 'quest_browser'
    && (config.purpose === 'immersive_context' || isQuestProceduralImmersive(config))
}

export function canUseQuestProceduralImmersion(config: ExerciseConfig) {
  if (!isQuestProceduralPurpose(config.purpose)) return false
  if (config.kind !== 'visual_stimulus' || config.strobeEnabled || config.cognitiveTaskMode !== 'none') return false
  if (config.purpose === 'custom_free') {
    return config.backgroundType !== 'solid' || config.objectEnabled
  }
  return true
}
