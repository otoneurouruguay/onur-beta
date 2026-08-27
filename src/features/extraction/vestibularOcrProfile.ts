import type { ExtractionTemplateType, SourceRegion } from './types'

export type VestibularPreprocessMode = 'original' | 'grayscale' | 'dark_text'
export type VestibularPsm = 'single_block' | 'sparse_text'

export interface VestibularRecognitionRegion {
  id: 'document_header' | 'clinical_body' | 'report_summary' | 'vhit_header' | 'vhit_metrics' | 'vhit_quality'
  bbox: SourceRegion
  scales: number[]
  modes: VestibularPreprocessMode[]
  psm: VestibularPsm
}

export const vestibularReportRecognitionProfile: VestibularRecognitionRegion[] = [
  { id: 'document_header', bbox: { x: .05, y: .04, width: .90, height: .22 }, scales: [2, 3], modes: ['original', 'grayscale'], psm: 'single_block' },
  { id: 'clinical_body', bbox: { x: .06, y: .18, width: .88, height: .48 }, scales: [2, 3], modes: ['original', 'dark_text'], psm: 'single_block' },
  { id: 'report_summary', bbox: { x: .06, y: .60, width: .88, height: .30 }, scales: [2, 3], modes: ['original', 'dark_text'], psm: 'single_block' },
]

export const vhitRecognitionProfile: VestibularRecognitionRegion[] = [
  { id: 'vhit_header', bbox: { x: .03, y: .03, width: .94, height: .25 }, scales: [2, 3], modes: ['original', 'grayscale'], psm: 'sparse_text' },
  { id: 'vhit_metrics', bbox: { x: .03, y: .12, width: .94, height: .56 }, scales: [2, 3], modes: ['original', 'dark_text'], psm: 'sparse_text' },
  { id: 'vhit_quality', bbox: { x: .03, y: .62, width: .94, height: .33 }, scales: [2], modes: ['dark_text'], psm: 'single_block' },
]

function fold(value: string) {
  return value.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function detectVestibularTemplate(text: string, width: number, height: number): { type: ExtractionTemplateType; detected: boolean; confidence: number; matchedSignals: number; aspectRatio: number } {
  const source = fold(text)
  const aspectRatio = width / Math.max(1, height)
  const vhitSignals = [
    /\bvhit\b|video\s*head\s*impulse/,
    /\bhimp\b|\bshimp\b/,
    /ganancia|\bgain\b|g\.?\s*regresion/,
    /sacadas?|saccades?|overt|covert/,
    /canal(?:es)?|cull|ralp|larp|horizontal|lateral/,
    /impulse\s*(?:nr|number)|impulsos?|head\s*velocity|velocidad\s*cefalica/,
  ].filter((pattern) => pattern.test(source)).length
  const reportSignals = [
    /informe\s+(?:clinico\s+)?vestibular|informe\s+otoneurolog/,
    /examen\s+clinico|antecedentes|motivo\s+de\s+derivacion/,
    /supresion\s+visual|head\s+shaking|pruebas\s+posicionales|\bskew\b/,
    /en\s+suma|conclusion/,
    /conducta|observaciones/,
  ].filter((pattern) => pattern.test(source)).length

  const narrativePage = reportSignals >= 3 && aspectRatio < 1
  if (narrativePage) return { type: 'vestibular_report', detected: true, confidence: Math.min(.97, .63 + reportSignals * .06), matchedSignals: reportSignals, aspectRatio }
  const compactVhitGraph = /\bvhit\b/.test(source) && /ganancia|\bgain\b|regresion/.test(source) && aspectRatio >= 1.1
  if ((vhitSignals >= 3 || compactVhitGraph) && vhitSignals >= reportSignals) return { type: 'vhit_labeled', detected: true, confidence: Math.min(.98, .62 + vhitSignals * .055), matchedSignals: vhitSignals, aspectRatio }
  if (reportSignals >= 2) return { type: 'vestibular_report', detected: true, confidence: Math.min(.97, .63 + reportSignals * .06), matchedSignals: reportSignals, aspectRatio }
  return { type: 'generic', detected: false, confidence: Math.max(vhitSignals, reportSignals) * .12, matchedSignals: Math.max(vhitSignals, reportSignals), aspectRatio }
}

export function expandedVestibularRegion(region: SourceRegion, marginRatio = .025): SourceRegion {
  const marginX = region.width * marginRatio
  const marginY = region.height * marginRatio
  const x = Math.max(0, region.x - marginX)
  const y = Math.max(0, region.y - marginY)
  return { x, y, width: Math.min(1 - x, region.width + marginX * 2), height: Math.min(1 - y, region.height + marginY * 2) }
}
