import { describe, expect, it } from 'vitest'
import { buildVestibularAutomaticReport } from './vestibularAutomaticReport'
import type { ExtractedField } from './types'

function field(code: string, value: string, status: ExtractedField['status'] = 'detected'): ExtractedField {
  return { clientId: code, code, label: code, group: 'Conclusión', studyType: 'vhit', required: false, metricCode: '', rawValue: value, normalizedValue: value, unitCode: '', conditionCode: '', side: '', pageNumber: 1, region: null, confidence: .9, status, extractorMethod: 'local_ocr', extractorVersion: 'test', professionalValue: value, confirmed: false }
}

describe('borrador vestibular con transcripción y sugerencia separadas', () => {
  it('recupera En suma y conserva Conducta sin copiarla como sugerencia', () => {
    const result = buildVestibularAutomaticReport([field('conclusion', 'Hallazgo literal.'), field('conduct', 'Reevaluar.')])
    expect(result).toMatchObject({ conclusion: 'Hallazgo literal.', transcribedConduct: 'Reevaluar.' })
    expect(result?.rehabilitationSuggestion).not.toBe('Reevaluar.')
    expect(result?.rehabilitationSuggestion).toContain('diagnóstico funcional')
    expect(result?.sources.map((source) => source.id)).toContain('SRC-001')
  })

  it('no usa texto inválido o ausente', () => {
    expect(buildVestibularAutomaticReport([field('conclusion', '', 'not_reported')])).toBeNull()
  })

  it('elimina bloques OCR superpuestos y no mezcla Conducta dentro de En suma', () => {
    const duplicated = [
      'Síndrome vestibular agudo periférico derecho. No evidencia de alteración',
      'En suma: Síndrome vestibular agudo periférico derecho. No evidencia de alteración',
      'En suma: Síndrome vestibular agudo periférico derecho. No evidencia de alteración propioceptiva.',
      'Sistemas de comando oculomotores normales para la edad.',
      'Sistemas de comando oculomotores normales para la edad.',
      'Conducta: Tiene indicado rehabilitación vestibular para SVA derecho.',
    ].join(' ')
    const result = buildVestibularAutomaticReport([field('conclusion', duplicated), field('conduct', 'VORx1')])

    expect(result?.conclusion).toBe('Síndrome vestibular agudo periférico derecho. No evidencia de alteración propioceptiva. Sistemas de comando oculomotores normales para la edad.')
    expect(result?.conclusion).not.toMatch(/En suma|Conducta/i)
    expect(result?.transcribedConduct).toBe('VORx1')
    expect(result?.rehabilitationSuggestion).not.toBe('VORx1')
  })

  it('elimina una etiqueta vestibular incompleta antes de Conducta', () => {
    const result = buildVestibularAutomaticReport([
      field('conclusion', 'Síndrome vestibular sintético. Sistemas oculomotores normales. Cancelación Conducta: Rehabilitación vestibular sintética.'),
      field('conduct', 'Trabajo de VORx1 sintético.'),
    ])

    expect(result?.conclusion).toBe('Síndrome vestibular sintético. Sistemas oculomotores normales.')
    expect(result?.conclusion).not.toMatch(/Cancelación|Conducta/i)
    expect(result?.transcribedConduct).toBe('Trabajo de VORx1 sintético.')
    expect(result?.rehabilitationSuggestion).not.toBe('Trabajo de VORx1 sintético.')
  })

  it('tolera Comducta como error OCR sin mezclarla en la conclusión', () => {
    const result = buildVestibularAutomaticReport([
      field('conclusion', 'Hallazgo literal. Cancelación Comducta: Rehabilitación vestibular literal.'),
      field('conduct', 'Rehabilitación vestibular literal.'),
    ])

    expect(result?.conclusion).toBe('Hallazgo literal.')
    expect(result?.transcribedConduct).toBe('Rehabilitación vestibular literal.')
    expect(result?.rehabilitationSuggestion).not.toBe('Rehabilitación vestibular literal.')
  })

  it('cruza hipofunción bilateral, marcha y ganancias con fuentes específicas', () => {
    const result = buildVestibularAutomaticReport([
      field('conclusion', 'Ataxia vestibular post Gentamicina. Evidencia de hipofunción vestibular periférica bilateral severa.'),
      field('conduct', 'Tiene indicada Posturografía y Rehabilitación vestibular.'),
      field('gain_right', '0.42'), field('gain_left', '0.39'), field('gait', 'atáxica'), field('reported_age', '76'),
    ])

    expect(result?.rehabilitationSuggestion).toContain('hipofunción vestibular bilateral')
    expect(result?.rehabilitationSuggestion).toContain('riesgo de caída')
    expect(result?.rehabilitationSuggestion).toContain('estabilidad de mirada')
    expect(result?.evidence).toContain('Ganancias horizontales informadas: derecha 0.42; izquierda 0.39.')
    expect(result?.sources.map((source) => source.id)).toEqual(expect.arrayContaining(['SRC-001', 'SRC-007', 'SRC-008']))
  })

  it('prioriza revisión profesional cuando hay un hallazgo potencialmente central', () => {
    const result = buildVestibularAutomaticReport([
      field('conclusion', 'Hallazgos vestibulares a correlacionar.'),
      field('conduct', 'Rehabilitación vestibular.'),
      field('skew', 'positivo'),
    ])

    expect(result?.rehabilitationSuggestion).toContain('reevaluación neurológica')
    expect(result?.sources.map((source) => source.id)).toContain('SRC-030')
  })

  it('no confunde SKEW negativo entre paréntesis con una alerta central', () => {
    const result = buildVestibularAutomaticReport([
      field('conclusion', 'Síndrome vestibular agudo perferico derecho.'),
      field('conduct', 'Rehabilitación vestibular derecha.'),
      field('skew', '(-)'), field('gait', 'atáxica'),
    ])

    expect(result?.rehabilitationSuggestion).toContain('hipofunción vestibular unilateral')
    expect(result?.rehabilitationSuggestion).not.toContain('reevaluación neurológica')
    expect(result?.sources.map((source) => source.id)).toContain('SRC-001')
  })
})
