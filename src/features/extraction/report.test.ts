import { describe, expect, it } from 'vitest'
import { buildStudyExtractionReport } from './report'
import type { ExtractionReviewRecord } from './repository'

function extraction(overrides: Partial<ExtractionReviewRecord> = {}): ExtractionReviewRecord {
  return {
    id: 'synthetic-job', documentId: 'synthetic-document', studyIds: ['synthetic-study'], status: 'confirmed', intakeKind: 'posturography_bap', extractorVersion: 'synthetic-test-1', patientMatchStatus: 'confirmed_by_professional', mismatchFields: [], pages: [], sourceFilename: 'bap-synthetic.png', mimeType: 'image/png', documentUrl: '', sectionStudyId: 'synthetic-study', sectionPageNumbers: [1], professionalConclusion: 'Conclusión profesional sintética.', rehabilitationSuggestion: 'Sugerencia profesional sintética.',
    fields: [
      { clientId: 'synthetic-condition', code: 'condition_1', label: 'Condición 1', group: 'Condiciones', studyType: 'posturography', required: true, metricCode: 'condition_score', rawValue: '90', normalizedValue: '90', unitCode: 'percent', conditionCode: '1', side: '', pageNumber: 1, region: null, confidence: .95, status: 'read', extractorMethod: 'local_ocr', extractorVersion: 'synthetic-test-1', professionalValue: '92', confirmed: true },
      { clientId: 'synthetic-pending', code: 'condition_2', label: 'Condición 2', group: 'Condiciones', studyType: 'posturography', required: false, metricCode: 'condition_score', rawValue: '81', normalizedValue: '81', unitCode: 'percent', conditionCode: '2', side: '', pageNumber: 1, region: null, confidence: .92, status: 'read', extractorMethod: 'local_ocr', extractorVersion: 'synthetic-test-1', professionalValue: '81', confirmed: false },
      { clientId: 'synthetic-vhit', code: 'gain_right', label: 'Ganancia derecha', group: 'Ganancias', studyType: 'vhit', required: false, metricCode: 'gain', rawValue: '0,80', normalizedValue: '0.8', unitCode: 'ratio', conditionCode: '', side: 'right', pageNumber: 1, region: null, confidence: .92, status: 'read', extractorMethod: 'local_ocr', extractorVersion: 'synthetic-test-1', professionalValue: '0,82', confirmed: true },
      { clientId: 'synthetic-irrelevant', code: 'software_version', label: 'Software y versión', group: 'Estudio', studyType: 'posturography', required: false, metricCode: '', rawValue: '9.1', normalizedValue: '9.1', unitCode: '', conditionCode: '', side: '', pageNumber: 1, region: null, confidence: .99, status: 'read', extractorMethod: 'local_ocr', extractorVersion: 'synthetic-test-1', professionalValue: '9.1', confirmed: true },
    ],
    ...overrides,
  }
}

describe('informe de extracción confirmado', () => {
  it('muestra literalmente el valor profesional confirmado, no el OCR ni campos sin confirmar', () => {
    expect(buildStudyExtractionReport(extraction(), 'posturography')).toEqual({
      parameters: [{ code: 'condition_1', label: 'Condición 1', value: '92', status: 'confirmed' }],
      qualityControls: [],
      limitations: [],
      conclusion: 'Conclusión profesional sintética.',
      rehabilitationSuggestion: 'Sugerencia profesional sintética.',
    })
  })

  it('no permite generar un informe antes de la confirmación o sin textos profesionales', () => {
    expect(buildStudyExtractionReport(extraction({ status: 'review' }), 'posturography')).toBeNull()
    expect(buildStudyExtractionReport(extraction({ professionalConclusion: '' }), 'posturography')).toBeNull()
    expect(buildStudyExtractionReport(extraction({ rehabilitationSuggestion: '' }), 'posturography')).toBeNull()
  })
})
