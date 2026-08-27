import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAssessmentResponses } from '../features/assessments/questions'
import type { AssessmentRecord } from '../features/assessments/repository'
import { AssessmentFormPage } from './AssessmentFormPage'

const mocks = vi.hoisted(() => ({ create: vi.fn(), complete: vi.fn(), assessment: null as AssessmentRecord | null, cycles: [{ id: 'cycle-1', label: 'Ciclo 1', status: 'active' }] }))

vi.mock('../features/patients/hooks', () => ({ usePatient: () => ({ data: { id: 'patient-1', fullName: 'Paciente DHI', portalAccess: 'enabled' } }) }))
vi.mock('../features/sessions/hooks', () => ({ useTreatmentCycles: () => ({ data: mocks.cycles }) }))
vi.mock('../features/assessments/hooks', () => ({
  useAssessment: () => ({ data: mocks.assessment, isPending: false }),
  useCreateAssessment: () => ({ mutateAsync: mocks.create, isPending: false }),
  useCompleteAssessment: () => ({ mutateAsync: mocks.complete, isPending: false }),
}))

function renderPage(entry: string) {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/app/pacientes/:patientId/evaluaciones/nueva" element={<AssessmentFormPage/>}/><Route path="/app/pacientes/:patientId" element={<p>Perfil del paciente</p>}/></Routes></MemoryRouter>)
}

describe('asignación profesional de cuestionarios DHI', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.assessment = null; mocks.create.mockReset().mockResolvedValue({ id: 'assessment-1' }); mocks.complete.mockReset().mockResolvedValue({ id: 'assessment-1' }) })

  it('permite habilitar el DHI solamente en el portal del paciente', async () => {
    renderPage('/app/pacientes/patient-1/evaluaciones/nueva?mode=portal')
    expect(screen.getByRole('heading', { name: 'Enviar cuestionario' })).toBeInTheDocument()
    expect(screen.getByText('Se mostrará en el portal del paciente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /habilitar DHI inicial/i }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'patient-1', treatmentCycleId: 'cycle-1', instrumentCode: 'DHI_AR_25', deliveryMode: 'portal', phase: 'initial' })))
    expect(mocks.complete).not.toHaveBeenCalled()
  })

  it('inicia el DHI presencial, exige 25 respuestas y calcula al finalizar', async () => {
    renderPage('/app/pacientes/patient-1/evaluaciones/nueva?mode=in_person&phase=final')
    expect(screen.getByRole('heading', { name: 'Iniciar cuestionario presencial' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(75)
    const radios = screen.getAllByRole('radio')
    for (let index = 0; index < radios.length; index += 3) fireEvent.click(radios[index])
    fireEvent.click(screen.getByRole('button', { name: /finalizar y calcular/i }))
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ id: 'assessment-1', responses: expect.objectContaining({ P1: 4, E1: 4, F9: 4 }) })))
  })

  it('reanuda una asignación presencial pendiente sin crear otra', async () => {
    mocks.assessment = { id:'assessment-pending',patientId:'patient-1',patientName:'Paciente DHI',treatmentCycleId:'cycle-1',instrumentCode:'DHI_AR_25',instrumentVersion:1,phase:'initial',deliveryMode:'in_person',status:'in_progress',dueDate:'',responses:emptyAssessmentResponses(),totalScore:null,subscaleScores:{physical:0,emotional:0,functional:0},answeredCount:0,assignedAt:'2026-08-27T12:00:00.000Z',startedAt:'2026-08-27T12:05:00.000Z',completedAt:'',assessmentDate:'',createdAt:'2026-08-27T12:00:00.000Z' }
    renderPage('/app/pacientes/patient-1/evaluaciones/nueva?mode=in_person&assessmentId=assessment-pending')
    await waitFor(() => expect(screen.getByRole('button', { name: /continuar y calcular/i })).toBeInTheDocument())
    const radios = screen.getAllByRole('radio')
    for (let index = 0; index < radios.length; index += 3) fireEvent.click(radios[index])
    const continueButton = screen.getByRole('button', { name: /continuar y calcular/i })
    await waitFor(() => expect(continueButton).toBeEnabled())
    fireEvent.click(continueButton)
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ id: 'assessment-pending' })))
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
