import { parseLocaleNumber } from '../studies/normalization'
import { posturographyFieldDefinitions, vestibularFieldDefinitions } from './catalog'
import { findBapStructuredValue, validateBapFields } from './bapStructuredExtraction'
import { findVestibularStructuredValue, validateVestibularFields } from './vestibularStructuredExtraction'
import { deduplicateOcrSentences, sanitizeVestibularNarrative } from './vestibularNarrative'
import type { ExtractedField, ExtractedPage, ExtractionFieldDefinition, IntakeKind, PageClassification, PatientMatchStatus, SourceRegion } from './types'

export const EXTRACTOR_VERSION = 'onur-local-ocr-2.6'

function fold(value: string) {
  return value.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const pageSignals: Array<{ type: PageClassification; words: string[] }> = [
  { type: 'posturography', words: ['posturograf', 'bap', 'estabilograma', 'estabiloquinesigrama', 'limite de estabilidad', 'organizacion sensorial', 'porcent. de condiciones', 'patron afis', 'sway', 'score los'] },
  { type: 'vhit_graph', words: ['head impulse', 'vhit', 'himp', 'shimp', 'gain', 'ganancia', 'saccade', 'sacada', 'oculomotor'] },
  { type: 'vestibular_report', words: ['otoneurolog', 'vestibular', 'nistag', 'supresion visual', 'head shaking', 'pruebas posicionales', 'en suma'] },
  { type: 'referral', words: ['orden medica', 'derivacion', 'solicito', 'motivo de derivacion'] },
  { type: 'other_clinical', words: ['informe clinico', 'paciente', 'examen clinico', 'antecedentes'] },
]

export function classifyPage(text: string): { classification: PageClassification; confidence: number } {
  const source = fold(text)
  const ranked = pageSignals.map((signal) => ({ ...signal, score: signal.words.filter((word) => source.includes(word)).length })).sort((a, b) => b.score - a.score)
  const best = ranked[0]
  if (!best || best.score === 0) return { classification: 'unrecognized', confidence: 0 }
  const reportScore = ranked.find((item) => item.type === 'vestibular_report')?.score ?? 0
  if (reportScore >= 2 && /(?:antecedentes|motivo|conclusion|en suma|examen clinico)/.test(source)) return { classification: 'vestibular_report', confidence: Math.min(.98, .6 + reportScore * .08) }
  const graphHints = /(?:curva|canal|impulso|velocity|velocidad)/.test(source)
  if (best.type === 'vhit_graph' && !graphHints && ranked.find((item) => item.type === 'vestibular_report')?.score) return { classification: 'vestibular_report', confidence: Math.min(.96, .55 + best.score * .1) }
  return { classification: best.type, confidence: Math.min(.98, .55 + best.score * .1) }
}

function lineValue(text: string, alias: string) {
  const foldedText = fold(text)
  const foldedAlias = fold(alias)
  const escapedAlias = foldedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (foldedAlias === 'mc') {
    const match = /\bmc\s*(?:[:.=\-–—]\s*|\s+)(.*)$/iu.exec(foldedText)
    if (match?.[1] && match.index !== undefined) {
      const valueStart = match.index + match[0].length - match[1].length
      return text.slice(valueStart).trim()
    }
  }
  for (const pattern of [`${escapedAlias}\\s*(?::|=|-)\\s*(.*)$`, `${escapedAlias}\\s+(.+)$`]) {
    const match = foldedText.match(new RegExp(pattern, 'iu'))
    if (!match || match.index === undefined) continue
    const valueStart = match.index + match[0].length - match[1].length
    return text.slice(valueStart).trim()
  }
  return ''
}

const compactValueCodes = new Set([
  'study_date', 'study_time', 'duration', 'reported_age', 'los_forward', 'los_backward', 'los_left', 'los_right',
  'los_area', 'sway_per_second_x', 'sway_per_second_y', 'sway_per_minute_x', 'sway_per_minute_y', 'afis_pattern', 'los_score', 'mix_ve_som', 'mix_ve_vi', 'pppd_index',
  'composite_score', 'sensory_somatosensory', 'sensory_visual', 'sensory_vestibular',
  'visual_preference', 'gain_right', 'gain_left', 'symmetry', 'saccadic_velocity', 'impulse_counts', 'head_velocity',
])

function compactCandidate(definition: ExtractionFieldDefinition, value: string) {
  const trimmed = value.trim()
  if (!trimmed || !compactValueCodes.has(definition.code) && !definition.conditionCode) return trimmed
  if (definition.code === 'study_date') return trimmed.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0] ?? ''
  if (definition.code === 'study_time') return trimmed.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] ?? ''
  const literal = trimmed.match(/(?:no\s+aplica|no\s+registrado|n\/?a|n\/?r|∞|infinito)|[+-]?\s*(?:\d+(?:[.,]\d+)?|[.,]\d+)\s*(?:%|cm[²2]|mm[²2]|deg|°|hz|s|seg(?:undos?)?)?/i)?.[0]
  return literal?.replace(/\s+/g, ' ').trim() ?? trimmed
}

