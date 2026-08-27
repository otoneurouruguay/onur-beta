import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAssessmentResponses } from '../features/assessments/questions'
import type { AssessmentRecord } from '../features/assessments/repository'
import { PatientAssessmentPage } from './PatientAssessmentPage'

const mocks = vi.hoisted(() => ({ save: vi.fn(), complete: vi.fn(), record: null as unknown as AssessmentRecord }))

vi.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ signOut: vi.fn() }) }))
vi.mock('../features/assessments/hooks', () => ({
  useAssessment: () => ({ data: mocks.record, isPending:false, error:null }),
  useSaveAssessmentDraft: () => ({ mutateAsync: mocks.save, isPending:false }),
  useCompleteAssessment: () => ({ mutateAsync: mocks.complete, isPending:false }),
}))

function renderPage() { return render(<MemoryRouter initialEntries={['/paciente/cuestionarios/assessment-1']}><Routes><Route path="/paciente/cuestionarios/:assessmentId" element={<PatientAssessmentPage/>}/></Routes></MemoryRouter>) }

describe('respuesta domiciliaria del DHI', () => {
  afterEach(cleanup)
  beforeEach(() => {
    mocks.record = { id:'assessment-1',patientId:'patient-1',patientName:'Paciente',treatmentCycleId:'cycle-1',instrumentCode:'DHI_AR_25',instrumentVersion:1,phase:'initial',deliveryMode:'portal',status:'assigned',dueDate:'2026-08-31',responses:emptyAssessmentResponses(),totalScore:null,subscaleScores:{physical:0,emotional:0,functional:0},answeredCount:0,assignedAt:'2026-08-27T12:00:00.000Z',startedAt:'',completedAt:'',assessmentDate:'',createdAt:'2026-08-27T12:00:00.000Z' }
    mocks.save.mockReset().mockResolvedValue({})
    mocks.complete.mockReset().mockResolvedValue({})
  })

  it('muestra 25 preguntas y permite guardar un borrador desde el portal', async () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /Dizziness Handicap Inventory/i })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(75)
    expect(screen.queryByText(/4 puntos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/2 puntos/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('radio')[1])
    fireEvent.click(screen.getByRole('button', { name: /guardar avance/i }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ id:'assessment-1', responses:expect.objectContaining({ P1:2 }) })))
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('no vuelve a exponer respuestas ni puntaje cuando el paciente ya lo envió', () => {
    mocks.record = { ...mocks.record, status:'completed', totalScore:0, answeredCount:25, completedAt:'2026-08-27T13:00:00.000Z', assessmentDate:'2026-08-27' }
    renderPage()
    expect(screen.getByRole('heading', { name: 'Cuestionario enviado' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByText('/100')).not.toBeInTheDocument()
  })
})
