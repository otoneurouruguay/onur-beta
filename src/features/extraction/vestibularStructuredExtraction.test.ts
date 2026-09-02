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

  it('reconoce la notación local G OD/OI dentro de un informe narrativo', () => {
    const fields = extractFields([page([
      line('Fecha: 18/8/2026 Paciente: Valentina Mendez 33a CI:4475592-0', .05),
      line('vHIT HIMP: CULL: Curvas normales Simetría: 47% G OD: 0.29 OI: 0.87', .2),
      line('En suma: Hallazgo literal. Cancelación Comducta: Rehabilitación vestibular literal.', .7, 'report_summary-original-2'),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')
    const field = (code: string) => fields.find((candidate) => candidate.studyType === 'vhit' && candidate.code === code)

    expect(field('patient_name')?.professionalValue).toBe('Valentina Mendez')
    expect(field('reported_age')?.value).toBe(33)
    expect(field('gain_right')).toMatchObject({ value: .29, professionalValue: '0.29' })
    expect(field('gain_left')).toMatchObject({ value: .87, professionalValue: '0.87' })
    expect(field('gain_right')?.required).toBe(false)
    expect(field('saccades')).toMatchObject({ required: false, status: 'not_reported' })
    expect(field('conclusion')?.professionalValue).toBe('Hallazgo literal.')
    expect(field('conduct')?.professionalValue).toBe('Rehabilitación vestibular literal.')
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

  it('recupera la conducta cuando el OCR conserva solo el final de la etiqueta', () => {
    const fields = extractFields([page([
      line('Fecha: 18/8/2026', .05),
      line('En suma: Hallazgo vestibular literal.', .68, 'report_summary-original-2'),
      line('cta: Tiene indicado rehabilitación vestibular literal.', .74, 'report_summary-original-2'),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'conduct')?.professionalValue).toBe('Tiene indicado rehabilitación vestibular literal.')
  })

  it('combina una lectura parcial y otra completa de las mismas curvas sin marcar conflicto', () => {
    const fields = extractFields([page([
      line('Curva: normales', .2, 'full-original', 95),
      line('vHIT HIMP: CCLL: Curva: normales Simetría: 47% G OD: 0.29 OI: 0.87', .2, 'vhit_metrics-threshold-3', 88),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'curves_channels')).toMatchObject({
      professionalValue: 'CCLL: Curva: normales',
      status: 'detected',
    })
  })

  it('mantiene el conflicto cuando las lecturas de curvas se contradicen', () => {
    const fields = extractFields([page([
      line('Curva: normales', .2, 'full-original', 94),
      line('Curva: anormales', .2, 'vhit_metrics-threshold-3', 91),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'curves_channels')?.status).toBe('conflicting')
  })

  it('no confunde el canal que sigue a vHIT HIMP con el resultado HIMP', () => {
    const fields = extractFields([page([
      line('HIMP: positivo a derecha', .15, 'full-original', 94),
      line('HIMP: positivo a derecha', .15, 'clinical_body-original-2', 91),
      line('vHIT HIMP: CCLL: Curva: normales Simetría: 47%', .2, 'vhit_metrics-threshold-3', 90),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'himp')).toMatchObject({
      professionalValue: 'positivo a derecha',
      status: 'detected',
    })
  })

  it('prioriza dos lecturas numéricas concordantes sobre una aislada', () => {
    const fields = extractFields([page([
      line('Simetría: 47%', .2, 'full-original', 93),
      line('Simetría: 47%', .2, 'vhit_metrics-original-2', 89),
      line('Simetría: 4', .2, 'vhit_metrics-threshold-3', 91),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'symmetry')).toMatchObject({
      value: 47,
      status: 'detected',
    })
  })

  it('conserva narrativas completas, negaciones y campos contiguos de un informe vHIT', () => {
    const fields = extractFields([page([
      line('AF: antecedente familiar sintético. AP: antecedente personal sintético. MC. Síndrome vestibular sintético de un día de evolución, de una', .18, 'clinical_body-original-2', 89),
      line('hora de duración. Imagen complementaria normal.', .23, 'clinical_body-original-2', 88),
      line('1) HIMP: positivo a derecha', .29, 'clinical_body-original-2', 94),
      line('5) Sistema de Fijación: Normal SF a 30%: No nistagmos', .39, 'clinical_body-original-2', 92),
      line('8) Test vibracional: (-) Cancelación del VOR: Normal', .48, 'clinical_body-original-2', 93),
      line('En suma: Hallazgo vestibular sintético. Sistemas oculomotores normales.', .68, 'report_summary-original-2', 92),
      line('Cancelación del VOR normal.', .73, 'report_summary-original-2', 91),
      line('Conducta: Rehabilitación vestibular sintética y utilizar ayuda técnica.', .78, 'report_summary-original-2', 91),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 5, aspectRatio: .56 })], 'vestibular_and_reports')
    const field = (code: string) => fields.find((candidate) => candidate.studyType === 'vhit' && candidate.code === code)
    expect(field('history')?.professionalValue).toContain('antecedente familiar sintético')
    expect(field('history')?.professionalValue).toContain('Imagen complementaria normal.')
    expect(field('referral_reason')?.professionalValue).toContain('Síndrome vestibular sintético')
    expect(field('referral_reason')?.professionalValue).toContain('hora de duración')
    expect(field('fixation_system')).toMatchObject({ rawValue: 'Normal SF a 30%: No nistagmos', professionalValue: 'Normal SF a 30°: No nistagmos' })
    expect(field('vibration_test')?.professionalValue).toBe('(-)')
    expect(field('vor_cancellation')?.professionalValue).toBe('Normal')
    expect(field('conclusion')?.professionalValue).toContain('Cancelación del VOR normal.')
    expect(field('conduct')?.professionalValue).toContain('utilizar ayuda técnica')
  })

  it('no pierde la negación cuando síntomas aparece dentro de antecedentes', () => {
    const fields = extractFields([page([
      line('AF: antecedente sintético. AP: inestabilidad, no vértigo, no síntomas', .2, 'clinical_body-original-2', 90),
      line('cocleares. Audiometría sintética bilateral.', .25, 'clinical_body-original-2', 89),
      line('1) HIMP: sacadas bilaterales', .31, 'clinical_body-original-2', 93),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'symptoms')?.professionalValue).toBe('no síntomas cocleares. Audiometría sintética bilateral.')
  })

  it('marca como incompleta una narrativa que termina en un conector', () => {
    const fields = extractFields([page([
      line('Antecedentes: cuadro vestibular sintético de una', .2, 'clinical_body-original-2', 96),
    ], 'vestibular_report', { type: 'vestibular_report', confidence: .92, matchedSignals: 4, aspectRatio: .56 })], 'vestibular_and_reports')
    const history = fields.find((field) => field.code === 'history')

    expect(history?.status).toBe('needs_review')
    expect(history?.warnings).toContain('La lectura termina en una frase incompleta; revisá el recorte antes de confirmar.')
  })
})
