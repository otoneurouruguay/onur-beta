import { describe, expect, it } from 'vitest'
import type { ExtractedField } from './types'
import { buildBapAutomaticReport, removeLegacyAutomaticReportBoilerplate } from './bapAutomaticReport'

function field(code: string, professionalValue: string, studyType: ExtractedField['studyType'] = 'posturography'): ExtractedField {
  return {
    clientId: `synthetic-${code}`,
    code,
    label: code,
    group: 'Synthetic',
    studyType,
    required: code.startsWith('condition_'),
    metricCode: '',
    rawValue: professionalValue,
    normalizedValue: professionalValue,
    unitCode: 'percent',
    conditionCode: '',
    side: '',
    pageNumber: 1,
    region: null,
    confidence: 1,
    status: 'read',
    extractorMethod: 'manual',
    extractorVersion: 'synthetic-test-1',
    professionalValue,
    confirmed: false,
  }
}

function bapFields(values: Record<string, string>) {
  return Object.entries(values).map(([code, value]) => field(code, value))
}

describe('buildBapAutomaticReport', () => {
  it('uses the age-specific BAP references without redundant draft disclaimers', () => {
    const result = buildBapAutomaticReport(bapFields({
      reported_age: '76', condition_1: '99', condition_2: '99', condition_3: '98', condition_4: '82', condition_5: '79', condition_6: '27',
      composite_score: '81', sensory_somatosensory: '100', sensory_visual: '82', sensory_vestibular: '80', visual_preference: '70',
    }))

    expect(result?.conclusion).toContain('70 a 79 años')
    expect(result?.conclusion).toContain('dentro de lo esperado')
    expect(result?.conclusion).toContain('preferencia visual')
    expect(result?.rehabilitationSuggestion).toContain('habituación visual')
    expect(result?.conclusion).not.toContain('Este borrador')
    expect(result?.rehabilitationSuggestion).not.toContain('Borrador para revisión profesional')
    expect(result?.rehabilitationSuggestion).not.toContain('El profesional debe')
  })

  it('describes low synthetic scores and suggests only matching functional targets', () => {
    const result = buildBapAutomaticReport(bapFields({
      reported_age: '76', condition_1: '72', condition_2: '68', condition_3: '55', condition_4: '49', condition_5: '34', condition_6: '21',
      composite_score: '50', sensory_somatosensory: '89', sensory_visual: '62', sensory_vestibular: '47', visual_preference: '66',
    }))

    expect(result?.conclusion).toContain('por debajo de lo esperado')
    expect(result?.conclusion).toContain('condición 1')
    expect(result?.conclusion).toContain('somatosensorial, visual, vestibular, preferencia visual')
    expect(result?.rehabilitationSuggestion).toContain('entrenamiento vestibular')
    expect(result?.rehabilitationSuggestion).toContain('propiocepción')
    expect(result?.rehabilitationSuggestion).toContain('riesgo de caídas')
  })

  it('prioritizes quality control when the aphysiological indicator exceeds its upper limit', () => {
    const result = buildBapAutomaticReport(bapFields({
      reported_age: '76', condition_1: '99', condition_2: '99', condition_3: '98', condition_4: '82', condition_5: '79', condition_6: '27',
      composite_score: '81', afis_pattern: '35', mix_ve_som: '49,6', mix_ve_vi: '44,9',
    }))

    expect(result?.conclusion).toContain('afisiológico')
    expect(result?.evidence).toContain('Indicador afisiológico: 35 % (límite superior 31 %)')
    expect(result?.rehabilitationSuggestion).toContain('repetir las condiciones incongruentes')
  })

  it('does not invent an age comparison when age is missing', () => {
    const result = buildBapAutomaticReport(bapFields({ condition_1: '90', condition_2: '85', composite_score: '70' }))

    expect(result?.conclusion).toContain('No es posible establecer una comparación normativa')
    expect(result?.warnings[0]).toContain('Falta una edad válida')
    expect(result?.warnings[1]).toContain('2 de 6 condiciones')
  })

  it('ignores non-posturography fields', () => {
    expect(buildBapAutomaticReport([field('gain', '0.9', 'vhit')])).toBeNull()
  })

  it('removes boilerplate persisted by previous automatic drafts', () => {
    expect(removeLegacyAutomaticReportBoilerplate(
      'Hallazgo sintético. Este borrador describe el perfil funcional y no establece un diagnóstico; debe correlacionarse con anamnesis, examen neurológico y vestibular, marcha, Romberg y estudios asociados.',
      'Borrador para revisión profesional.\n\nPlan sintético.\n\nEl profesional debe definir ejercicios, dosis, frecuencia, asistencia, progresión, regresión y precauciones; se sugiere reevaluar con la misma metodología para documentar evolución.',
    )).toEqual({ conclusion: 'Hallazgo sintético.', rehabilitationSuggestion: 'Plan sintético.' })
  })
})
