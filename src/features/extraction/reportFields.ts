import type { StudyType } from '../studies/types'
import type { ExtractedField } from './types'

const reportRelevantCodes: Record<StudyType, ReadonlySet<string>> = {
  posturography: new Set([
    'study_date',
    'study_time',
    'last_name',
    'first_name',
    'reported_age',
    'reported_sex',
    'patient_id',
    'los_forward',
    'los_backward',
    'los_left',
    'los_right',
    'los_area',
    'selected_condition',
    'selected_area',
    'scale',
    'sway_per_second_x',
    'sway_per_second_y',
    'sway_per_minute_x',
    'sway_per_minute_y',
    'condition_area_1',
    'condition_area_2',
    'condition_area_3',
    'condition_area_4',
    'condition_area_5',
    'condition_area_6',
    'condition_area_7',
    'condition_area_8',
    'condition_1',
    'condition_2',
    'condition_3',
    'condition_4',
    'condition_5',
    'condition_6',
    'composite_score',
    'sensory_somatosensory',
    'sensory_visual',
    'sensory_vestibular',
    'visual_preference',
    'afis_pattern',
    'mix_ve_som',
    'mix_ve_vi',
    'pppd_index',
    'los_score',
    'sensory_contribution_somatosensory',
    'sensory_contribution_visual',
    'sensory_contribution_vestibular',
  ]),
  vhit: new Set([
    'himp',
    'curves_channels',
    'gain_right',
    'gain_left',
    'symmetry',
    'saccades',
    'calibration_quality',
    'conclusion',
  ]),
}

const reportRequiredCodes: Record<StudyType, ReadonlySet<string>> = {
  posturography: new Set([
    'study_date',
    'reported_age',
    'condition_1',
    'condition_2',
    'condition_3',
    'condition_4',
    'condition_5',
    'condition_6',
    'composite_score',
    'sensory_somatosensory',
    'sensory_visual',
    'sensory_vestibular',
    'visual_preference',
    'afis_pattern',
  ]),
  vhit: new Set([
    'himp',
    'curves_channels',
    'gain_right',
    'gain_left',
    'symmetry',
    'saccades',
  ]),
}

export function isReportRelevantField(field: Pick<ExtractedField, 'studyType' | 'code'>) {
  return reportRelevantCodes[field.studyType].has(field.code)
}

export function isReportRequiredField(field: Pick<ExtractedField, 'studyType' | 'code'>) {
  return reportRequiredCodes[field.studyType].has(field.code)
}
