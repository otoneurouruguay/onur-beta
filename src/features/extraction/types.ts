import type { MetricSide, StudyType } from '../studies/types'

export type IntakeKind = 'posturography_bap' | 'vestibular_and_reports'
export type PageClassification = 'posturography' | 'vestibular_report' | 'vhit_graph' | 'referral' | 'other_clinical' | 'unrecognized'
export type CanonicalExtractionFieldStatus = 'detected' | 'confirmed' | 'needs_review' | 'unreadable' | 'not_reported' | 'not_performed' | 'invalid' | 'conflicting'
/** Los tres estados históricos se conservan al leer borradores anteriores. */
export type ExtractionFieldStatus = CanonicalExtractionFieldStatus | 'read' | 'review' | 'unrecognized'
export type PatientMatchStatus = 'match' | 'mismatch' | 'not_checked' | 'confirmed_by_professional'
export type ExtractionSourceMethod = 'ocr_original' | 'ocr_grayscale' | 'ocr_threshold' | 'regex' | 'cross_validation' | 'vision_fallback' | 'professional_edit'
export type ExtractionTemplateType = 'bap_2_32' | 'vhit_labeled' | 'vestibular_report' | 'generic'

export interface SourceRegion { x: number; y: number; width: number; height: number }

export interface OcrLine {
  text: string
  confidence: number
  region: SourceRegion
  regionId?: string
  method?: ExtractionSourceMethod
  passId?: string
}

export interface ExtractedPage {
  pageNumber: number
  proposedClassification: PageClassification
  classification: PageClassification
  classificationConfidence: number
  rotationDegrees: number
  width: number
  height: number
  previewUrl: string
  text: string
  lines: OcrLine[]
  template?: { type: ExtractionTemplateType; confidence: number; matchedSignals: number; aspectRatio: number }
}

export interface ExtractionFieldDefinition {
  code: string
  label: string
  group: string
  studyType: StudyType
  required?: boolean
  metricCode?: string
  unitCode?: string
  side?: MetricSide
  conditionCode?: string
  aliases: string[]
}

export interface ExtractedField {
  clientId: string
  code: string
  label: string
  group: string
  studyType: StudyType
  required: boolean
  metricCode: string
  rawValue: string
  normalizedValue: string
  unitCode: string
  conditionCode: string
  side: MetricSide
  pageNumber: number
  region: SourceRegion | null
  confidence: number
  status: ExtractionFieldStatus
  extractorMethod: 'local_ocr' | 'embedded_pdf_text' | 'manual'
  extractorVersion: string
  professionalValue: string
  confirmed: boolean
  value?: string | number | null
  displayValue?: string
  warnings?: string[]
  validation?: {
    rangeValid: boolean | null
    crossCheckValid: boolean | null
    multiPassAgreement: boolean | null
  }
  source?: {
    page: number
    regionId: string
    normalizedBbox: SourceRegion | null
    method: ExtractionSourceMethod
  }
  candidates?: Array<{ raw: string; value: string | number | null; confidence: number; method: ExtractionSourceMethod }>
  correctionHistory?: Array<{ previousValue: string; value: string; correctedAt: string; actor: 'professional' }>
}

export interface LocalExtractionDraft {
  intakeKind: IntakeKind
  extractorVersion: string
  pages: ExtractedPage[]
  fields: ExtractedField[]
  patientMatchStatus: PatientMatchStatus
  mismatchFields: string[]
  studyDate?: string
  uploadDate?: string
}

export interface ExtractionProgress {
  currentPage: number
  totalPages: number
  phase: 'rendering' | 'ocr' | 'classifying' | 'done'
}

export interface PersistedExtractionDraft extends LocalExtractionDraft {
  id: string
  documentId: string
  studyIds: string[]
  status: 'review' | 'confirmed' | 'manual' | 'discarded'
}

export const pageClassificationLabels: Record<PageClassification, string> = {
  posturography: 'Posturografía',
  vestibular_report: 'Informe vestibular / vHIT',
  vhit_graph: 'Gráficos vHIT u oculomotores',
  referral: 'Orden o derivación',
  other_clinical: 'Otro documento clínico',
  unrecognized: 'No reconocido',
}
