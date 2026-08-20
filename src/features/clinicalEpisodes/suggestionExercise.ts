import { defaultExerciseConfig, type ExerciseConfig } from '../exercise/types'
import type { ExerciseTemplateRecord } from '../templates/repository'
import type { ClinicalEpisodeRecord, ClinicalExerciseSuggestion } from './types'

export function exerciseFromClinicalSuggestion(suggestion: ClinicalExerciseSuggestion, episode: ClinicalEpisodeRecord, templates: ExerciseTemplateRecord[]): ExerciseConfig | null {
  const template = suggestion.templateId ? templates.find((item) => item.id === suggestion.templateId) : undefined
  if (suggestion.kind === 'platform' && !template) return null
  const walking = /marcha/i.test(suggestion.title)
  const base = template?.config ?? {
    ...defaultExerciseConfig,
    name: suggestion.title,
    kind: 'guided_physical' as const,
    purpose: 'guided_functional' as const,
    patientInstruction: suggestion.execution,
    displayMode: 'standard' as const,
    cardboardEnabled: false,
    doseMode: 'repetitions' as const,
    targetRepetitions: 5,
    advanceMode: 'manual' as const,
    posture: walking ? 'walking' as const : 'seated' as const,
    surface: 'firm' as const,
    supervision: walking ? 'trained_helper' as const : suggestion.id === 'bppv-reposition' ? 'direct_clinician' as const : 'independent_after_approval' as const,
    backgroundType: 'solid' as const,
    backgroundSpeed: 0,
    objectEnabled: false,
    durationSeconds: 30,
    rounds: 1,
    restSeconds: 20,
  }
  return {
    ...base,
    selectionOrigin: 'suggested',
    clinicalEpisodeId: episode.id,
    clinicalSuggestionId: suggestion.id,
    clinicalRationale: suggestion.rationale,
    targetImpairment: suggestion.targetImpairment,
    clinicalDoseNote: suggestion.dose,
    clinicalProgressionNote: suggestion.progression,
    clinicalRegressionNote: suggestion.regression,
    stopCriteria: suggestion.pauseCriteria,
  }
}