function normalizedValue(raw: string) {
  const number = parseLocaleNumber(raw)
  if (number !== null) return String(number)
  const measurement = raw.trim().match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*(?:cm2|cm²|mm2|mm²|deg|°|hz|s|seg|segundos?)$/i)
  if (measurement) {
    const measuredNumber = parseLocaleNumber(measurement[1])
    if (measuredNumber !== null) return String(measuredNumber)
  }
  const token = fold(raw.trim())
  if (['infinito', '∞'].includes(token)) return 'infinite'
  if (['no aplica', 'n/a'].includes(token)) return 'not_applicable'
  if (['no registrado', 'n/r'].includes(token)) return 'not_recorded'
  return raw.trim()
}

interface LocatedValue {
  value: string
  confidence: number
  region: SourceRegion | null
  structured?: ReturnType<typeof findBapStructuredValue> | ReturnType<typeof findVestibularStructuredValue>
}

const multilineCodes = new Set(['clinical_exam', 'history', 'symptoms', 'referral_reason', 'conclusion', 'conduct', 'professional_observations'])

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function aliasAtStart(text: string, alias: string) {
  return new RegExp(`^\\s*(?:\\d{1,2}[.)]\\s*)?${escaped(fold(alias))}\\b`, 'iu').test(fold(text))
}

function horizontallyOverlaps(first: SourceRegion, second: SourceRegion) {
  return Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x) > -.015
}

function withoutShortDuplicateLines(page: ExtractedPage) {
  return page.lines.filter((line, index, lines) => !lines.some((candidate, candidateIndex) => {
    if (candidateIndex === index || candidate.text.length <= line.text.length) return false
    const sameBand = Math.abs((candidate.region.y + candidate.region.height / 2) - (line.region.y + line.region.height / 2)) <= Math.max(.018, candidate.region.height, line.region.height)
    if (!sameBand || !horizontallyOverlaps(candidate.region, line.region)) return false
    const shortText = fold(line.text).replace(/\s+/g, ' ').trim()
    const longText = fold(candidate.text).replace(/\s+/g, ' ').trim()
    return longText.includes(shortText) || candidate.text.length >= line.text.length * 1.45 && candidate.confidence >= line.confidence - 15
  })).sort((a, b) => a.region.y - b.region.y || a.region.x - b.region.x)
}

function combinedRegion(lines: ExtractedPage['lines']): SourceRegion | null {
  if (!lines.length) return null
  const x = Math.min(...lines.map((line) => line.region.x))
  const y = Math.min(...lines.map((line) => line.region.y))
  const right = Math.max(...lines.map((line) => line.region.x + line.region.width))
  const bottom = Math.max(...lines.map((line) => line.region.y + line.region.height))
  return { x, y, width: right - x, height: bottom - y }
}

function beginsAnotherField(text: string, definition: ExtractionFieldDefinition) {
  if (definition.code === 'conclusion') {
    return vestibularFieldDefinitions.some((candidate) => ['conduct', 'professional_observations'].includes(candidate.code)
      && candidate.aliases.some((alias) => aliasAtStart(text, alias)))
  }
  return vestibularFieldDefinitions.some((candidate) => candidate.code !== definition.code && candidate.aliases.some((alias) => {
    if (!aliasAtStart(text, alias)) return false
    return new RegExp(`^\\s*(?:\\d{1,2}[.)]\\s*)?${accentTolerantAlias(alias)}\\s*(?::|=|[-–—])`, 'iu').test(text)
  }))
}

