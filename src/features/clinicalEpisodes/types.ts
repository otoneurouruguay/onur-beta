import type { PathologyRecommendationId } from '../clinicalRecommendations/catalog'

export type DiagnosticCertainty = 'confirmed' | 'probable' | 'working'
export type ClinicalPhase = 'acute' | 'subacute' | 'chronic' | 'interictal' | 'stable' | 'fluctuating' | 'unknown'
export type ClinicalCourse = 'less_than_month' | 'one_to_three_months' | 'more_than_three_months' | 'recurrent' | 'progressive' | 'unknown'
export type ClinicalLaterality = 'left' | 'right' | 'bilateral' | 'not_applicable' | 'unknown'
export type ClinicalEpisodeStatus = 'draft' | 'reviewed'

export interface CommonAnamnesis {
  primarySymptoms: string
  triggers: string
  recoveryPattern: string
  falls: string
  gaitAndMobility: string
  hearingStatus: string
  visionStatus: string
  migraineStatus: string
  cervicalStatus: string
  cognitiveStatus: string
  relevantMedications: string
  environment: string
  supervision: string
  fallRisk: 'low' | 'moderate' | 'high' | 'not_assessed'
  symptomScale: string
  symptomCeiling: string
  recoveryWindow: string
  stopRules: string
}

export interface ClinicalEpisodeValues {
  treatmentCycleId: string
  diagnosisCode: PathologyRecommendationId
  certainty: DiagnosticCertainty
  diagnosisSource: string
  onsetDate: string
  phase: ClinicalPhase
  course: ClinicalCourse
  etiology: string
  laterality: ClinicalLaterality
  anamnesis: CommonAnamnesis
  pathologyFindings: Record<string, string | boolean | number>
  measuredImpairments: string
  activityLimitations: string
  participationGoals: string
  precautions: string
  pendingData: string
  clinicianNotes: string
  status: ClinicalEpisodeStatus
}

export interface ClinicalEpisodeRecord extends ClinicalEpisodeValues {
  id: string
  patientId: string
  createdAt: string
  updatedAt: string
  reviewedAt: string
  reviewedBy: string
}

export type SuggestionKind = 'platform' | 'external'

export interface ClinicalExerciseSuggestion {
  id: string
  diagnosisCode: PathologyRecommendationId
  title: string
  kind: SuggestionKind
  templateId?: string
  targetImpairment: string
  rationale: string
  execution: string
  dose: string
  progression: string
  regression: string
  pauseCriteria: string
  sourceIds: `SRC-${string}`[]
}

export interface EpisodeClinicalSummary {
  description: string
  patientFindings: string[]
  treatedDeficits: string[]
  warnings: string[]
  pending: string[]
  suggestions: ClinicalExerciseSuggestion[]
}

export const emptyAnamnesis: CommonAnamnesis = {
  primarySymptoms: '',
  triggers: '',
  recoveryPattern: '',
  falls: '',
  gaitAndMobility: '',
  hearingStatus: '',
  visionStatus: '',
  migraineStatus: '',
  cervicalStatus: '',
  cognitiveStatus: '',
  relevantMedications: '',
  environment: 'domicilio y clínica',
  supervision: '',
  fallRisk: 'not_assessed',
  symptomScale: 'Escala numérica 0–10',
  symptomCeiling: '',
  recoveryWindow: '',
  stopRules: '',
}

export function createEmptyClinicalEpisode(treatmentCycleId = ''): ClinicalEpisodeValues {
  return {
    treatmentCycleId,
    diagnosisCode: 'unilateral_hypofunction',
    certainty: 'confirmed',
    diagnosisSource: '',
    onsetDate: '',
    phase: 'unknown',
    course: 'unknown',
    etiology: '',
    laterality: 'unknown',
    anamnesis: { ...emptyAnamnesis },
    pathologyFindings: {},
    measuredImpairments: '',
    activityLimitations: '',
    participationGoals: '',
    precautions: '',
    pendingData: '',
    clinicianNotes: '',
    status: 'draft',
  }
}
