import { parseLocaleNumber } from '../studies/normalization'
import type { ExtractedField, ExtractedPage, ExtractionSourceMethod, SourceRegion } from './types'

interface VestibularEvidence {
  raw: string
  value: string | number
  displayValue: string
  confidence: number
  region: SourceRegion
  method: ExtractionSourceMethod
  passId: string
}

export interface VestibularLocatedValue {
  raw: string
  value: string | number | null
  displayValue: string
  confidence: number
  region: SourceRegion
  regionId: string
  method: ExtractionSourceMethod
  status: ExtractedField['status']
  warnings: string[]
  validation: NonNullable<ExtractedField['validation']>
  candidates: NonNullable<ExtractedField['candidates']>
}

const gainPatterns: Record<string, RegExp[]> = {
  gain_right: [
    /(?:ganancia|gain|regresi[oó]n)\s*(?:derecha|right|od)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
  gain_left: [
    /(?:ganancia|gain|regresi[oó]n)?\s*(?:izquierda|left|oi)\s*[:=]\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
  gain_right_horizontal: [
    /(?:horizontal|lateral|h)\s*(?:derech[oa]|right|od)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
    /(?:derech[oa]|right|od)\s*(?:horizontal|lateral|h)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
  gain_left_horizontal: [
    /(?:horizontal|lateral|h)\s*(?:izquierd[oa]|left|oi)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
    /(?:izquierd[oa]|left|oi)\s*(?:horizontal|lateral|h)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
  gain_right_anterior: [
    /(?:anterior|superior)\s*(?:derech[oa]|right|ad|ra)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
    /(?:derech[oa]|right|ad|ra)\s*(?:anterior|superior)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
  gain_left_anterior: [
    /(?:anterior|superior)\s*(?:izquierd[oa]|left|ai|la)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
    /(?:izquierd[oa]|left|ai|la)\s*(?:anterior|superior)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
  gain_right_posterior: [
    /posterior\s*(?:derech[oa]|right|pd|rp)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
    /(?:derech[oa]|right|pd|rp)\s*posterior\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
  gain_left_posterior: [
    /posterior\s*(?:izquierd[oa]|left|pi|lp)\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
    /(?:izquierd[oa]|left|pi|lp)\s*posterior\s*[:=]?\s*([0-2](?:[.,][0-9]{1,3})?)/iu,
  ],
}

const numericPatterns: Record<string, RegExp[]> = {
  ...gainPatterns,
  reported_age: [/\bedad\s*[:=]?\s*([0-9]{1,3})\b/iu],
  symmetry: [/(?:simetr[ií]a|asimetr[ií]a)\s*[:=]?\s*([0-9]{1,3}(?:[.,][0-9]+)?\s*%?)/iu],
}

const textPatterns: Record<string, RegExp[]> = {
  study_date: [/(?:fecha\s+(?:del\s+)?estudio|fecha)\s*[:=]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/iu],
  study_time: [/(?:hora|time)\s*[:=]?\s*(\d{1,2}:\d{2}(?::\d{2})?)/iu],
  patient_name: [/(?:paciente|nombre)\s*[:=]\s*([^|;]{3,70}?)(?=\s+(?:edad|id|documento|fecha\s+de\s+nacimiento)\b|$)/iu],
  patient_id: [/(?:id|documento|c[eé]dula|ci|identificaci[oó]n)\s*[:=]\s*([a-z0-9.-]{4,30})/iu],
  impulse_counts: [/(?:impulse\s*(?:nr|number)|n[uú]mero\s+de\s+impulsos|cantidad\s+de\s+impulsos|impulsos)\s*[:=]?\s*([0-9]{1,3}(?:\s*[/|-]\s*[0-9]{1,3})?)/iu],
  head_velocity: [/(?:head\s+velocity|velocidad\s+(?:cef[aá]lica|de\s+cabeza|de\s+los\s+impulsos))\s*[:=]?\s*([^.;]{1,55})/iu],
  himp: [/\bhimp\b\s*[:=]?\s*([^.;]{1,100})/iu],
  shimp: [/\bshimp\b\s*[:=]?\s*([^.;]{1,100})/iu],
  saccades: [/(?:sacadas?\s+correctivas?|sacadas?|saccades?)\s*[:=]?\s*([^.;]{1,100})/iu, /\b((?:overt|covert)(?:[^.;]{0,80}))\b/iu],
  curves_channels: [/(?:canales?\s+evaluados?|plano(?:s)?|curvas?)\s*[:=]\s*([^.;]{2,120})/iu, /\b((?:cull|ralp|larp)(?:[^.;]{0,100}))\b/iu],
  gain_method: [/(?:m[eé]todo\s+(?:de\s+)?ganancia|gain\s+method)\s*[:=]\s*([^.;]{2,70})/iu, /\b(regresi[oó]n)\b/iu, /\b((?:40|60|80)\s*ms)\b/iu],
  test_device: [/(?:equipo|dispositivo|software|versi[oó]n)\s*[:=]\s*([^.;]{2,100})/iu],
  calibration_quality: [/(?:calibraci[oó]n|artefactos?|calidad|interpretabilidad)\s*[:=]\s*([^.;]{2,120})/iu],
}

function fold(value: string) {
  return value.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function sourceMethod(line: ExtractedPage['lines'][number]): ExtractionSourceMethod {
  return line.method ?? 'ocr_original'
}

function valueRegion(line: ExtractedPage['lines'][number], match: RegExpExecArray) {
  const raw = match[1]
  const offset = Math.max(0, (match.index ?? 0) + match[0].lastIndexOf(raw))
  const characterWidth = line.region.width / Math.max(1, line.text.length)
  return { x: line.region.x + offset * characterWidth, y: line.region.y, width: Math.max(.008, raw.length * characterWidth), height: line.region.height }
}

function isoDate(raw: string) {
  const parts = raw.split(/[/-]/).map(Number)
  if (parts.length !== 3) return null
  const [day, month, shortYear] = parts
  const year = shortYear < 100 ? 2000 + shortYear : shortYear
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function evidenceKey(value: string | number) {
  return typeof value === 'number' ? value.toFixed(4) : fold(value).replace(/\s+/g, ' ').trim()
}

function collectEvidence(code: string, page: ExtractedPage): VestibularEvidence[] {
  const patterns = numericPatterns[code] ?? textPatterns[code]
  if (!patterns) return []
  const evidence: VestibularEvidence[] = []
  for (const line of page.lines) {
    for (const pattern of patterns) {
      const match = pattern.exec(line.text)
      if (!match?.[1]) continue
      const raw = match[1].replace(/\s+/g, ' ').trim()
      let value: string | number = raw
      let displayValue = raw
      if (numericPatterns[code]) {
        const numeric = parseLocaleNumber(raw)
        if (numeric === null) continue
        value = numeric
        displayValue = code === 'symmetry' ? `${numeric} %` : String(numeric)
      } else if (code === 'study_date') {
        const normalized = isoDate(raw)
        if (!normalized) continue
        value = normalized
        displayValue = normalized
      }
      evidence.push({ raw, value, displayValue, confidence: line.confidence / 100, region: valueRegion(line, match), method: sourceMethod(line), passId: line.passId ?? `${line.regionId ?? 'page'}-${line.region.y.toFixed(3)}` })
      break
    }
  }
  return evidence.filter((candidate, index, all) => all.findIndex((other) => evidenceKey(other.value) === evidenceKey(candidate.value) && other.passId === candidate.passId) === index)
}

function rangeFor(code: string): [number, number] | null {
  if (code.startsWith('gain_')) return [0, 2]
  if (code === 'symmetry') return [0, 100]
  if (code === 'reported_age') return [0, 120]
  return null
}

function locatedFromEvidence(code: string, evidence: VestibularEvidence[]): VestibularLocatedValue | null {
  if (!evidence.length) return null
  const grouped = new Map<string, VestibularEvidence[]>()
  for (const item of evidence) grouped.set(evidenceKey(item.value), [...(grouped.get(evidenceKey(item.value)) ?? []), item])
  const ranked = [...grouped.values()].sort((first, second) => {
    const score = (items: VestibularEvidence[]) => Math.min(3, items.length) * .14 + Math.max(...items.map((item) => item.confidence))
    return score(second) - score(first)
  })
  const selectedGroup = ranked[0]
  const selected = selectedGroup.sort((a, b) => b.confidence - a.confidence)[0]
  const agreement = new Set(selectedGroup.map((item) => item.passId)).size > 1
  const range = rangeFor(code)
  const rangeValid = range && typeof selected.value === 'number' ? selected.value >= range[0] && selected.value <= range[1] : true
  const competing = ranked[1]?.some((item) => item.confidence >= .72) && selected.confidence >= .72
  const warnings: string[] = []
  let status: ExtractedField['status'] = selected.confidence >= .80 || agreement ? 'detected' : 'needs_review'
  if (!rangeValid) {
    status = 'invalid'
    warnings.push(`El valor queda fuera del rango técnico admitido para ${code.replaceAll('_', ' ')}.`)
  } else if (competing) {
    status = 'conflicting'
    warnings.push('Hay dos lecturas válidas discordantes; revisar el recorte antes de confirmar.')
  }
  if (/\b(?:no\s+realizad[oa]|no\s+aplica|n\/?a)\b/i.test(selected.raw)) status = 'not_performed'
  const confidence = Math.min(.98, .58 + selected.confidence * .25 + (agreement ? .12 : 0) + (rangeValid ? .04 : 0))
  return {
    raw: selected.raw,
    value: selected.value,
    displayValue: selected.displayValue,
    confidence,
    region: selected.region,
    regionId: pageRegionId(code, selected),
    method: agreement ? 'cross_validation' : selected.method,
    status,
    warnings,
    validation: { rangeValid, crossCheckValid: null, multiPassAgreement: agreement },
    candidates: evidence.map((item) => ({ raw: item.raw, value: item.value, confidence: item.confidence, method: item.method })),
  }
}

function pageRegionId(code: string, evidence: VestibularEvidence) {
  if (code.startsWith('gain_') || ['symmetry', 'himp', 'shimp', 'saccades', 'curves_channels'].includes(code)) return 'vhit_metrics'
  if (['impulse_counts', 'head_velocity', 'gain_method', 'test_device', 'calibration_quality'].includes(code)) return 'vhit_quality'
  if (['study_date', 'study_time', 'patient_name', 'reported_age', 'patient_id'].includes(code)) return 'document_header'
  return evidence.passId.split('-')[0] || 'generic_page'
}

export function findVestibularStructuredValue(code: string, page: ExtractedPage) {
  if (!['vestibular_report', 'vhit_graph', 'referral', 'other_clinical'].includes(page.classification)) return null
  return locatedFromEvidence(code, collectEvidence(code, page))
}

function fieldNumber(fields: ExtractedField[], code: string) {
  const field = fields.find((candidate) => candidate.studyType === 'vhit' && candidate.code === code)
  if (typeof field?.value === 'number') return field.value
  return parseLocaleNumber(field?.normalizedValue ?? '')
}

function markCrossCheck(field: ExtractedField | undefined, valid: boolean, warning: string) {
  if (!field) return
  field.validation = { rangeValid: field.validation?.rangeValid ?? null, multiPassAgreement: field.validation?.multiPassAgreement ?? null, crossCheckValid: valid }
  if (!valid) {
    field.status = 'needs_review'
    field.warnings = [...(field.warnings ?? []), warning]
  }
}

export function validateVestibularFields(fields: ExtractedField[], pages: ExtractedPage[]) {
  const vestibularFields = fields.filter((field) => field.studyType === 'vhit')
  const hasVhit = pages.some((page) => page.classification === 'vhit_graph' || page.template?.type === 'vhit_labeled') || vestibularFields.some((field) => ['gain_right', 'gain_left', 'impulse_counts'].includes(field.code) && Boolean(field.professionalValue.trim()))
  const hasNarrativeReport = pages.some((page) => page.classification === 'vestibular_report' || page.template?.type === 'vestibular_report')
  const required = new Set<string>(['document_type'])
  if (hasNarrativeReport) ['study_date', 'conclusion'].forEach((code) => required.add(code))
  if (hasVhit) ['study_date', 'himp', 'curves_channels', 'gain_right', 'gain_left', 'symmetry', 'saccades'].forEach((code) => required.add(code))
  for (const field of vestibularFields) {
    field.required = required.has(field.code)
    if (field.required && !field.professionalValue.trim() && !(field.warnings ?? []).some((warning) => warning.includes('obligatorio'))) {
      field.warnings = [...(field.warnings ?? []), 'El parámetro obligatorio no fue informado o no pudo leerse.']
    }
  }

  for (const side of ['right', 'left'] as const) {
    const aggregateCode = `gain_${side}`
    const horizontalCode = `gain_${side}_horizontal`
    const aggregate = fieldNumber(vestibularFields, aggregateCode)
    const horizontal = fieldNumber(vestibularFields, horizontalCode)
    if (aggregate !== null && horizontal !== null) {
      const valid = Math.abs(aggregate - horizontal) <= .05
      const warning = 'La ganancia global y la ganancia horizontal explícita no concuerdan dentro de ±0,05.'
      markCrossCheck(vestibularFields.find((field) => field.code === aggregateCode), valid, warning)
      markCrossCheck(vestibularFields.find((field) => field.code === horizontalCode), valid, warning)
    }
  }

  const saccades = vestibularFields.find((field) => field.code === 'saccades')
  if (hasVhit && saccades && !saccades.professionalValue.trim()) {
    saccades.warnings = [...(saccades.warnings ?? []), 'ONUr no interpreta las curvas para inferir sacadas: se requiere texto explícito o revisión profesional.']
  }
  return fields
}