function accentTolerantAlias(alias: string) {
  const variants: Record<string, string> = {
    a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]',
  }
  return fold(alias).split('').map((character) => character === ' ' ? '\\s+' : variants[character] ?? escaped(character)).join('')
}

function beforeEmbeddedField(value: string, definition: ExtractionFieldDefinition) {
  let end = value.length
  for (const candidate of vestibularFieldDefinitions) {
    if (candidate.code === definition.code) continue
    for (const alias of candidate.aliases) {
      const pattern = new RegExp(`(?:^|[\\s.;,)])(?:\\d{1,2}[.)]\\s*)?${accentTolerantAlias(alias)}\\s*(?::|=)`, 'iu')
      const match = pattern.exec(value)
      if (match?.index !== undefined) end = Math.min(end, match.index)
    }
  }
  return value.slice(0, end).replace(/[\s,\-–—]+$/, '').trim()
}

function multilineCandidate(definition: ExtractionFieldDefinition, lines: ExtractedPage['lines']): { located: LocatedValue; rank: number } | null {
  const conductFallback = (text: string) => definition.code === 'conduct' && /\brehabilitaci[oó]n\s+vestibular\b/iu.test(text)
  const anchorIndex = lines.findIndex((line) => definition.aliases.some((alias) => aliasAtStart(line.text, alias) || definition.code === 'clinical_exam' && fold(line.text).includes(fold(alias))) || conductFallback(line.text))
  if (anchorIndex < 0) return null
  const anchor = lines[anchorIndex]
  const alias = definition.aliases.find((candidate) => aliasAtStart(anchor.text, candidate) || definition.code === 'clinical_exam' && fold(anchor.text).includes(fold(candidate)))
  if (!alias && !conductFallback(anchor.text)) return null
  const selected = [anchor]
  // En informes narrativos, "Se realizo examen clinico..." es una frase y no
  // una etiqueta. Se conserva completa para no devolver solo su cola.
  const startsWithLabel = alias ? aliasAtStart(anchor.text, alias) : false
  const fallbackValue = anchor.text.replace(/^\s*[a-z]{0,8}cta\s*:\s*/iu, '').trim()
  const parts = [alias && startsWithLabel ? lineValue(anchor.text, alias) : alias ? anchor.text.trim() : fallbackValue].filter(Boolean)
  let previous = anchor
  for (const line of lines.slice(anchorIndex + 1)) {
    const verticalGap = line.region.y - (previous.region.y + previous.region.height)
    if (line.region.y - anchor.region.y > .16 || verticalGap > .035) break
    if (/^\s*\d{1,2}[.)]\s+/.test(line.text) || beginsAnotherField(line.text, definition) || /^(?:prof(?:esional)?\.?|dr\.?|dra\.?|firma)\b/i.test(fold(line.text))) break
    parts.push(line.text.trim())
    selected.push(line)
    previous = line
  }
  if (definition.code === 'conclusion') {
    const explicitVorSentence = lines.slice(anchorIndex + 1).find((line) => (
      line.region.y - anchor.region.y <= .22
      && /^\s*cancelaci[oó]n\s+del\s+vor\b/iu.test(line.text)
      && !selected.includes(line)
    ))
    if (explicitVorSentence) {
      parts.push(explicitVorSentence.text.trim())
      selected.push(explicitVorSentence)
    }
  }
  const joinedValue = beforeEmbeddedField(parts.join(' ').replace(/\s+/g, ' ').trim(), definition)
  const value = definition.code === 'conclusion' || definition.code === 'conduct'
    ? sanitizeVestibularNarrative(joinedValue, definition.code)
    : deduplicateOcrSentences(joinedValue)
  if (!value) return null
  const confidence = Math.min(...selected.map((line) => line.confidence / 100))
  const expectedRegion = ['conclusion', 'conduct'].includes(definition.code) ? 'report_summary' : 'clinical_body'
  const regionBonus = anchor.regionId === expectedRegion ? .12 : anchor.regionId === 'full_page' ? 0 : .04
  const informativeWords = new Set(fold(value).match(/[a-z0-9]{3,}/g) ?? []).size
  const completenessBonus = Math.min(informativeWords, 45) * .012 + Math.min(value.length, 500) / 5000
  return { located: { value, confidence, region: combinedRegion(selected) }, rank: confidence * .72 + regionBonus + completenessBonus }
}

