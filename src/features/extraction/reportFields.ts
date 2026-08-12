import type { StudyType } from '../studies/types'
import type { ExtractedField } from './types'

const reportRelevantCodes: Record<StudyType, ReadonlySet<string>> = {
  posturography: new Set([
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
    'mix_ve_som',
    'mix_ve_vi',
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
