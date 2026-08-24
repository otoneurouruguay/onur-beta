import { describe, expect, it } from 'vitest'
import { buildVestibularAutomaticReport } from './vestibularAutomaticReport'
import type { ExtractedField } from './types'

function field(code: string, value: string, status: ExtractedField['status'] = 'detected'): ExtractedField {
  return { clientId: code, code, label: code, group: 'Conclusión', studyType: 'vhit', required: false, metricCode: '', rawValue: value, normalizedValue: value, unitCode: '', conditionCode: '', side: '', pageNumber: 1, region: null, confidence: .9, status, extractorMethod: 'local_ocr', extractorVersion: 'test', professionalValue: value, confirmed: false }
}

describe('borrador literal vestibular', () => {
  it('recupera En suma y Conducta sin generar interpretación clínica', () => {
    expect(buildVestibularAutomaticReport([field('conclusion', 'Hallazgo literal.'), field('conduct', 'Reevaluar.')])).toMatchObject({ conclusion: 'Hallazgo literal.', rehabilitationSuggestion: 'Reevaluar.' })
  })

  it('no usa texto inválido o ausente', () => {
    expect(buildVestibularAutomaticReport([field('conclusion', '', 'not_reported')])).toBeNull()
  })
})
