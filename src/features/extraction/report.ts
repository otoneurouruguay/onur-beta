import type { StudyType } from '../studies/types'
import type { ExtractionReviewRecord } from './repository'
import { isReportRelevantField } from './reportFields'
import { canonicalFieldStatus } from './fieldResults'

export interface ConfirmedExtractionParameter {
  code: string
  label: string
  value: string
  status: ReturnType<typeof canonicalFieldStatus>
}

export interface StudyExtractionReportModel {
  parameters: ConfirmedExtractionParameter[]
  qualityControls: ConfirmedExtractionParameter[]
  limitations: string[]
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

  const confirmed = extraction.fields
      .filter((field) => field.studyType === studyType && isReportRelevantField(field) && field.confirmed && Boolean(field.professionalValue.trim()))
      .map((field) => ({ code: field.code, label: field.label, value: field.professionalValue.trim(), status: canonicalFieldStatus(field) }))
  const qualityCodes = new Set(['afis_pattern', 'mix_ve_som', 'mix_ve_vi', 'pppd_index'])
  return {
    parameters: confirmed.filter((field) => !qualityCodes.has(field.code)),
    qualityControls: confirmed.filter((field) => qualityCodes.has(field.code)),
    limitations: extraction.fields.filter((field) => field.confirmed).flatMap((field) => field.warnings ?? []).filter((warning, index, all) => all.indexOf(warning) === index),
    conclusion: extraction.professionalConclusion.trim(),
    rehabilitationSuggestion: extraction.rehabilitationSuggestion.trim(),
  }
}
