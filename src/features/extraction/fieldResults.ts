import type { CanonicalExtractionFieldStatus, ExtractedField, ExtractionFieldStatus } from './types'

export interface ExtractionFieldCounters {
  total: number
  detected: number
  confirmed: number
  needsReview: number
  unreadable: number
  notReported: number
  notPerformed: number
  invalid: number
  conflicting: number
  missingRequired: number
}

export function canonicalFieldStatus(field: Pick<ExtractedField, 'status' | 'confirmed' | 'professionalValue'>): CanonicalExtractionFieldStatus {
  if (field.confirmed && !['invalid', 'not_performed', 'not_reported', 'unreadable'].includes(field.status)) return 'confirmed'
  if (field.status === 'read') return 'detected'
  if (field.status === 'review') return 'needs_review'
  if (field.status === 'unrecognized') return field.professionalValue.trim() ? 'needs_review' : 'not_reported'
  return field.status
}

export function isFieldPresent(field: Pick<ExtractedField, 'status' | 'confirmed' | 'professionalValue'>) {
  const status = canonicalFieldStatus(field)
  return !['unreadable', 'not_reported'].includes(status) && Boolean(field.professionalValue.trim() || ['not_performed', 'invalid'].includes(status))
}

export function deriveFieldCounters(fields: ExtractedField[]): ExtractionFieldCounters {
  const counters: ExtractionFieldCounters = { total: fields.length, detected: 0, confirmed: 0, needsReview: 0, unreadable: 0, notReported: 0, notPerformed: 0, invalid: 0, conflicting: 0, missingRequired: 0 }
  for (const field of fields) {
    const status = canonicalFieldStatus(field)
    if (status === 'detected') counters.detected += 1
    else if (status === 'confirmed') counters.confirmed += 1
    else if (status === 'needs_review') counters.needsReview += 1
    else if (status === 'unreadable') counters.unreadable += 1
    else if (status === 'not_reported') counters.notReported += 1
    else if (status === 'not_performed') counters.notPerformed += 1
    else if (status === 'invalid') counters.invalid += 1
    else if (status === 'conflicting') counters.conflicting += 1
    if (field.required && !isFieldPresent(field)) counters.missingRequired += 1
  }
  return counters
}

export function persistedFieldStatus(status: ExtractionFieldStatus): 'read' | 'review' | 'unrecognized' {
  if (['detected', 'confirmed', 'not_performed', 'invalid', 'read'].includes(status)) return 'read'
  if (['needs_review', 'conflicting', 'review'].includes(status)) return 'review'
  return 'unrecognized'
}

export function fieldReviewReason(field: ExtractedField) {
  const status = canonicalFieldStatus(field)
  if (status === 'conflicting') return field.warnings?.[0] ?? 'Lecturas válidas discordantes.'
  if (status === 'invalid') return field.warnings?.[0] ?? 'Valor impreso no calculable o inválido.'
  if (status === 'unreadable') return field.warnings?.[0] ?? 'La región no es legible.'
  if (status === 'not_reported') return field.warnings?.[0] ?? 'El equipo no informa este parámetro.'
  if (status === 'not_performed') return field.warnings?.[0] ?? 'Condición no realizada.'
  if (status === 'needs_review') return field.warnings?.[0] ?? 'La evidencia OCR requiere confirmación.'
  return ''
}