function inlineNarrativeCandidate(definition: ExtractionFieldDefinition, lines: ExtractedPage['lines']): LocatedValue | null {
  if (!['referral_reason', 'symptoms'].includes(definition.code)) return null
  const candidates: Array<{ located: LocatedValue; rank: number }> = []
  for (let anchorIndex = 0; anchorIndex < lines.length; anchorIndex += 1) {
    const anchor = lines[anchorIndex]
    const pattern = definition.code === 'referral_reason'
      ? /\bmc\s*(?:[:.=\-–—]\s*|\s+)(.*)$/iu
      : /\b((?:no|sin)\s+)?s[ií]ntomas?\b\s*(?:[:.=\-–—]\s*|\s+)?(.*)$/iu
    const match = pattern.exec(anchor.text)
    if (!match) continue
    const selected = [anchor]
    const firstPart = definition.code === 'referral_reason'
      ? match[1]?.trim() ?? ''
      : `${match[1] ?? ''}síntomas${match[2]?.trim() ? ` ${match[2].trim()}` : ''}`.trim()
    const parts = [firstPart].filter(Boolean)
    let previous = anchor
    for (const line of lines.slice(anchorIndex + 1)) {
      const verticalGap = line.region.y - (previous.region.y + previous.region.height)
      if (line.region.y - anchor.region.y > .16 || verticalGap > .035) break
      if (/^\s*\d{1,2}[.)]\s+/.test(line.text) || beginsAnotherField(line.text, definition)) break
      parts.push(line.text.trim())
      selected.push(line)
      previous = line
    }
    const value = deduplicateOcrSentences(beforeEmbeddedField(parts.join(' ').replace(/\s+/g, ' ').trim(), definition))
    if (!value) continue
    const confidence = Math.min(...selected.map((line) => line.confidence / 100))
    const informativeWords = new Set(fold(value).match(/[a-z0-9]{3,}/g) ?? []).size
    candidates.push({ located: { value, confidence, region: combinedRegion(selected) }, rank: confidence * .72 + Math.min(informativeWords, 35) * .014 + Math.min(value.length, 400) / 5000 })
  }
  return candidates.sort((first, second) => second.rank - first.rank)[0]?.located ?? null
}

function multilineValue(definition: ExtractionFieldDefinition, page: ExtractedPage): LocatedValue | null {
  if (!multilineCodes.has(definition.code)) return null
  const lines = withoutShortDuplicateLines(page)
  const groups = new Map<string, ExtractedPage['lines']>()
  for (const line of lines) {
    const key = line.passId ?? 'unscoped'
    groups.set(key, [...(groups.get(key) ?? []), line])
  }
  return [...groups.values()]
    .map((group) => multilineCandidate(definition, group))
    .filter((candidate): candidate is NonNullable<ReturnType<typeof multilineCandidate>> => Boolean(candidate))
    .sort((first, second) => second.rank - first.rank)[0]?.located ?? null
}

function normalizedVestibularText(definition: ExtractionFieldDefinition, value: string) {
  if (definition.code !== 'fixation_system') return value.trim()
  return value.replace(/\b(sf\s+a\s*30)\s*%/iu, '$1°').trim()
}

function suspiciousNarrativeEnding(definition: ExtractionFieldDefinition, value: string) {
  if (!['history', 'symptoms', 'referral_reason', 'conclusion', 'conduct'].includes(definition.code)) return false
  const source = fold(value).trim()
  return /(?:[,;:]|\b(?:de\s+una?|de\s+un|para\s+la|para\s+el|con|sin|no|y|o|que))$/u.test(source)
}

function inferredDocumentType(definition: ExtractionFieldDefinition, page: ExtractedPage): LocatedValue | null {
  if (definition.code !== 'document_type') return null
  const labels: Partial<Record<PageClassification, string>> = {
    vestibular_report: 'Informe vestibular / vHIT',
    vhit_graph: 'Gr\u00e1ficos vHIT u oculomotores',
    referral: 'Orden o derivaci\u00f3n',
    other_clinical: 'Otro documento cl\u00ednico',
  }
  const value = labels[page.classification]
  return value ? { value, confidence: Math.min(.79, page.classificationConfidence), region: null } : null
}

