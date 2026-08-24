import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ClinicalDocumentRecord } from './types'

const mocks = vi.hoisted(() => ({
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  resetDeletion: vi.fn(),
}))

const document: ClinicalDocumentRecord = {
  id: 'document-1', patientId: 'patient-1', treatmentCycleId: 'cycle-1', documentType: 'clinical_report',
  cyclePhase: 'unspecified', originalFilename: 'informe-equivocado.pdf', storagePath: 'professional/patient/informe.pdf',
  mimeType: 'application/pdf', fileSizeBytes: 100, documentDate: '2026-08-24', description: '',
  createdAt: '2026-08-24T12:00:00.000Z', sharedWithPatient: false, permissionId: '', permissionLevel: '',
  studyId: '', studyStatus: '', deviceName: '',
}

vi.mock('./hooks', () => ({
  usePatientDocuments: () => ({ data: [document], isPending: false }),
  usePatientDocumentAccessRequests: () => ({ data: [] }),
  useSetDocumentPermission: () => ({ mutate: vi.fn(), isPending: false }),
  useResolveDocumentAccessRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteDocument: () => ({ mutateAsync: mocks.deleteDocument, reset: mocks.resetDeletion, isPending: false, error: null }),
}))

import { PatientDocumentsPanel } from './PatientDocumentsPanel'

describe('PatientDocumentsPanel', () => {
  it('permite eliminar un informe después de confirmarlo', async () => {
    render(<MemoryRouter><PatientDocumentsPanel patientId="patient-1" /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar informe-equivocado.pdf' }))
    expect(screen.getByRole('dialog', { name: 'Eliminar informe clínico' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }))
    await waitFor(() => expect(mocks.deleteDocument).toHaveBeenCalledWith(document))
    expect(await screen.findByRole('status')).toHaveTextContent('Informe clínico eliminado correctamente.')
  })
})
