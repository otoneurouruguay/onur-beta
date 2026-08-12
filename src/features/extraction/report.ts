import type { StudyType } from '../studies/types'
import type { ExtractionReviewRecord } from './repository'
import { isReportRelevantField } from './reportFields'

export interface ConfirmedExtractionParameter {
  code: string
  label: string
  value: string
}

export interface StudyExtractionReportModel {
  parameters: ConfirmedExtractionParameter[]
  conclusion: string
  rehabilitationSuggestion: string
}

/**
 * This is a literal projection of values and editable text confirmed by the
 * professional. Preliminary automatic drafts never reach this report unless
 * the professional reviews and confirms the extraction.
 */
export function buildStudyExtractionReport(
  extraction: ExtractionReviewRecord,
  studyType: StudyType,
): StudyExtractionReportModel | null {
  if (
    extraction.status !== 'confirmed' ||
    !extraction.professionalConclusion.trim() ||
    !extraction.rehabilitationSuggestion.trim()
  ) return null

  return {
    parameters: extraction.fields
      .filter((field) => field.studyType === studyType && isReportRelevantField(field) && field.confirmed && Boolean(field.professionalValue.trim()))
      .map((field) => ({ code: field.code, label: field.label, value: field.professionalValue.trim() })),
    conclusion: extraction.professionalConclusion.trim(),
    rehabilitationSuggestion: extraction.rehabilitationSuggestion.trim(),
  }
}
