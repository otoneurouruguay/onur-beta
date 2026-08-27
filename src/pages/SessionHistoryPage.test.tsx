import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultExerciseConfig } from '../features/exercise/types'
import { SessionHistoryPage } from './SessionHistoryPage'

const mocks = vi.hoisted(() => ({ legacy: false }))

vi.mock('../features/patients/hooks', () => ({
  usePatient: () => ({ data: { id: 'patient-history', fullName: 'Paciente Histórica' }, isPending: false }),
}))

vi.mock('../features/sessions/hooks', () => ({
  useTreatmentCycles: () => ({ data: [{ id: 'cycle-history', label: 'Ciclo anterior', status: 'completed' }] }),
  useSessionAssignments: () => ({
    isPending: false,
    error: null,
    data: [{
      id: 'session-history', patientId: 'patient-history', patientName: 'Paciente Histórica',
      treatmentCycleId: 'cycle-history', sessionPlanId: 'plan-history', title: 'Sesión vestibular antigua',
      instructions: 'Realizar en un ambiente despejado.', kind: 'exercise', mode: 'home',
      exercises: [{ ...defaultExerciseConfig, name: 'RVO x1 histórico', durationSeconds: 60, rounds: 2 }],
      availableFrom: '2026-06-10T12:00:00.000Z', availableUntil: '', status: 'completed',
      createdAt: '2026-06-09T12:00:00.000Z', activeSeconds: 125, completedAt: '2026-06-10T12:03:00.000Z',
      initialDiscomfort: 3, peakDiscomfort: 4, finalDiscomfort: 2, recoveryMinutes: 5,
      perceivedDifficulty: 2, patientComment: 'Me resultó más fácil que la vez anterior.',
      professionalObservation: 'Mantener velocidad.',
      eventLog: mocks.legacy ? [] : [
        { type: 'exercise_completed', at: '2026-06-10T12:01:00.000Z', exercise_index: 0, round: 1, active_seconds: 60 },
        { type: 'exercise_completed', at: '2026-06-10T12:02:00.000Z', exercise_index: 0, round: 2, active_seconds: 60 },
      ],
    }],
  }),
}))

function renderPage() {
  return render(<MemoryRouter initialEntries={['/app/pacientes/patient-history/sesiones/session-history']}><Routes><Route path="/app/pacientes/:patientId/sesiones/:assignmentId" element={<SessionHistoryPage/>}/></Routes></MemoryRouter>)
}

describe('consulta profesional de una sesión histórica', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.legacy = false })

  it('muestra ejercicios, resultado individual, métricas y comentarios sin editar el historial', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Sesión vestibular antigua' })).toBeInTheDocument()
    expect(screen.getByText('Historial clínico de solo lectura')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'RVO x1 histórico' })).toBeInTheDocument()
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('2 min 5 s activos')).toBeInTheDocument()
    expect(screen.getByText('Me resultó más fácil que la vez anterior.')).toBeInTheDocument()
    expect(screen.getByText('Mantener velocidad.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver al perfil/i })).toHaveAttribute('href', '/app/pacientes/patient-history')
  })

  it('explica honestamente cuando un registro antiguo no tiene eventos por ejercicio', () => {
    mocks.legacy = true
    renderPage()

    expect(screen.getByText('Sin detalle individual')).toBeInTheDocument()
    expect(screen.getByText(/el registro histórico no contiene un resultado individual/i)).toBeInTheDocument()
    expect(screen.getByText('Me resultó más fácil que la vez anterior.')).toBeInTheDocument()
  })
})
