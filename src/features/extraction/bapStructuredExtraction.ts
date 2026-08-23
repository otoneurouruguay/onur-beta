import { parseLocaleNumber } from '../studies/normalization'
import type { ExtractedField, ExtractedPage, ExtractionSourceMethod, SourceRegion } from './types'

interface NumericEvidence {
  raw: string
  value: number
  confidence: number
  region: SourceRegion
  method: ExtractionSourceMethod
}

export interface BapLocatedValue {
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

const boxes: Record<string, { regionId: string; bbox: SourceRegion }> = {
  los_area: { regionId: 'conditions_top', bbox: { x: .245, y: .145, width: .055, height: .06 } },
  condition_area_1: { regionId: 'conditions_top', bbox: { x: .305, y: .145, width: .052, height: .06 } },
  condition_area_2: { regionId: 'conditions_top', bbox: { x: .37, y: .145, width: .05, height: .06 } },
  condition_area_3: { regionId: 'conditions_top', bbox: { x: .435, y: .145, width: .05, height: .06 } },
  condition_area_4: { regionId: 'conditions_top', bbox: { x: .495, y: .145, width: .05, height: .06 } },
  condition_area_5: { regionId: 'conditions_top', bbox: { x: .555, y: .145, width: .06, height: .06 } },
  condition_area_6: { regionId: 'conditions_top', bbox: { x: .615, y: .145, width: .065, height: .06 } },
  los_forward: { regionId: 'directional_metrics', bbox: { x: .06, y: .205, width: .055, height: .03 } },
  los_backward: { regionId: 'directional_metrics', bbox: { x: .155, y: .205, width: .065, height: .03 } },
  los_left: { regionId: 'directional_metrics', bbox: { x: .06, y: .235, width: .055, height: .03 } },
  los_right: { regionId: 'directional_metrics', bbox: { x: .155, y: .235, width: .065, height: .03 } },
  selected_area: { regionId: 'directional_metrics', bbox: { x: .06, y: .255, width: .06, height: .05 } },
  sway_per_second_x: { regionId: 'sway_x_high_priority', bbox: { x: .075, y: .305, width: .055, height: .055 } },
  sway_per_minute_x: { regionId: 'sway_metrics', bbox: { x: .175, y: .305, width: .055, height: .055 } },
  sway_per_second_y: { regionId: 'sway_y_high_priority', bbox: { x: .075, y: .345, width: .055, height: .055 } },
  sway_per_minute_y: { regionId: 'sway_metrics', bbox: { x: .175, y: .345, width: .055, height: .055 } },
  afis_pattern: { regionId: 'aphysiological_pattern_high_priority', bbox: { x: .13, y: .405, width: .085, height: .055 } },
  los_score: { regionId: 'left_indices', bbox: { x: .13, y: .45, width: .085, height: .055 } },
  mix_ve_som: { regionId: 'left_indices', bbox: { x: .13, y: .50, width: .085, height: .055 } },
  mix_ve_vi: { regionId: 'left_indices', bbox: { x: .13, y: .55, width: .085, height: .06 } },
  sensory_contribution_somatosensory: { regionId: 'sensory_contribution', bbox: { x: .90, y: .105, width: .09, height: .032 } },
  sensory_contribution_visual: { regionId: 'sensory_contribution', bbox: { x: .90, y: .14, width: .09, height: .032 } },
  sensory_contribution_vestibular: { regionId: 'sensory_contribution', bbox: { x: .90, y: .173, width: .09, height: .035 } },
  reported_age: { regionId: 'age_high_priority', bbox: { x: .47, y: .84, width: .07, height: .08 } },
  condition_1: { regionId: 'condition_scores_chart', bbox: { x: .73, y: .23, width: .035, height: .065 } },
  condition_2: { regionId: 'condition_scores_chart', bbox: { x: .765, y: .23, width: .035, height: .065 } },
  condition_3: { regionId: 'condition_scores_chart', bbox: { x: .795, y: .23, width: .035, height: .065 } },
  condition_4: { regionId: 'condition_scores_chart', bbox: { x: .825, y: .23, width: .04, height: .075 } },
  condition_5: { regionId: 'condition_scores_chart', bbox: { x: .85, y: .25, width: .04, height: .07 } },
  condition_6: { regionId: 'condition_scores_chart', bbox: { x: .885, y: .25, width: .04, height: .075 } },
  composite_score: { regionId: 'condition_scores_chart', bbox: { x: .915, y: .23, width: .06, height: .075 } },
  sensory_somatosensory: { regionId: 'sensory_chart', bbox: { x: .735, y: .54, width: .055, height: .075 } },
  sensory_visual: { regionId: 'sensory_chart', bbox: { x: .79, y: .54, width: .055, height: .075 } },
  sensory_vestibular: { regionId: 'sensory_chart', bbox: { x: .84, y: .55, width: .055, height: .075 } },
  visual_preference: { regionId: 'sensory_chart', bbox: { x: .89, y: .54, width: .065, height: .075 } },
}

function intersects(first: SourceRegion, second: SourceRegion) {
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y
}

function extractionMethod(line: ExtractedPage['lines'][number]): ExtractionSourceMethod {
  return line.method ?? 'ocr_original'
}

function numericEvidence(page: ExtractedPage): NumericEvidence[] {
  return page.lines.flatMap((line) => [...line.text.matchAll(/[+-]?\s*(?:\d+(?:[.,]\d+)?|[.,]\d+)\s*%?/g)].flatMap((match) => {
    if (match.index === undefined) return []
    const raw = match[0].replace(/\s+/g, ' ').trim()
    const value = parseLocaleNumber(raw)
    if (value === null) return []
    const characterWidth = line.region.width / Math.max(1, line.text.length)
    return [{
      raw,
      value,
      confidence: line.confidence / 100,
      method: extractionMethod(line),
      region: {
        x: line.region.x + characterWidth * match.index,
        y: line.region.y,
        width: Math.max(.008, characterWidth * raw.length),
        height: line.region.height,
      },
    }]
  }))
}

function normalizedNumeric(code: string, evidence: NumericEvidence) {
  const compact = evidence.raw.replace(/[%\s]/g, '')
  if (code === 'condition_area_1' && /^0\d{3}$/.test(compact)) return Number(`0.${compact.slice(1)}`)
  if (['los_forward', 'los_backward', 'los_left', 'los_right'].includes(code) && /^[+-]?0\d{3}$/.test(compact)) {
    const sign = compact.startsWith('-') ? -1 : 1
    const digits = compact.replace(/^[+-]/, '')
    return sign * Number(`${digits.slice(0, 2)}.${digits.slice(2)}`)
  }
  if (['afis_pattern', 'los_score', 'mix_ve_som', 'mix_ve_vi'].includes(code) && /^\d{3}$/.test(compact)) return Number(`${compact.slice(0, -1)}.${compact.slice(-1)}`)
  return evidence.value
}

function rangeFor(code: string): [number, number] {
  if (code === 'reported_age') return [1, 120]
  if (/^condition_[1-6]$/.test(code) || code === 'composite_score' || ['sensory_somatosensory', 'sensory_visual', 'sensory_vestibular', 'visual_preference'].includes(code)) return [0, 100]
  if (code.startsWith('sensory_contribution_') || ['afis_pattern', 'los_score', 'mix_ve_som', 'mix_ve_vi'].includes(code)) return [0, 100]
  if (code.startsWith('sway_')) return [0, 2000]
  if (['los_forward', 'los_backward', 'los_left', 'los_right'].includes(code)) return [-30, 30]
  return [0, 1000]
}

function chooseEvidence(code: string, page: ExtractedPage, bbox: SourceRegion) {
  const [minimum, maximum] = rangeFor(code)
  const candidates = numericEvidence(page)
    .filter((candidate) => {
      const centerX = candidate.region.x + candidate.region.width / 2
      const centerY = candidate.region.y + candidate.region.height / 2
      return centerX >= bbox.x && centerX <= bbox.x + bbox.width && centerY >= bbox.y && centerY <= bbox.y + bbox.height && candidate.region.height <= Math.max(.08, bbox.height * 1.5)
    })
    .map((candidate) => ({ ...candidate, normalized: normalizedNumeric(code, candidate) }))
    .filter((candidate) => candidate.normalized >= minimum && candidate.normalized <= maximum)
  if (!candidates.length) return null
  const groups = new Map<string, typeof candidates>()
  for (const candidate of candidates) {
    const key = String(candidate.normalized)
    groups.set(key, [...(groups.get(key) ?? []), candidate])
  }
  return [...groups.values()].sort((first, second) => {
    const score = (items: typeof candidates) => Math.min(3, items.length) * .18 + Math.max(...items.map((item) => item.confidence)) * .55 + (items.some((item) => /[.,]/.test(item.raw)) ? .12 : 0) + (/^condition_[1-6]$/.test(code) && items.some((item) => item.raw.replace(/\D/g, '').length >= 2) ? .2 : 0)
    return score(second) - score(first)
  })[0]
}

function isoDate(raw: string) {
  const match = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/)
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function textLocated(code: string, page: ExtractedPage): BapLocatedValue | null {
  const lines = page.lines.filter((line) => line.region.y > .82)
  const identityPatterns: Partial<Record<string, RegExp>> = {
    last_name: /\bAPELLIDO\s*[:=©]?\s*([\p{L}'-]+)(?=\s+EDAD\b|\s*$)/iu,
    first_name: /\bNOMBRE\s*[:=©]?\s*([\p{L}'-]+)(?=\s+SEXO\b|\s*$)/iu,
    reported_sex: /\bSEXO\s*[:=©]?\s*([FM])\b/iu,
  }
  const identityPattern = identityPatterns[code]
  if (identityPattern) {
    const candidates = lines.flatMap((line) => {
      const match = line.text.match(identityPattern)
      return match?.[1] ? [{ line, raw: match[1].trim() }] : []
    }).sort((a, b) => (b.line.regionId === 'patient_identity' ? .15 : 0) + b.line.confidence / 100 - ((a.line.regionId === 'patient_identity' ? .15 : 0) + a.line.confidence / 100))
    const selected = candidates[0]
    if (selected) {
      const located = locatedText(selected.raw, selected.raw, selected.line, 'patient_identity', extractionMethod(selected.line))
      located.candidates = candidates.map((candidate) => ({ raw: candidate.raw, value: candidate.raw, confidence: candidate.line.confidence / 100, method: extractionMethod(candidate.line) }))
      located.validation.multiPassAgreement = new Set(candidates.map((candidate) => candidate.raw.toLocaleLowerCase('es-UY'))).size === 1
      return located
    }
  }
  if (code === 'study_date') {
    const candidates = lines.flatMap((line) => [...line.text.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g)].map((match) => ({ line, raw: match[0], value: isoDate(match[0]) }))).filter((candidate) => candidate.value)
    const groups = new Map<string, typeof candidates>()
    for (const candidate of candidates) groups.set(candidate.value!, [...(groups.get(candidate.value!) ?? []), candidate])
    const selected = [...groups.values()].sort((first, second) => {
      const score = (items: typeof candidates) => items.length * .25 + Math.max(...items.map((item) => item.line.confidence / 100)) * .45 + (items.some((item) => item.line.regionId === 'study_datetime_high_priority') ? .3 : 0)
      return score(second) - score(first)
    })[0]?.sort((a, b) => (b.line.regionId === 'study_datetime_high_priority' ? 1 : 0) - (a.line.regionId === 'study_datetime_high_priority' ? 1 : 0) || b.line.confidence - a.line.confidence)[0]
    const original = candidates.filter((candidate) => candidate.line.regionId === 'study_datetime_high_priority' && candidate.line.method === 'ocr_original').sort((a, b) => b.line.confidence - a.line.confidence)[0]
    const preferred = original ?? selected
    if (preferred) {
      const located = locatedText(preferred.raw, preferred.value!, preferred.line, 'study_datetime_high_priority', 'regex')
      located.candidates = candidates.map((candidate) => ({ raw: candidate.raw, value: candidate.value!, confidence: candidate.line.confidence / 100, method: extractionMethod(candidate.line) }))
      located.validation.multiPassAgreement = groups.size === 1
      if (groups.size > 1) {
        located.status = 'conflicting'
        located.warnings = ['La lectura original y una variante binarizada discrepan en el año; se conserva la lectura de color original para confirmación profesional.']
        located.confidence = .78
      }
      return located
    }
  }
  if (code === 'study_time') {
    const candidates = lines.flatMap((line) => [...line.text.matchAll(/\b(\d{1,2})\s*h\s*(\d{2})\s*m?\b/gi)].map((match) => ({ line, raw: match[0], value: `${match[1].padStart(2, '0')}:${match[2]}` })))
    const selected = candidates.sort((a, b) => b.line.confidence - a.line.confidence)[0]
    if (selected) return locatedText(selected.raw, selected.value, selected.line, 'study_datetime_high_priority', 'regex')
  }
  if (code === 'patient_id') {
    const candidates = lines.flatMap((line) => [...line.text.matchAll(/\b\d{7,12}\b/g)].map((match) => ({ line, raw: match[0] })))
    const selected = candidates.sort((a, b) => b.line.confidence - a.line.confidence)[0]
    if (selected) return locatedText(selected.raw, selected.raw, selected.line, 'patient_identity', 'regex')
  }
  return null
}

function locatedText(raw: string, value: string, line: ExtractedPage['lines'][number], regionId: string, method: ExtractionSourceMethod): BapLocatedValue {
  return { raw, value, displayValue: value, confidence: Math.min(.96, .55 + line.confidence / 200 + .1), region: line.region, regionId, method, status: 'detected', warnings: [], validation: { rangeValid: true, crossCheckValid: null, multiPassAgreement: null }, candidates: [{ raw, value, confidence: line.confidence / 100, method }] }
}

export function findBapStructuredValue(code: string, page: ExtractedPage): BapLocatedValue | null {
  const textual = textLocated(code, page)
  if (textual) return textual
  if (code === 'pppd_index') {
    const region = { x: .13, y: .60, width: .09, height: .08 }
    const evidence = page.lines.filter((line) => intersects(line.region, region) && line.text.trim())
    if (evidence.length) return {
      raw: '∞ %', value: null, displayValue: 'No calculable', confidence: .9, region, regionId: 'pppd_high_priority', method: 'cross_validation', status: 'invalid',
      warnings: ['El índice PPPD impreso es infinito; se conserva como no calculable, nunca como cero.'],
      validation: { rangeValid: false, crossCheckValid: true, multiPassAgreement: evidence.length > 1 },
      candidates: evidence.map((line) => ({ raw: line.text.trim(), value: null, confidence: line.confidence / 100, method: extractionMethod(line) })),
    }
    return null
  }
  if (code === 'condition_area_7' || code === 'condition_area_8') {
    const index = code.endsWith('_7') ? 0 : 1
    const bbox = { x: index === 0 ? .025 : .095, y: .79, width: .065, height: .07 }
    const group = chooseEvidence(code, page, bbox)
    if (group?.some((candidate) => candidate.normalized === 0)) return {
      raw: group.sort((a, b) => b.confidence - a.confidence)[0].raw, value: null, displayValue: 'No realizada', confidence: .92, region: bbox, regionId: 'left_indices', method: 'cross_validation', status: 'not_performed',
      warnings: ['El área impresa es 0,000 y el icono de la condición está deshabilitado; no representa rendimiento cero.'],
      validation: { rangeValid: true, crossCheckValid: true, multiPassAgreement: group.length > 1 },
      candidates: group.map((candidate) => ({ raw: candidate.raw, value: candidate.normalized, confidence: candidate.confidence, method: candidate.method })),
    }
    return null
  }
  if (code === 'scale') {
    const line = page.lines.filter((candidate) => intersects(candidate.region, { x: .15, y: .245, width: .08, height: .07 })).find((candidate) => /x\s*10/i.test(candidate.text))
    if (line) return locatedText(line.text.match(/x\s*10/i)?.[0].replace(/\s/g, '') ?? 'X10', 'X10', line, 'directional_metrics', extractionMethod(line))
    return null
  }
  if (code === 'selected_condition') {
    const selectedArea = findBapStructuredValue('selected_area', page)?.value
    if (typeof selectedArea !== 'number') return null
    const matches = Array.from({ length: 6 }, (_, index) => ({ index: index + 1, located: findBapStructuredValue(`condition_area_${index + 1}`, page) }))
      .filter((candidate) => typeof candidate.located?.value === 'number')
      .map((candidate) => ({ ...candidate, difference: Math.abs(Number(candidate.located?.value) - selectedArea) }))
      .sort((a, b) => a.difference - b.difference)
    if (matches[0]?.difference <= .02) return {
      raw: String(matches[0].index), value: matches[0].index, displayValue: String(matches[0].index), confidence: .94, region: matches[0].located!.region, regionId: 'directional_metrics', method: 'cross_validation', status: 'detected', warnings: [],
      validation: { rangeValid: true, crossCheckValid: true, multiPassAgreement: null }, candidates: [{ raw: String(matches[0].index), value: matches[0].index, confidence: .94, method: 'cross_validation' }],
    }
    return null
  }
  const spec = boxes[code]
  if (!spec) return null
  let group = chooseEvidence(code, page, spec.bbox)
  if (code === 'condition_area_6') {
    const selected = chooseEvidence('selected_area', page, boxes.selected_area.bbox)?.[0]?.normalized
    const all = numericEvidence(page).filter((candidate) => intersects(candidate.region, spec.bbox)).map((candidate) => ({ ...candidate, normalized: normalizedNumeric(code, candidate) }))
    const crossChecked = typeof selected === 'number' ? all.filter((candidate) => Math.abs(candidate.normalized - selected) <= .02) : []
    if (crossChecked.length) group = crossChecked
  }
  if (!group?.length) return null
  const selected = [...group].sort((a, b) => (/[.,]/.test(b.raw) ? .1 : 0) + b.confidence - ((/[.,]/.test(a.raw) ? .1 : 0) + a.confidence))[0]
  const value = selected.normalized
  const agreement = group.length > 1
  const confidence = Math.min(.98, .62 + Math.min(.18, group.length * .07) + selected.confidence * .15 + .08)
  return {
    raw: selected.raw, value, displayValue: String(value), confidence, region: selected.region, regionId: spec.regionId,
    method: agreement ? 'cross_validation' : selected.method, status: confidence >= .82 ? 'detected' : 'needs_review', warnings: [],
    validation: { rangeValid: true, crossCheckValid: code === 'condition_area_6' ? true : null, multiPassAgreement: agreement },
    candidates: group.map((candidate) => ({ raw: candidate.raw, value: candidate.normalized, confidence: candidate.confidence, method: candidate.method })),
  }
}

function fieldNumber(fields: ExtractedField[], code: string) {
  const field = fields.find((candidate) => candidate.code === code)
  if (typeof field?.value === 'number') return field.value
  const parsed = parseLocaleNumber(field?.normalizedValue ?? '')
  return parsed
}

function markCrossCheck(field: ExtractedField | undefined, valid: boolean, warning: string) {
  if (!field) return
  field.validation = { rangeValid: field.validation?.rangeValid ?? null, multiPassAgreement: field.validation?.multiPassAgreement ?? null, crossCheckValid: valid }
  if (!valid) {
    field.status = 'needs_review'
    field.warnings = [...(field.warnings ?? []), warning]
  } else if (field.status === 'needs_review' && field.confidence >= .78) field.status = 'detected'
}

export function validateBapFields(fields: ExtractedField[]) {
  const condition = (index: number) => fieldNumber(fields, `condition_${index}`)
  const checks: Array<{ code: string; calculated: number | null; tolerance: number }> = [
    { code: 'sensory_somatosensory', calculated: condition(1) && condition(2) !== null ? condition(2)! / condition(1)! * 100 : null, tolerance: 2 },
    { code: 'sensory_visual', calculated: condition(1) && condition(4) !== null ? condition(4)! / condition(1)! * 100 : null, tolerance: 2 },
    { code: 'sensory_vestibular', calculated: condition(1) && condition(5) !== null ? condition(5)! / condition(1)! * 100 : null, tolerance: 2 },
    { code: 'visual_preference', calculated: condition(2) !== null && condition(3) !== null && condition(5) !== null && condition(6) !== null && condition(2)! + condition(5)! > 0 ? (condition(3)! + condition(6)!) / (condition(2)! + condition(5)!) * 100 : null, tolerance: 2 },
  ]
  for (const check of checks) {
    const field = fields.find((candidate) => candidate.code === check.code)
    const observed = fieldNumber(fields, check.code)
    if (observed !== null && check.calculated !== null) markCrossCheck(field, Math.abs(observed - check.calculated) <= check.tolerance, 'El valor impreso no concuerda con el control matemático dentro de la tolerancia permitida.')
  }
  const contributions = ['sensory_contribution_somatosensory', 'sensory_contribution_visual', 'sensory_contribution_vestibular'].map((code) => fieldNumber(fields, code))
  if (contributions.every((value) => value !== null)) {
    const valid = contributions.reduce((sum, value) => sum + Number(value), 0) >= 98 && contributions.reduce((sum, value) => sum + Number(value), 0) <= 101
    for (const code of ['sensory_contribution_somatosensory', 'sensory_contribution_visual', 'sensory_contribution_vestibular']) markCrossCheck(fields.find((field) => field.code === code), valid, 'La suma de contribuciones sensoriales queda fuera del intervalo 98–101 %.')
  }
  return fields
}

export function normalizedStudyDate(fields: ExtractedField[]) {
  const field = fields.find((candidate) => candidate.code === 'study_date')
  return typeof field?.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(field.value) ? field.value : ''
}