function structuredVhitValue(definition: ExtractionFieldDefinition, page: ExtractedPage): LocatedValue | null {
  if (!['vestibular_report', 'vhit_graph'].includes(page.classification)) return null
  const source = fold(page.text).replace(/\s+/g, ' ')
  const numeric = '[0-2](?:[.,][0-9]{1,3})?'
  const patterns: Partial<Record<string, RegExp>> = {
    gain_right: new RegExp(`(?:(?:ganancia|gain|regresion)\\s*(?:derecha|right|od)|g\\.?\\s*od)\\s*[:=]?\\s*(${numeric})`, 'i'),
    gain_left: new RegExp(`(?:ganancia|gain|regresion)?\\s*(?:izquierda|left|oi)\\s*[:=]\\s*(${numeric})`, 'i'),
    symmetry: /(?:simetria|asimetria)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?\s*%?(?:\s*[a-z]{1,12})?)/i,
    impulse_counts: /(?:impulse\s*(?:nr|number)|numero\s+de\s+impulsos|cantidad\s+de\s+impulsos)\s*[:=]?\s*([0-9]+(?:\s*[/|-]\s*[0-9]+|\s+[0-9]+)?)/i,
    head_velocity: /(?:head\s+velocity|velocidad\s+(?:cefalica|de\s+cabeza))\s*[:=]?\s*([^.;]{1,45})/i,
  }
  const match = patterns[definition.code]?.exec(source)
  if (match?.[1]) return { value: match[1].trim(), confidence: Math.min(.84, Math.max(.7, page.classificationConfidence)), region: null }
  if (definition.code === 'gain_method') {
    if (/regresion/.test(source)) return { value: 'Regresión', confidence: .76, region: null }
    const windows = [...source.matchAll(/\b(?:40|60|80)\s*ms\b/g)].map((item) => item[0])
    if (windows.length) return { value: [...new Set(windows)].join(' · '), confidence: .72, region: null }
  }
  return null
}

function numericFragments(page: ExtractedPage) {
  return page.lines.flatMap((line) => [...line.text.matchAll(/[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)\s*%?/g)].flatMap((match) => {
    if (match.index === undefined) return []
    const value = match[0].trim()
    const normalized = parseLocaleNumber(value)
    if (normalized === null) return []
    const characterWidth = line.region.width / Math.max(1, line.text.length)
    return [{
      raw: value,
      value: normalized,
      confidence: line.confidence / 100,
      region: {
        x: line.region.x + characterWidth * match.index,
        y: line.region.y,
        width: Math.max(.008, characterWidth * value.length),
        height: line.region.height,
      },
    }]
  }))
}

function valuesByHorizontalPosition(page: ExtractedPage, bounds: SourceRegion) {
  const candidates = numericFragments(page)
    .filter((item) => item.value >= 0 && item.value <= 100 && item.region.x >= bounds.x && item.region.x <= bounds.x + bounds.width && item.region.y >= bounds.y && item.region.y <= bounds.y + bounds.height)
    .sort((a, b) => a.region.x - b.region.x || a.region.y - b.region.y)
  const columns: typeof candidates[] = []
  for (const candidate of candidates) {
    const column = columns.find((items) => Math.abs(items[0].region.x - candidate.region.x) < .025)
    if (column) column.push(candidate)
    else columns.push([candidate])
  }
  return columns.map((items) => {
    const top = Math.min(...items.map((item) => item.region.y))
    // Dos pasadas pueden devolver "7" y "73" para la misma etiqueta. Dentro
    // de la misma banda visual se conserva la lectura más completa y confiable;
    // los números del eje, que están bastante más abajo, siguen excluidos.
    return items
      .filter((item) => item.region.y - top < .018)
      .sort((a, b) => b.raw.replace(/\D/g, '').length - a.raw.replace(/\D/g, '').length || b.confidence - a.confidence)[0]
  }).sort((a, b) => a.region.x - b.region.x)
}

