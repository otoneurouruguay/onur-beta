import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtractedField } from './types'
import type { ExtractionReviewRecord } from './repository'
import { ClinicalExtractionReview } from './ClinicalExtractionReview'

const mocks = vi.hoisted(() => ({
  record: null as ExtractionReviewRecord | null,
  save: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('./hooks', () => ({
  useStudyExtraction: () => ({ data: mocks.record, isPending: false }),
  useSaveExtraction: () => ({ mutateAsync: mocks.save, isPending: false }),
  useConfirmExtraction: () => ({ mutateAsync: mocks.confirm, isPending: false }),
  useManualExtraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDiscardExtraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReplaceExtraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('./PrivateDocumentViewer', () => ({ PrivateDocumentViewer: () => <div>Original sintético</div> }))
vi.mock('./localOcr', () => ({ analyzeClinicalFile: vi.fn(), releaseExtractionPreviews: vi.fn() }))

function field(code: string, professionalValue: string): ExtractedField {
  return {
    clientId: `synthetic-${code}`, code, label: code === 'reported_age' ? 'Edad consignada' : code.replace('_', ' '), group: 'Synthetic', studyType: 'posturography',
    required: code.startsWith('condition_'), metricCode: '', rawValue: professionalValue, normalizedValue: professionalValue, unitCode: 'percent', conditionCode: '', side: '',
    pageNumber: 1, region: null, confidence: 1, status: 'read', extractorMethod: 'manual', extractorVersion: 'onur-local-ocr-1.3', professionalValue, confirmed: false,
  }
}

function record(): ExtractionReviewRecord {
  const values = {
    reported_age: '76', condition_1: '99', condition_2: '99', condition_3: '98', condition_4: '82', condition_5: '79', condition_6: '27',
    composite_score: '81', sensory_somatosensory: '100', sensory_visual: '82', sensory_vestibular: '80', visual_preference: '70',
  }
  return {
    id: 'synthetic-job', documentId: 'synthetic-document', studyIds: ['synthetic-study'], status: 'review', intakeKind: 'posturography_bap', extractorVersion: 'onur-local-ocr-1.3',
    patientMatchStatus: 'match', mismatchFields: [], pages: [{ pageNumber: 1, proposedClassification: 'posturography', classification: 'posturography', classificationConfidence: 1, rotationDegrees: 0, width: 1000, height: 700, previewUrl: '', text: '', lines: [] }],
    fields: [...Object.entries(values).map(([code, value]) => field(code, value)), field('software_version', 'Posturo 9.1'), field('los_forward', '7.5')], sourceFilename: 'bap-synthetic.png', mimeType: 'image/png', documentUrl: '', sectionStudyId: 'synthetic-study', sectionPageNumbers: [1],
    professionalConclusion: '', rehabilitationSuggestion: '',
  }
}

describe('ClinicalExtractionReview automatic report draft', () => {
  afterEach(cleanup)

  beforeEach(() => {
    mocks.record = record()
    mocks.save.mockReset().mockResolvedValue(undefined)
    mocks.confirm.mockReset().mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('autofills editable text and only replaces an edit when regeneration is requested', async () => {
    render(<MemoryRouter><ClinicalExtractionReview studyId="synthetic-study"/></MemoryRouter>)

    const conclusion = screen.getByRole('textbox', { name: 'Conclusión para confirmar' })
    const suggestion = screen.getByRole('textbox', { name: 'Sugerencia de rehabilitación para confirmar' })
    await waitFor(() => expect((conclusion as HTMLTextAreaElement).value).toContain('70 a 79 años'))
    expect((suggestion as HTMLTextAreaElement).value).toContain('habituación visual')

    fireEvent.change(conclusion, { target: { value: 'Conclusión profesional ficticia editada.' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'condition 1' }), { target: { value: '98' } })
    expect(conclusion).toHaveValue('Conclusión profesional ficticia editada.')

    fireEvent.click(screen.getByRole('button', { name: /regenerar desde parámetros/i }))
    expect(window.confirm).toHaveBeenCalled()
    expect((conclusion as HTMLTextAreaElement).value).toContain('70 a 79 años')
    expect(screen.getByText(/09_TABLA_VALORES_NORMALES_BAP.xlsx/)).toBeInTheDocument()
  })

  it('aplica solo las correcciones editadas y actualiza su estado sin repetir el OCR', async () => {
    render(<MemoryRouter><ClinicalExtractionReview studyId="synthetic-study"/></MemoryRouter>)

    const refresh = screen.getByRole('button', { name: 'Aplicar correcciones' })
    expect(refresh).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox', { name: 'condition 1' }), { target: { value: '97' } })
    expect(screen.getByRole('button', { name: 'Aplicar correcciones (1)' })).toBeEnabled()
    expect(screen.getByText('Editado')).toBeInTheDocument()
    expect(screen.getByText(/1 para revisar/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar correcciones (1)' }))

    expect(screen.getByRole('button', { name: 'Aplicar correcciones' })).toBeDisabled()
    expect(screen.getByText('Corregido')).toBeInTheDocument()
    expect(screen.getByText(/0 para revisar/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 corrección aplicada')
  })

  it('no solicita transcribir parámetros que no alimentan el informe ni la sugerencia', () => {
    render(<MemoryRouter><ClinicalExtractionReview studyId="synthetic-study"/></MemoryRouter>)

    expect(screen.getByRole('textbox', { name: 'condition 1' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'software version' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'los forward' })).not.toBeInTheDocument()
  })
})
