import type { SourceRegion } from './types'

export type BapRegionId =
  | 'conditions_top'
  | 'directional_metrics'
  | 'sway_metrics'
  | 'left_indices'
  | 'condition_scores_chart'
  | 'condition_values_high_priority'
  | 'sensory_chart'
  | 'sensory_values_high_priority'
  | 'sensory_contribution'
  | 'patient_identity'
  | 'age_high_priority'
  | 'study_datetime_high_priority'
  | 'aphysiological_pattern_high_priority'
  | 'pppd_high_priority'
  | 'sway_x_high_priority'
  | 'sway_y_high_priority'

export type BapPreprocessMode = 'original' | 'grayscale' | 'dark_text' | 'dark_text_low' | 'light_text'

export interface BapRecognitionRegion {
  id: BapRegionId
  bbox: SourceRegion
  psm: 'sparse' | 'block' | 'line'
  scales: readonly number[]
  modes: readonly BapPreprocessMode[]
}

/** Coordenadas respecto de la imagen original, nunca de la miniatura CSS. */
export const bapRecognitionProfile: readonly BapRecognitionRegion[] = [
  { id: 'conditions_top', bbox: { x: .22, y: 0, width: .47, height: .22 }, psm: 'sparse', scales: [2, 3], modes: ['original', 'dark_text'] },
  { id: 'directional_metrics', bbox: { x: 0, y: .20, width: .23, height: .13 }, psm: 'block', scales: [3, 4], modes: ['grayscale'] },
  { id: 'sway_metrics', bbox: { x: 0, y: .31, width: .23, height: .12 }, psm: 'block', scales: [3, 4], modes: ['grayscale'] },
  { id: 'left_indices', bbox: { x: 0, y: .40, width: .23, height: .31 }, psm: 'block', scales: [3, 4], modes: ['dark_text', 'light_text'] },
  { id: 'condition_scores_chart', bbox: { x: .68, y: .19, width: .31, height: .35 }, psm: 'sparse', scales: [2, 3, 4], modes: ['original', 'dark_text_low', 'dark_text'] },
  { id: 'condition_values_high_priority', bbox: { x: .72, y: .235, width: .255, height: .08 }, psm: 'sparse', scales: [4], modes: ['original', 'dark_text_low', 'dark_text'] },
  { id: 'sensory_chart', bbox: { x: .70, y: .54, width: .29, height: .34 }, psm: 'sparse', scales: [2, 3], modes: ['original', 'dark_text'] },
  { id: 'sensory_values_high_priority', bbox: { x: .72, y: .545, width: .25, height: .08 }, psm: 'sparse', scales: [4], modes: ['original', 'dark_text'] },
  { id: 'sensory_contribution', bbox: { x: .70, y: 0, width: .29, height: .22 }, psm: 'sparse', scales: [2, 3], modes: ['original', 'dark_text'] },
  { id: 'patient_identity', bbox: { x: .22, y: .84, width: .50, height: .14 }, psm: 'block', scales: [3, 4], modes: ['original', 'dark_text'] },
  { id: 'age_high_priority', bbox: { x: .43, y: .85, width: .13, height: .07 }, psm: 'line', scales: [4], modes: ['original', 'dark_text'] },
  { id: 'study_datetime_high_priority', bbox: { x: .545, y: .84, width: .15, height: .10 }, psm: 'block', scales: [4], modes: ['original', 'dark_text'] },
  { id: 'aphysiological_pattern_high_priority', bbox: { x: .005, y: .405, width: .22, height: .075 }, psm: 'line', scales: [4], modes: ['original', 'dark_text'] },
  { id: 'pppd_high_priority', bbox: { x: .135, y: .61, width: .075, height: .065 }, psm: 'line', scales: [4], modes: ['original', 'dark_text'] },
  { id: 'sway_x_high_priority', bbox: { x: .083, y: .307, width: .045, height: .055 }, psm: 'line', scales: [4], modes: ['dark_text'] },
  { id: 'sway_y_high_priority', bbox: { x: .083, y: .347, width: .045, height: .055 }, psm: 'line', scales: [4], modes: ['dark_text'] },
] as const

// Perfil amplio histórico que conserva la regresión de layouts sintéticos
// previos; el navegador usa el perfil tipado y más preciso de arriba.
export const bapRecognitionRegions: SourceRegion[] = [
  { x: 0, y: .16, width: .31, height: .62 },
  { x: .63, y: .06, width: .37, height: .86 },
  { x: .34, y: .82, width: .66, height: .18 },
]

export function expandedBapRegion(region: SourceRegion, margin = .03): SourceRegion {
  const marginX = region.width * margin
  const marginY = region.height * margin
  const x = Math.max(0, region.x - marginX)
  const y = Math.max(0, region.y - marginY)
  const right = Math.min(1, region.x + region.width + marginX)
  const bottom = Math.min(1, region.y + region.height + marginY)
  return { x, y, width: right - x, height: bottom - y }
}

export function detectBapTemplate(text: string, width: number, height: number) {
  const source = text.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
  const signals = [
    /\bbap\b|balance angular posturography/,
    /estabilograma/,
    /test de organi[sz]acion sensorial|organi[sz].{0,12}sensorial/,
    /porcent(?:aje)?\.? de condiciones|porcent.{0,8}condiciones/,
  ]
  const matchedSignals = signals.filter((signal) => signal.test(source)).length
  const aspectRatio = height > 0 ? width / height : 0
  const aspectMatch = aspectRatio >= 1.25 && aspectRatio <= 1.75
  const confidence = Math.min(.99, matchedSignals * .22 + (aspectMatch ? .12 : 0))
  return { detected: matchedSignals >= 2 && aspectMatch, confidence, matchedSignals, aspectRatio }
}

export function binarizeBapDarkText(data: Uint8ClampedArray, threshold = 145) {
  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114
    const value = luminance < threshold ? 0 : 255
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
  }
}

export function binarizeBapLightText(data: Uint8ClampedArray, threshold = 170) {
  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114
    const value = luminance > threshold ? 0 : 255
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
  }
}
