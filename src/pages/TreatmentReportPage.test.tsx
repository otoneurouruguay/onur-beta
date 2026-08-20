import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TreatmentReportPage } from './TreatmentReportPage'

const mocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../features/patients/hooks', () => ({
  usePatient: () => ({ data: { id: 'patient-1', fullName: 'Paciente Ficticio', age: 61, insurer: 'Cobertura ficticia', affiliateNumber: '' } }),
}))

vi.mock('../features/sessions/hooks', () => ({
  useTreatmentCycles: () => ({ data: [{ id: 'cycle-1', patientId: 'patient-1', label: 'Ciclo 1', reason: '', objectives: '', status: 'completed', startedOn: '2026-05-18', endedOn: '2026-07-31' }] }),
  useSessionAssignments: () => ({ data: [{ id: 'session-1', patientId: 'patient-1', patientName: 'Paciente Ficticio', treatmentCycleId: 'cycle-1', sessionPlanId: 'plan-1', title: 'Equilibrio', instructions: 'Trabajo de equilibrio supervisado.', kind: 'exercise', mode: 'in_person', exercises: [{ name: 'Equilibrio' }], availableFrom: '2026-05-26T12:00:00.000Z', availableUntil: '', status: 'completed', createdAt: '2026-05-25T12:00:00.000Z', activeSeconds: 120, completedAt: '2026-05-26T12:00:00.000Z', initialDiscomfort: 2, finalDiscomfort: 1, perceivedDifficulty: 2, patientComment: '' }] }),
}))

vi.mock('../features/documents/hooks', () => ({ usePatientDocuments: () => ({ data: [] }) }))
vi.mock('../features/assessments/hooks', () => ({ usePatientAssessments: () => ({ data: [] }) }))
vi.mock('../features/studies/hooks', () => ({ useClinicalStudies: () => ({ data: [] }) }))
vi.mock('../features/reports/hooks', () => ({
  usePatientReports: () => ({ data: [] }),
  useCreateReport: () => ({ mutateAsync: mocks.create, isPending: false }),
}))
vi.mock('../features/reports/ReportSourceFigure', () => ({
  ReportSourceFigure: ({ label }: { label: string }) => <div>{label} sin documento</div>,
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/pacientes/patient-1/informe']}><Routes><Route path="/app/pacientes/:patientId/informe" element={<TreatmentReportPage/>}/><Route path="/app/pacientes/:patientId" element={<p>Perfil</p>}/></Routes></MemoryRouter></QueryClientProvider>)
}

describe('informe clínico por ciclo', () => {
  afterEach(cleanup)
  beforeEach(() => mocks.create.mockReset().mockResolvedValue({ id: 'report-1' }))

  it('reproduce la estructura acordada en seis páginas', () => {
    const { container } = renderPage()
    expect(screen.getByRole('heading', { name: 'Realizar informe' })).toBeInTheDocument()
    expect(container.querySelectorAll('.onur-report-page')).toHaveLength(6)
    expect(screen.getByRole('heading', { name: 'Comparación cuantitativa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Registro posturográfico inicial' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Registro posturográfico final' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cronología de sesiones' })).toBeInTheDocument()
  })

  it('exige revisión profesional mínima antes de versionar el informe final', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /versionar informe final/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/síntesis clínica y la conclusión profesional/i)

    fireEvent.change(screen.getByLabelText(/síntesis clínica/i), { target: { value: 'Síntesis clínica revisada.' } })
    fireEvent.change(screen.getByLabelText(/conclusión profesional/i), { target: { value: 'Conclusión profesional revisada.' } })
    fireEvent.click(screen.getByRole('button', { name: /versionar informe final/i }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'final', professionalSummary: 'Conclusión profesional revisada.', snapshot: expect.objectContaining({ schemaVersion: 'onur-clinical-report-v1' }) })))
  })
})
