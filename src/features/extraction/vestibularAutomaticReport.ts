import { canonicalFieldStatus } from './fieldResults'
import type { ExtractedField } from './types'

export interface VestibularAutomaticReport {
  conclusion: string
  rehabilitationSuggestion: string
  evidence: string[]
  warnings: string[]
}

function usableField(fields: ExtractedField[], code: string) {
  const field = fields.find((candidate) => candidate.studyType === 'vhit' && candidate.code === code)
  if (!field || ['not_reported', 'unreadable', 'invalid'].includes(canonicalFieldStatus(field))) return ''
  return field.professionalValue.trim()
}

/**
 * Recupera únicamente los textos literales impresos en el documento. No
 * interpreta curvas, no diagnostica y no genera una conducta nueva.
 */
export function buildVestibularAutomaticReport(fields: ExtractedField[]): VestibularAutomaticReport | null {
  const conclusion = usableField(fields, 'conclusion')
  const conduct = usableField(fields, 'conduct')
  if (!conclusion && !conduct) return null
  return {
    conclusion,
    rehabilitationSuggestion: conduct,
    evidence: [
      ...(conclusion ? ['Conclusión/En suma transcripta literalmente del documento.'] : []),
      ...(conduct ? ['Conducta transcripta literalmente del documento.'] : []),
    ],
    warnings: ['Los textos son un borrador de transcripción y requieren revisión profesional; ONUr no interpreta las curvas vHIT.'],
  }
}