function bapAnchor(page: ExtractedPage, kind: 'conditions' | 'sensory') {
  return page.lines.find((line) => {
    const text = fold(line.text)
    return kind === 'conditions'
      ? /(?:porcent|porc).*(?:condi|condl)/.test(text) || /(?:condi|condl).*(?:porcent|porc)/.test(text)
      : /organi[sz].*sensor/.test(text) || /sensor.*organi[sz]/.test(text)
  })
}

function bapGraphBounds(page: ExtractedPage, kind: 'conditions' | 'sensory'): SourceRegion {
  const conditions = bapAnchor(page, 'conditions')
  const sensory = bapAnchor(page, 'sensory')
  if (kind === 'conditions' && conditions) {
    const bottom = sensory ? sensory.region.y - .008 : Math.min(.61, conditions.region.y + .34)
    return {
      x: Math.max(.62, conditions.region.x - .07),
      y: Math.max(.08, conditions.region.y + conditions.region.height * .7),
      width: 1 - Math.max(.62, conditions.region.x - .07),
      height: Math.max(.12, bottom - (conditions.region.y + conditions.region.height * .7)),
    }
  }
  if (kind === 'sensory' && sensory) {
    const x = Math.max(.62, sensory.region.x - .07)
    const y = sensory.region.y + sensory.region.height * .7
    return { x, y, width: 1 - x, height: Math.max(.12, .94 - y) }
  }
  // Respaldo para capturas BAP 2.32 donde el encabezado quedó ilegible.
  return kind === 'conditions'
    ? { x: .68, y: .11, width: .32, height: .48 }
    : { x: .68, y: .55, width: .32, height: .39 }
}

function positionalBapValue(definition: ExtractionFieldDefinition, page: ExtractedPage): LocatedValue | null {
  if (page.classification !== 'posturography') return null
  const dateLine = page.lines.find((line) => line.region.y > .78 && /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(line.text))
  if (definition.code === 'study_date' && dateLine) {
    return { value: dateLine.text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0] ?? '', confidence: dateLine.confidence / 100, region: dateLine.region }
  }
  if (definition.code === 'study_status') {
    const statusLine = page.lines.find((line) => /\b(?:finalizad[ao]|completad[ao]|pendiente)\b/i.test(fold(line.text)))
    if (statusLine) return { value: statusLine.text.trim(), confidence: statusLine.confidence / 100, region: statusLine.region }
  }

  const conditionIndex = definition.code.match(/^condition_([1-6])$/)?.[1]
  if (conditionIndex) {
    // En los informes BAP los valores se ubican arriba de las barras; las
    // condiciones con mejor puntaje quedan muy cerca del encabezado del gráfico.
    // El eje vertical está a la izquierda de x=.70; excluirlo evita contar
    // sus marcas 100/80/60 como si fueran condiciones.
    const values = valuesByHorizontalPosition(page, bapGraphBounds(page, 'conditions'))
    const candidate = values[Number(conditionIndex) - 1]
    if (candidate) return { value: candidate.raw, confidence: Math.min(candidate.confidence, .72), region: candidate.region }
  }
  if (definition.code === 'composite_score') {
    const values = valuesByHorizontalPosition(page, bapGraphBounds(page, 'conditions'))
    const candidate = values[6]
    if (candidate) return { value: candidate.raw, confidence: Math.min(candidate.confidence, .72), region: candidate.region }
  }

  const sensoryCodes = ['sensory_somatosensory', 'sensory_visual', 'sensory_vestibular', 'visual_preference']
  const sensoryIndex = sensoryCodes.indexOf(definition.code)
  if (sensoryIndex >= 0) {
    const values = valuesByHorizontalPosition(page, bapGraphBounds(page, 'sensory'))
    const candidate = values[sensoryIndex]
    if (candidate) return { value: candidate.raw, confidence: Math.min(candidate.confidence, .68), region: candidate.region }
  }
  return null
}

function hasBapChartLayout(page: ExtractedPage) {
  const text = fold(page.text)
  // La aplicación BAP 2.32 imprime "PORCENT. DE CONDICIONES". El OCR puede
  // expandirlo a "porcentaje" o preservar la abreviatura, por lo que ambos
  // formatos son evidencia válida del panel de barras.
  const hasConditions = Boolean(bapAnchor(page, 'conditions')) || /\bporcent(?:aje)?\.?\s+(?:de\s+)?condiciones\b/.test(text)
  const hasSensory = Boolean(bapAnchor(page, 'sensory')) || /organi[sz]acion\s+sensorial/.test(text)
  return hasConditions && hasSensory
}

