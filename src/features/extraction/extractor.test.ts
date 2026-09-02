import { describe, expect, it, vi } from 'vitest'
import { classifyPage, comparePatientIdentity, extractFields } from './extractor'
import type { ExtractedPage, PageClassification } from './types'

function page(text: string, classification: PageClassification, confidence = .94): ExtractedPage {
  return { pageNumber: 1, proposedClassification: classification, classification, classificationConfidence: confidence, rotationDegrees: 0, width: 1000, height: 1400, previewUrl: '', text, lines: text.split('\n').map((line, index) => ({ text: line, confidence: confidence * 100, region: { x: .05, y: index * .04, width: .8, height: .03 } })) }
}

describe('clasificación clínica local', () => {
  it.each([
    ['Posturografía BAP organización sensorial Score LOS Sway', 'posturography'],
    ['Informe vestibular Antecedentes Supresión visual Head Shaking Test En suma', 'vestibular_report'],
    ['vHIT HIMP SHIMP gain curva canal horizontal', 'vhit_graph'],
    ['Orden médica Motivo de derivación Solicito evaluación', 'referral'],
    ['Informe clínico Paciente Examen clínico', 'other_clinical'],
    ['ALFA 123 BETA XYZ', 'unrecognized'],
  ])('clasifica %s', (text, expected) => expect(classifyPage(text).classification).toBe(expected))

  it('no escribe el texto clínico en consola', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const sensitiveSyntheticMarker = 'MARCADOR-SINTETICO-NO-LOG'
    classifyPage(`Posturografía BAP ${sensitiveSyntheticMarker}`)
    extractFields([page(`Condición 1: 82,5 %\nConclusión: ${sensitiveSyntheticMarker}`, 'posturography')], 'posturography_bap')
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('extracción literal revisable', () => {
  it('preserva coma decimal, negativos, porcentajes, infinito, No aplica y blancos', () => {
    const fields = extractFields([page('Adelante: 82,5 %\nIzquierda: -3,5 %\nÁrea: 12,4 cm2\nPatrón Afis: No aplica\nÍndice PPPD: ∞\nCondición 1: 91 %\nCondición 2: 86 %\nCondición 3: 73 %\nCondición 4: 64 %\nCondición 5:', 'posturography')], 'posturography_bap')
    expect(fields.find((field) => field.code === 'los_forward')).toMatchObject({ rawValue: '82,5 %', normalizedValue: '82.5' })
    expect(fields.find((field) => field.code === 'los_left')).toMatchObject({ rawValue: '-3,5 %', normalizedValue: '-3.5' })
    expect(fields.find((field) => field.code === 'los_area')).toMatchObject({ rawValue: '12,4 cm2', normalizedValue: '12.4' })
    expect(fields.find((field) => field.code === 'afis_pattern')).toMatchObject({ rawValue: 'No aplica', normalizedValue: 'not_applicable' })
    expect(fields.find((field) => field.code === 'pppd_index')).toMatchObject({ rawValue: '∞', normalizedValue: 'infinite' })
    expect(fields.find((field) => field.code === 'condition_1')).toMatchObject({ rawValue: '91 %', normalizedValue: '91' })
    expect(fields.find((field) => field.code === 'condition_5')).toMatchObject({ rawValue: '', status: 'not_reported' })
  })

  it('extrae ganancias por lado sin interpretar curvas', () => {
    const fields = extractFields([page('vHIT curva canal horizontal\nGanancia derecha: 0,88\nGanancia izquierda: 0,82\nValor ilegible:', 'vhit_graph', .72)], 'vestibular_and_reports')
    expect(fields.find((field) => field.code === 'gain_right')).toMatchObject({ rawValue: '0,88', normalizedValue: '0.88', side: 'right', status: 'needs_review' })
    expect(fields.find((field) => field.code === 'gain_left')).toMatchObject({ rawValue: '0,82', normalizedValue: '0.82', side: 'left' })
    expect(fields.some((field) => field.metricCode.includes('curve_interpretation'))).toBe(false)
  })

  it('marca OCR parcial y campos obligatorios faltantes sin inventarlos', () => {
    const fields = extractFields([page('Informe vestibular\nFecha del estudio: 17/07/2026\nConclusión:', 'vestibular_report', .58)], 'vestibular_and_reports')
    expect(fields.find((field) => field.code === 'study_date')?.status).toBe('needs_review')
    expect(fields.find((field) => field.code === 'conclusion')).toMatchObject({ rawValue: '', required: true, status: 'not_reported' })
  })

  it('reconoce el formato clínico G. Regresión OD/OI usado en los informes locales', () => {
    const fields = extractFields([page('vHIT HIMP: CULL: Curvas normales. Simetría: 3% G. Regresión OD: 0,97 OI: 1,02\nSacadas correctivas: ausentes\nImpulse Nr: 22 / 21', 'vhit_graph', .9)], 'vestibular_and_reports')
    expect(fields.find((field) => field.code === 'gain_right')).toMatchObject({ rawValue: '0,97', normalizedValue: '0.97', required: true })
    expect(fields.find((field) => field.code === 'gain_left')).toMatchObject({ rawValue: '1,02', normalizedValue: '1.02', required: true })
    expect(fields.find((field) => field.code === 'symmetry')?.rawValue).toContain('3%')
    expect(fields.find((field) => field.code === 'impulse_counts')?.rawValue).toContain('22 / 21')
    expect(fields.find((field) => field.code === 'saccades')).toMatchObject({ rawValue: 'ausentes', required: true })
  })

  it('recompone En suma y Conducta multilinea y propone el tipo documental sin inventar contenido', () => {
    const reportPage: ExtractedPage = {
      ...page('Informe vestibular sintetico\nFecha del estudio: 17/07/2026\nEn suma\nConducta', 'vestibular_report', .92),
      lines: [
        { text: 'En suma: Hallazgo ves', confidence: 72, region: { x: .12, y: .68, width: .19, height: .018 } },
        { text: 'En suma: Hallazgo vestibular sintetico para probar la lectura', confidence: 91, region: { x: .12, y: .681, width: .62, height: .019 } },
        { text: 'de un bloque de varias lineas sin datos de una persona real.', confidence: 90, region: { x: .12, y: .708, width: .58, height: .019 } },
        { text: 'Conducta: Reevaluacion sintetica y plan ficticio.', confidence: 93, region: { x: .12, y: .747, width: .48, height: .019 } },
        { text: 'Prof. PRUEBA SINTETICA', confidence: 95, region: { x: .33, y: .79, width: .26, height: .018 } },
      ],
    }
    const fields = extractFields([reportPage], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'conclusion')).toMatchObject({
      rawValue: 'Hallazgo vestibular sintetico para probar la lectura de un bloque de varias lineas sin datos de una persona real.',
      status: 'detected',
    })
    expect(fields.find((field) => field.code === 'conduct')).toMatchObject({ rawValue: 'Reevaluacion sintetica y plan ficticio.', status: 'detected' })
    expect(fields.find((field) => field.code === 'document_type')).toMatchObject({ rawValue: 'Informe vestibular / vHIT', status: 'needs_review' })
  })

  it('conserva completa una frase narrativa de examen clinico', () => {
    const reportPage: ExtractedPage = {
      ...page('Informe vestibular sintetico', 'vestibular_report'),
      lines: [
        { text: 'Se realizo examen clinico e instrumentado del sistema vestibular', confidence: 94, region: { x: .12, y: .23, width: .7, height: .019 } },
        { text: 'y de los sistemas oculomotores centrales.', confidence: 93, region: { x: .12, y: .257, width: .46, height: .019 } },
        { text: '1. HIMP: resultado sintetico.', confidence: 95, region: { x: .14, y: .295, width: .31, height: .019 } },
      ],
    }
    const field = extractFields([reportPage], 'vestibular_and_reports').find((candidate) => candidate.code === 'clinical_exam')
    expect(field).toMatchObject({ rawValue: 'Se realizo examen clinico e instrumentado del sistema vestibular y de los sistemas oculomotores centrales.', status: 'detected' })
  })

  it('deduplica En suma de varias pasadas y corta antes de Conducta', () => {
    const reportPage: ExtractedPage = {
      ...page('Informe vestibular sintetico\nEn suma\nConducta', 'vestibular_report'),
      lines: [
        { text: 'En suma: Hallazgo vestibular sintetico.', confidence: 88, region: { x: .12, y: .66, width: .35, height: .019 } },
        { text: 'En suma: Hallazgo vestibular sintetico. Segundo dato literal.', confidence: 94, region: { x: .12, y: .685, width: .58, height: .019 } },
        { text: 'Segundo dato literal.', confidence: 92, region: { x: .12, y: .71, width: .23, height: .019 } },
        { text: 'Conducta: VORx1', confidence: 95, region: { x: .12, y: .738, width: .2, height: .019 } },
      ],
    }
    const fields = extractFields([reportPage], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'conclusion')?.rawValue).toBe('Hallazgo vestibular sintetico. Segundo dato literal.')
    expect(fields.find((field) => field.code === 'conduct')?.rawValue).toBe('VORx1')
  })

  it('elige una sola pasada para Examen clínico y separa etiquetas compactas consecutivas', () => {
    const reportPage: ExtractedPage = {
      ...page('Informe vestibular sintetico', 'vestibular_report'),
      lines: [
        { text: 'Se realizo examen clinico e instrumentado del sistema vestibular.', confidence: 90, region: { x: .1, y: .2, width: .65, height: .02 }, regionId: 'clinical_body', passId: 'clinical_body-original-2' },
        { text: 'AF: HTA. AP: HTA. MC: Sindrome vestibular sintetico.', confidence: 89, region: { x: .1, y: .23, width: .6, height: .02 }, regionId: 'clinical_body', passId: 'clinical_body-original-2' },
        { text: 'Se realice examen clinico del sistema vestibular y oculomotor.', confidence: 76, region: { x: .1, y: .201, width: .6, height: .02 }, regionId: 'clinical_body', passId: 'clinical_body-grayscale-3' },
        { text: 'AF: HTA. AP: HTA. MC: Otro bloque superpuesto.', confidence: 74, region: { x: .1, y: .231, width: .55, height: .02 }, regionId: 'clinical_body', passId: 'clinical_body-grayscale-3' },
        { text: 'Test vibracional: (-) Cancelacion del VOR: Normal', confidence: 94, region: { x: .1, y: .42, width: .52, height: .02 } },
        { text: 'Sistema Sacadico: Precision: Correcta Velocidad: normal', confidence: 93, region: { x: .1, y: .45, width: .54, height: .02 } },
        { text: 'vHIT HIMP: CULL: Curvas normales Simetria: 47%', confidence: 92, region: { x: .1, y: .48, width: .5, height: .02 } },
      ],
    }
    const fields = extractFields([reportPage], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'clinical_exam')?.rawValue).toBe('Se realizo examen clinico e instrumentado del sistema vestibular.')
    expect(fields.find((field) => field.code === 'vibration_test')?.rawValue).toBe('(-)')
    expect(fields.find((field) => field.code === 'vor_cancellation')?.rawValue).toBe('Normal')
    expect(fields.find((field) => field.code === 'saccadic_precision')?.rawValue).toBe('Correcta')
    expect(fields.find((field) => field.code === 'saccadic_velocity')?.rawValue).toBe('normal')
    expect(fields.find((field) => field.code === 'curves_channels')?.rawValue).toBe('CULL: Curvas normales')
  })

  it('recupera Conducta aunque comparta una línea OCR con En suma', () => {
    const reportPage: ExtractedPage = {
      ...page('Informe vestibular sintetico\nEn suma\nConducta', 'vestibular_report'),
      lines: [
        { text: 'En suma: Hallazgo vestibular sintetico. Conducta: Rehabilitacion vestibular sintetica.', confidence: 94, region: { x: .1, y: .7, width: .78, height: .02 }, regionId: 'report_summary', passId: 'report_summary-original-2' },
      ],
    }
    const fields = extractFields([reportPage], 'vestibular_and_reports')

    expect(fields.find((field) => field.code === 'conclusion')?.rawValue).toBe('Hallazgo vestibular sintetico.')
    expect(fields.find((field) => field.code === 'conduct')?.rawValue).toBe('Rehabilitacion vestibular sintetica.')
  })

  it('lee panel BAP compacto y porcentajes ubicados por columna', () => {
    const bapPage: ExtractedPage = {
      ...page('Posturografía BAP\nPorcent. de condiciones\nTest de organización sensorial', 'posturography'),
      lines: [
        { text: 'Adel = -07,73   Atrás = 04,31', confidence: 91, region: { x: .02, y: .27, width: .2, height: .03 } },
        { text: 'Izqui = -03,37   Derech = 03,02', confidence: 90, region: { x: .02, y: .31, width: .2, height: .03 } },
        { text: '17/7/2026', confidence: 96, region: { x: .61, y: .91, width: .08, height: .02 } },
        // Las etiquetas del eje Y no son condiciones y no deben desplazar
        // las siete lecturas BAP (C1..C6 y Compuesto).
        ...[100, 80, 60].map((value, index) => ({ text: String(value), confidence: 88, region: { x: .685, y: .16 + index * .08, width: .02, height: .02 } })),
        // En un BAP, los puntajes altos aparecen arriba de cada barra.
        ...[90, 99, 98, 82, 79, 27, 81].map((value, index) => ({ text: String(value), confidence: 88, region: { x: .71 + index * .043, y: .14 + index * .01, width: .025, height: .02 } })),
        ...[100, 82, 80, 70].map((value, index) => ({ text: String(value), confidence: 86, region: { x: .72 + index * .07, y: .65 + index * .01, width: .03, height: .02 } })),
      ],
    }
    const fields = extractFields([bapPage], 'posturography_bap')
    expect(fields.find((field) => field.code === 'los_forward')).toMatchObject({ rawValue: '-07,73', normalizedValue: '-7.73' })
    expect(fields.find((field) => field.code === 'los_backward')).toMatchObject({ rawValue: '04,31', normalizedValue: '4.31' })
    expect(fields.find((field) => field.code === 'condition_1')).toMatchObject({ rawValue: '90', normalizedValue: '90', status: 'needs_review' })
    expect(fields.find((field) => field.code === 'condition_4')).toMatchObject({ rawValue: '82', normalizedValue: '82' })
    expect(fields.find((field) => field.code === 'composite_score')).toMatchObject({ rawValue: '81', normalizedValue: '81' })
    expect(fields.find((field) => field.code === 'sensory_somatosensory')).toMatchObject({ rawValue: '100', normalizedValue: '100' })
    expect(fields.find((field) => field.code === 'study_date')).toMatchObject({ rawValue: '17/7/2026' })
  })

  it('conserva los cuatro valores Sway de BAP 2.3.2 sin confundir segundos con minutos', () => {
    const fields = extractFields([page('Posturografía BAP\nSway/s X = 3 · Sway/m X = 204\nSway/s Y = 4 · Sway/m Y = 252\nPatrón Afis. = 27,5 %\nScore LOS = 100,0 %', 'posturography')], 'posturography_bap')

    expect(fields.find((field) => field.code === 'sway_per_second_x')).toMatchObject({ rawValue: '3', metricCode: 'sway_per_second_x', unitCode: 'oscillations_per_second' })
    expect(fields.find((field) => field.code === 'sway_per_second_y')).toMatchObject({ rawValue: '4', metricCode: 'sway_per_second_y', unitCode: 'oscillations_per_second' })
    expect(fields.find((field) => field.code === 'sway_per_minute_x')).toMatchObject({ rawValue: '204', metricCode: 'sway_per_minute_x', unitCode: 'oscillations_per_minute' })
    expect(fields.find((field) => field.code === 'sway_per_minute_y')).toMatchObject({ rawValue: '252', metricCode: 'sway_per_minute_y', unitCode: 'oscillations_per_minute' })
    expect(fields.find((field) => field.code === 'afis_pattern')).toMatchObject({ rawValue: '27,5 %', metricCode: 'aphysiological_pattern', unitCode: 'percent' })
    expect(fields.find((field) => field.code === 'los_score')).toMatchObject({ rawValue: '100,0 %', unitCode: 'percent' })
  })

  it('define seis condiciones BAP y no convierte los iconos 7 y 8 en condiciones', () => {
    const fields = extractFields([page('Posturografía BAP', 'posturography')], 'posturography_bap')
    expect(fields.filter((field) => /^condition_\d+$/.test(field.code))).toHaveLength(6)
    expect(fields.some((field) => field.code === 'condition_7' || field.code === 'condition_8')).toBe(false)
  })
})

describe('coincidencia de paciente', () => {
  it('detecta discrepancia sin cambiar el paciente ni devolver los valores del documento', () => {
    const result = comparePatientIdentity([page('Paciente: CASO DIFERENTE\nFecha de nacimiento: 02/02/1999', 'other_clinical')], { fullName: 'PACIENTE FICTICIO', birthDate: '2000-01-01', affiliateNumber: '' })
    expect(result).toEqual({ status: 'mismatch', mismatchFields: ['name', 'birth_date'] })
  })

  it('permite continuar sin inferir cuando no hay identidad legible', () => {
    expect(comparePatientIdentity([page('Gráfico parcialmente ilegible', 'unrecognized')], { fullName: 'PACIENTE FICTICIO', birthDate: '', affiliateNumber: '' }).status).toBe('not_checked')
  })
})
