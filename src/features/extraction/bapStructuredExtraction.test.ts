import { describe, expect, it } from 'vitest'
import { detectBapTemplate } from './bapOcrProfile'
import { extractFields } from './extractor'
import { deriveFieldCounters } from './fieldResults'
import type { ExtractedPage, OcrLine } from './types'

function bapPage(lines: OcrLine[]): ExtractedPage {
  const text = ['bAp', 'ESTABILOGRAMA', 'PORCENT. DE CONDICIONES', 'TEST DE ORGANIZACION SENSORIAL', ...lines.map((line) => line.text)].join('\n')
  return { pageNumber: 1, proposedClassification: 'posturography', classification: 'posturography', classificationConfidence: .96, rotationDegrees: 0, width: 1100, height: 768, previewUrl: '', text, lines, template: { type: 'bap_2_32', confidence: .96, matchedSignals: 4, aspectRatio: 1100 / 768 } }
}

describe('contrato BAP estructurado', () => {
  it('detecta la plantilla por evidencia combinada y tolera su relación de aspecto real', () => {
    expect(detectBapTemplate('bAp ESTABILOGRAMA PORCENT. DE CONDICIONES TEST DE ORGANIZACION SENSORIAL', 1100, 768)).toMatchObject({ detected: true, matchedSignals: 4 })
    expect(detectBapTemplate('informe clínico narrativo', 1100, 768).detected).toBe(false)
  })

  it('normaliza edad, porcentaje, fecha, signos e inválidos preservando raw', () => {
    const fields = extractFields([bapPage([
      { text: '73', confidence: 92, region: { x: .492, y: .877, width: .02, height: .02 }, regionId: 'age_high_priority', method: 'ocr_original' },
      { text: '26,0 %', confidence: 91, region: { x: .145, y: .423, width: .05, height: .02 }, regionId: 'aphysiological_pattern_high_priority', method: 'ocr_original' },
      { text: '19/8/2026', confidence: 90, region: { x: .59, y: .875, width: .08, height: .02 }, regionId: 'study_datetime_high_priority', method: 'ocr_original' },
      { text: '-01,05', confidence: 91, region: { x: .077, y: .218, width: .05, height: .02 }, regionId: 'directional_metrics', method: 'ocr_threshold' },
      { text: 'E', confidence: 42, region: { x: .15, y: .63, width: .03, height: .02 }, regionId: 'pppd_high_priority', method: 'ocr_original' },
    ])], 'posturography_bap')
    const byCode = new Map(fields.map((field) => [field.code, field]))
    expect(byCode.get('reported_age')).toMatchObject({ rawValue: '73', value: 73, status: 'detected' })
    expect(byCode.get('afis_pattern')).toMatchObject({ rawValue: '26,0 %', value: 26 })
    expect(byCode.get('study_date')).toMatchObject({ rawValue: '19/8/2026', value: '2026-08-19' })
    expect(byCode.get('los_forward')).toMatchObject({ rawValue: '-01,05', value: -1.05 })
    expect(byCode.get('pppd_index')).toMatchObject({ rawValue: '∞ %', value: null, status: 'invalid', professionalValue: 'No calculable' })
  })

  it('deriva todos los contadores de la misma colección de FieldResult', () => {
    const fields = extractFields([bapPage([
      { text: '73', confidence: 92, region: { x: .492, y: .877, width: .02, height: .02 } },
      { text: '0,000', confidence: 94, region: { x: .04, y: .814, width: .04, height: .02 } },
      { text: '0,000', confidence: 94, region: { x: .113, y: .814, width: .04, height: .02 } },
    ])], 'posturography_bap')
    const counters = deriveFieldCounters(fields)
    expect(counters.total).toBe(fields.length)
    expect(counters.notPerformed).toBe(2)
    expect(counters.detected).toBeGreaterThanOrEqual(1)
    expect(counters.missingRequired).toBeGreaterThan(0)
  })
})
