import { beforeEach, describe, expect, it } from 'vitest'
import { confirmExtraction, createExtractionDraft, discardExtraction, getExtractionForStudy, markExtractionManual, reopenExtraction, saveExtractionReview } from './repository'
import type { LocalExtractionDraft } from './types'

function draft(): LocalExtractionDraft {
  return {
    intakeKind: 'vestibular_and_reports', extractorVersion: 'synthetic-test-1', patientMatchStatus: 'not_checked', mismatchFields: [],
    pages: [{ pageNumber: 1, proposedClassification: 'vestibular_report', classification: 'vestibular_report', classificationConfidence: .92, rotationDegrees: 0, width: 1000, height: 1400, previewUrl: '', text: '', lines: [] }],
    fields: [{ clientId: 'synthetic-field-1', code: 'conclusion', label: 'Conclusión', group: 'Conclusión', studyType: 'vhit', required: true, metricCode: 'reported_conclusion_text', rawValue: 'Texto sintético', normalizedValue: 'Texto sintético', unitCode: '', conditionCode: '', side: '', pageNumber: 1, region: { x: .1, y: .2, width: .5, height: .04 }, confidence: .9, status: 'read', extractorMethod: 'local_ocr', extractorVersion: 'synthetic-test-1', professionalValue: 'Texto sintético', confirmed: false }],
  }
}

describe('ciclo de extracción demo', () => {
  beforeEach(() => localStorage.clear())

  it('guarda correcciones y confirma sin convertir el original en público', async () => {
    const created = await createExtractionDraft('synthetic-document', 'synthetic-patient', draft(), '2026-07-17', '', 'synthetic.pdf', 'application/pdf')
    const review = await getExtractionForStudy(created.studyIds[0])
    expect(review?.status).toBe('review')
    review!.fields[0] = { ...review!.fields[0], professionalValue: 'Texto sintético corregido', normalizedValue: 'Texto sintético corregido', confirmed: true }
    review!.professionalConclusion = 'Conclusión profesional sintética.'
    review!.rehabilitationSuggestion = 'Plan profesional sintético.'
    await saveExtractionReview(review!)
    expect((await getExtractionForStudy(created.studyIds[0]))?.fields[0]).toMatchObject({ professionalValue: 'Texto sintético corregido', confirmed: true })
    await confirmExtraction(created.jobId)
    expect((await getExtractionForStudy(created.studyIds[0]))?.status).toBe('confirmed')
  })

  it('permite elegir carga completamente manual', async () => {
    const created = await createExtractionDraft('synthetic-document', 'synthetic-patient', draft(), '2026-07-17', '', 'synthetic.pdf', 'application/pdf')
    await markExtractionManual(created.jobId)
    expect((await getExtractionForStudy(created.studyIds[0]))?.status).toBe('manual')
  })

  it('descarta el borrador conservando la referencia al original', async () => {
    const created = await createExtractionDraft('synthetic-document', 'synthetic-patient', draft(), '2026-07-17', '', 'synthetic.pdf', 'application/pdf')
    await discardExtraction(created.jobId)
    const review = await getExtractionForStudy(created.studyIds[0])
    expect(review).toMatchObject({ status: 'discarded', documentId: 'synthetic-document' })
  })

  it('reabre un borrador descartado y permite volver a guardarlo', async () => {
    const created = await createExtractionDraft('synthetic-document', 'synthetic-patient', draft(), '2026-07-17', '', 'synthetic.pdf', 'application/pdf')
    await discardExtraction(created.jobId)
    await reopenExtraction(created.jobId)
    const review = await getExtractionForStudy(created.studyIds[0])
    expect(review?.status).toBe('review')
    review!.professionalConclusion = 'Conclusión reabierta.'
    review!.rehabilitationSuggestion = 'Sugerencia reabierta.'
    await saveExtractionReview(review!)
    expect(await getExtractionForStudy(created.studyIds[0])).toMatchObject({ professionalConclusion: 'Conclusión reabierta.', rehabilitationSuggestion: 'Sugerencia reabierta.' })
  })
})
