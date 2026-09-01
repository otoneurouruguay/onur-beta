import { exercisePurposeLabels } from '../exercise/compatibility'
import { isBackgroundMotionActive, type ExercisePurpose } from '../exercise/types'
import type { ExerciseTemplateRecord } from './repository'

export type TemplateDeviceFilter = 'all' | 'standard' | 'vr_box' | 'cardboard' | 'quest_browser'
export type TemplateModalityFilter = 'all' | 'visual_stimulus' | 'guided_physical'
export type TemplateProtocolFilter = 'all' | 'pppd' | 'stroboscopic_experimental' | 'general' | 'personal'
export type TemplateDoseFilter = 'all' | 'time' | 'repetitions'
export type TemplateStimulusFilter = 'all' | 'fixed_target' | 'moving_target' | 'moving_background' | 'cognitive' | 'immersive' | 'physical'

export interface ExerciseTemplateFilters {
  query: string
  purpose: 'all' | ExercisePurpose
  device: TemplateDeviceFilter
  modality: TemplateModalityFilter
  protocol: TemplateProtocolFilter
  dose: TemplateDoseFilter
  stimulus: TemplateStimulusFilter
}

export const defaultExerciseTemplateFilters: ExerciseTemplateFilters = {
  query: '',
  purpose: 'all',
  device: 'all',
  modality: 'all',
  protocol: 'all',
  dose: 'all',
  stimulus: 'all',
}

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

function matchesDevice(template: ExerciseTemplateRecord, filter: TemplateDeviceFilter) {
  if (filter === 'all') return true
  if (filter === 'cardboard') return template.config.displayMode === 'vr_box' && template.config.cardboardEnabled
  if (filter === 'vr_box') return template.config.displayMode === 'vr_box' && !template.config.cardboardEnabled
  return template.config.displayMode === filter
}

function matchesProtocol(template: ExerciseTemplateRecord, filter: TemplateProtocolFilter) {
  if (filter === 'all') return true
  if (filter === 'personal') return !template.id.startsWith('template-')
  if (filter === 'general') return template.id.startsWith('template-') && !template.config.clinicalProtocol
  return template.config.clinicalProtocol === filter
}

function matchesStimulus(template: ExerciseTemplateRecord, filter: TemplateStimulusFilter) {
  const { config } = template
  if (filter === 'all') return true
  if (filter === 'physical') return config.kind === 'guided_physical' || config.purpose === 'guided_functional'
  if (filter === 'immersive') return config.purpose === 'immersive_context'
  if (filter === 'cognitive') return config.purpose === 'cognitive_visual' || config.cognitiveTaskMode !== 'none'
  if (filter === 'moving_background') return isBackgroundMotionActive(config)
  if (filter === 'moving_target') return config.objectEnabled && config.objectMode !== 'fixed'
  return config.objectEnabled && config.objectMode === 'fixed'
}

export function filterExerciseTemplates(
  templates: ExerciseTemplateRecord[],
  filters: ExerciseTemplateFilters,
) {
  const query = normalizeSearchText(filters.query.trim())

  return templates.filter((template) => {
    const searchableText = normalizeSearchText([
      template.name,
      template.config.name,
      template.config.patientInstruction,
      exercisePurposeLabels[template.config.purpose],
      template.config.clinicalProtocol ?? '',
    ].join(' '))

    return (!query || searchableText.includes(query))
      && (filters.purpose === 'all' || template.config.purpose === filters.purpose)
      && matchesDevice(template, filters.device)
      && (filters.modality === 'all' || template.config.kind === filters.modality)
      && matchesProtocol(template, filters.protocol)
      && (filters.dose === 'all' || template.config.doseMode === filters.dose)
      && matchesStimulus(template, filters.stimulus)
  })
}

export function hasActiveExerciseTemplateFilters(filters: ExerciseTemplateFilters) {
  return filters.query.trim().length > 0
    || filters.purpose !== 'all'
    || filters.device !== 'all'
    || filters.modality !== 'all'
    || filters.protocol !== 'all'
    || filters.dose !== 'all'
    || filters.stimulus !== 'all'
}