function findDefinitionValue(definition: ExtractionFieldDefinition, page: ExtractedPage): LocatedValue | null {
  if (definition.studyType === 'posturography' && page.classification === 'posturography' && page.template?.type === 'bap_2_32') {
    const structured = findBapStructuredValue(definition.code, page)
    if (structured) return { value: structured.raw, confidence: structured.confidence, region: structured.region, structured }
  }
  if (definition.studyType === 'vhit') {
    const structured = findVestibularStructuredValue(definition.code, page)
    if (structured) {
      const bounded = beforeEmbeddedField(structured.raw, definition)
      const cleanedStructured = bounded && bounded !== structured.raw && typeof structured.value === 'string'
        ? { ...structured, raw: bounded, value: bounded, displayValue: bounded }
        : structured
      return { value: cleanedStructured.raw, confidence: cleanedStructured.confidence, region: cleanedStructured.region, structured: cleanedStructured }
    }
  }
  const isBapGraphValue = /^condition_[1-6]$/.test(definition.code) || definition.code === 'composite_score' || ['sensory_somatosensory', 'sensory_visual', 'sensory_vestibular', 'visual_preference'].includes(definition.code)
  // Sólo se aplican coordenadas de las barras si el OCR reconoce ambos paneles
  // BAP. Esto evita que un documento de texto con "Condición 1" se lea como gráfico.
  if (isBapGraphValue && hasBapChartLayout(page)) {
    const positional = positionalBapValue(definition, page)
    if (positional) return positional
  }
  const vhit = structuredVhitValue(definition, page)
  if (vhit) return vhit
  const block = multilineValue(definition, page)
  if (block) return block
  const inlineNarrative = inlineNarrativeCandidate(definition, withoutShortDuplicateLines(page))
  if (inlineNarrative) return inlineNarrative
  for (const line of page.lines) {
    for (const alias of definition.aliases) {
      const value = lineValue(line.text, alias)
      const bounded = beforeEmbeddedField(value, definition)
      if (bounded) return { value: compactCandidate(definition, bounded), confidence: line.confidence / 100, region: line.region }
    }
  }
  for (const textLine of page.text.split(/\r?\n/)) {
    for (const alias of definition.aliases) {
      const value = lineValue(textLine, alias)
      const bounded = beforeEmbeddedField(value, definition)
      if (bounded) return { value: compactCandidate(definition, bounded), confidence: page.classificationConfidence * .95, region: null }
    }
  }
  for (const alias of definition.aliases) {
    const value = lineValue(page.text, alias)
    const bounded = beforeEmbeddedField(value, definition)
    if (bounded) return { value: compactCandidate(definition, bounded), confidence: page.classificationConfidence * .8, region: null }
  }
  return positionalBapValue(definition, page) ?? inferredDocumentType(definition, page)
}

