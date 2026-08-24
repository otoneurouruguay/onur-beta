import { describe, expect, it } from 'vitest'
import { extractFields } from './extractor'
import type { ExtractedPage, OcrLine, PageClassification } from './types'

function page(lines: OcrLine[], classification: PageClassification, template: ExtractedPage['template']): ExtractedPage {
  return { pageNumber: 1, proposedClassification: classification, classification, classificationConfidence: .94, rotationDegrees: 0, width: 1400, height: 900, previewUrl: '', text: lines.map((line) => line.text).join('\n'), lines, template }
}

function line(text: string, y: number, passId = 'full-original', confidence = 92): OcrLine {
  return { text, confidence, region: { x: .08, y, width: .82, height: .035 }, regionId: passId.startsWith('full') ? 'full_page' : 'vhit_metrics', method: passId.includes('threshold') ? 'ocr_threshold' : 'ocr_original', passId }
}

describe('extracción vestibular estructurada', () => {
  it('normaliza vHIT rotulado, conserva evidencia y activa requisitos del protocolo', () => {
    const lines = [
      line('Fecha del estudio: 17/07/2026 Paciente: CASO SINTETICO Edad: 61 ID: TEST-001', .05),
      line('vHIT HIMP: realizado. Canales evaluados: horizontal derecho e izquierdo.', .14),
      line('Ganancia derecha: 0,91 Ganancia izquierda: 0,87', .22),
      line('Ganancia derecha: 0,91 Ganancia izquierda: 0,87', .22, 'vhit_metrics-threshold-3', 89),
      line('Simetría: 4,2 % Sacadas correctivas: ausentes', .30),
      line('Impulse Nr: 22 / 21 Head velocity: 160–220 deg/s', .38),
    ]
    const fields = extractFields([page(lines, 'vhit_graph', { type: 'vhit_labeled', confidence: .94, matchedSignals: 5, aspectRatio: 1.55 })], 'vestibular_and_reports')
    const field = (code: string) => fields.find((candidate) => candidate.studyType === 'vhit' && candidate.code === code)

    expect(field('study_date')).toMatchObject({ rawValue: '17/07/2026', value: '2026-07-17', required: true })
    expect(field('gain_right')).toMatchObject({ rawValue: '0,91', value: .91, normalizedValue: '0.91', required: true, status: 'detected' })
    expect(field('gain_right')?.validation?.multiPassAgreement).toBe(true)
    expect(field('gain_left')).toMatchObject({ value: .87, required: true })
    expect(field('symmetry')).toMatchObject({ value: 4.2, professionalValue: '4.2 %', required: true })
    expect(field('saccades')).toMatchObject({ professionalValue: 'ausentes', required: true })
    expect(field('impulse_counts')?.rawValue).toBe('22 / 21')
    expect(field('head_velocity')?.rawValue).toContain('160–220')
    expect(field('conclusion')?.required).toBe(false)
  })

  it('no exige ganancias ni HIMP en un informe vestibular puramente narrativo', () => {
    const lines = [
      line('Informe vestibular sintético', .06),
      line('Fecha del estudio: 17/07/2026', .12),
      line('En suma: hallazgo literal de prueba.', .70, 'report_summary-original-2'),
    ]
    const fields = extractFields([page(lines, 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .7 })], 'vestibular_and_reports')
    const field = (code: string) => fields.find((candidate) => candidate.studyType === 'vhit' && candidate.code === code)
    expect(field('study_date')?.required).toBe(true)
    expect(field('conclusion')).toMatchObject({ professionalValue: 'hallazgo literal de prueba.', required: true })
    expect(field('gain_right')).toMatchObject({ required: false, status: 'not_reported' })
    expect(field('himp')?.required).toBe(false)
  })

  it('marca como inválida una ganancia fuera de rango y como conflicto dos lecturas discordantes', () => {
    const invalid = extractFields([page([
      line('vHIT HIMP: realizado Canales evaluados: horizontal', .1),
      line('Ganancia derecha: 2,70 Ganancia izquierda: 0,80', .2),
    ], 'vhit_graph', { type: 'vhit_labeled', confidence: .9, matchedSignals: 4, aspectRatio: 1.5 })], 'vestibular_and_reports')
    expect(invalid.find((field) => field.studyType === 'vhit' && field.code === 'gain_right')?.status).toBe('invalid')

    const conflicting = extractFields([page([
      line('vHIT HIMP: realizado Canales evaluados: horizontal', .1),
      line('Ganancia derecha: 0,91', .2, 'full-original', 94),
      line('Ganancia derecha: 0,81', .2, 'vhit_metrics-threshold-3', 91),
    ], 'vhit_graph', { type: 'vhit_labeled', confidence: .9, matchedSignals: 4, aspectRatio: 1.5 })], 'vestibular_and_reports')
    expect(conflicting.find((field) => field.studyType === 'vhit' && field.code === 'gain_right')).toMatchObject({ status: 'conflicting' })
  })
})
