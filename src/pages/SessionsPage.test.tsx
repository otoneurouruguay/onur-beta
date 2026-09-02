import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultExerciseConfig } from '../features/exercise/types'
import { SessionsPage } from './SessionsPage'

vi.mock('../features/sessions/hooks', () => ({
  useProfessionalAssignments: () => ({
    isPending: false,
    data: [{
      id: 'session-old', patientId: 'patient-old', patientName: 'Paciente Histórica',
      treatmentCycleId: 'cycle-old', sessionPlanId: 'plan-old', title: 'Sesión antigua', instructions: '',
      mode: 'home', exercises: [defaultExerciseConfig], availableFrom: '2026-05-10T12:00:00.000Z',
      availableUntil: '', status: 'completed', createdAt: '2026-05-09T12:00:00.000Z', activeSeconds: 60,
      completedAt: '2026-05-10T12:01:00.000Z', initialDiscomfort: 2, finalDiscomfort: 1,
      perceivedDifficulty: 2, patientComment: 'Bien',
    }],
  }),
}))

afterEach(cleanup)

describe('listado global de sesiones', () => {
  it('abre directamente el historial seleccionado', () => {
    render(<MemoryRouter><SessionsPage/></MemoryRouter>)
    expect(screen.getByRole('link', { name: /paciente histórica.*sesión antigua/i })).toHaveAttribute('href', '/app/pacientes/patient-old/sesiones/session-old')
    expect(screen.getByText(/abrí cualquier fila/i)).toBeInTheDocument()
  })
})