export function extractFields(pages: ExtractedPage[], intakeKind: IntakeKind): ExtractedField[] {
  const definitions = intakeKind === 'posturography_bap' ? posturographyFieldDefinitions : [...vestibularFieldDefinitions, ...posturographyFieldDefinitions]
  const fields = definitions.map((definition): ExtractedField => {
    const relevantPages = pages.filter((page) => definition.studyType === 'posturography' ? page.classification === 'posturography' : ['vestibular_report', 'vhit_graph', 'referral', 'other_clinical'].includes(page.classification))
    const found = relevantPages.map((page) => ({ page, found: findDefinitionValue(definition, page) }))
      .filter((candidate): candidate is { page: ExtractedPage; found: NonNullable<ReturnType<typeof findDefinitionValue>> } => Boolean(candidate.found))
      .sort((first, second) => second.found.confidence - first.found.confidence)[0]
    const value = found?.found?.value ?? ''
    const confidence = found?.found?.confidence ?? 0
    const structured = found?.found?.structured
    const reviewedValue = definition.studyType === 'vhit' ? normalizedVestibularText(definition, value) : value
    const normalized = structured ? structured.value === null ? '' : String(structured.value) : normalizedValue(reviewedValue)
    const semanticValue = structured?.value ?? (normalized && Number.isFinite(Number(normalized)) ? Number(normalized) : normalized || null)
    const automaticTextCorrection = Boolean(value && reviewedValue !== value)
    const suspiciousEnding = suspiciousNarrativeEnding(definition, reviewedValue)
    const status = suspiciousEnding ? 'needs_review' : structured?.status ?? (!value ? 'not_reported' : confidence >= .82 ? 'detected' : 'needs_review')
    const warnings = [
      ...(structured?.warnings ?? (!value && definition.required ? ['El parámetro obligatorio no fue informado o no pudo leerse.'] : [])),
      ...(automaticTextCorrection ? ['Se corrigió una confusión tipográfica inequívoca del OCR; verificá el símbolo contra el original.'] : []),
      ...(suspiciousEnding ? ['La lectura termina en una frase incompleta; revisá el recorte antes de confirmar.'] : []),
    ]
    return {
      clientId: crypto.randomUUID(), code: definition.code, label: definition.label, group: definition.group,
      studyType: definition.studyType, required: Boolean(definition.required), metricCode: definition.metricCode ?? '',
      rawValue: value, normalizedValue: normalized, unitCode: definition.unitCode ?? '', conditionCode: definition.conditionCode ?? '', side: definition.side ?? '',
      pageNumber: found?.page.pageNumber ?? (relevantPages[0]?.pageNumber ?? 1), region: found?.found?.region as SourceRegion | null ?? null,
      confidence, status, extractorMethod: 'local_ocr' as const,
      extractorVersion: EXTRACTOR_VERSION, professionalValue: structured?.displayValue ?? reviewedValue, confirmed: false,
      value: semanticValue,
      displayValue: structured?.displayValue ?? reviewedValue,
      warnings,
      validation: structured?.validation ?? { rangeValid: null, crossCheckValid: null, multiPassAgreement: null },
      source: { page: found?.page.pageNumber ?? (relevantPages[0]?.pageNumber ?? 1), regionId: structured?.regionId ?? 'generic_page', normalizedBbox: found?.found?.region ?? null, method: structured?.method ?? 'ocr_original' },
      candidates: structured?.candidates ?? (value ? [{ raw: value, value: semanticValue, confidence, method: 'ocr_original' }] : []),
      correctionHistory: [],
    }
  })
  return intakeKind === 'posturography_bap' ? validateBapFields(fields) : validateVestibularFields(fields, pages)
}

export interface PatientIdentityForMatch { fullName: string; birthDate: string; affiliateNumber: string; insurer?: string }

export function comparePatientIdentity(pages: ExtractedPage[], patient: PatientIdentityForMatch): { status: PatientMatchStatus; mismatchFields: string[] } {
  const text = fold(pages.map((page) => page.text).join('\n'))
  const mismatches: string[] = []
  const normalizedName = fold(patient.fullName).replace(/\s+/g, ' ').trim()
  const nameWords = normalizedName.split(' ').filter((word) => word.length > 2)
  const documentHasIdentity = /(?:paciente|nombre|fecha de nacimiento|cedula|afiliad)/.test(text)
  if (!documentHasIdentity) return { status: 'not_checked', mismatchFields: [] }
  if (nameWords.length && nameWords.filter((word) => text.includes(word)).length < Math.min(2, nameWords.length)) mismatches.push('name')
  if (patient.birthDate) {
    const [year, month, day] = patient.birthDate.split('-')
    const variants = [`${day}/${month}/${year}`, `${day}-${month}-${year}`, patient.birthDate]
    if (/fecha de nacimiento|nacimiento/.test(text) && !variants.some((value) => text.includes(value))) mismatches.push('birth_date')
  }
  if (patient.affiliateNumber && /afiliad/.test(text) && !text.includes(fold(patient.affiliateNumber))) mismatches.push('affiliate_number')
  if (patient.insurer && /(?:mutualista|aseguradora|seguro de salud)/.test(text) && !text.includes(fold(patient.insurer))) mismatches.push('insurer')
  return { status: mismatches.length ? 'mismatch' : 'match', mismatchFields: mismatches }
}
