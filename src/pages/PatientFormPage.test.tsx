import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PatientFormPage } from './PatientFormPage'

const mocks = vi.hoisted(() => ({
  patient: {
    id: 'patient-1',
    fullName: 'Rodrigo Machin',
    documentNumber: '12345678',
    birthDate: '1988-01-01',
    insurer: 'Particular',
    affiliateNumber: '',
    phone: '',
    status: 'active' as const,
    privateNotes: '',
    username: '',
    portalAccess: 'disabled' as const,
  },
}))

vi.mock('../features/access/hooks', () => ({
  usePortalAccount: () => ({ data: null, isPending: false }),
}))

vi.mock('../features/patients/hooks', () => ({
  usePatient: () => ({ data: mocks.patient }),
  useCreatePatient: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdatePatient: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

describe('edición del paciente', () => {
  it('permite guardar la CI y habilitar el acceso domiciliario después del alta', () => {
    render(
      <MemoryRouter initialEntries={['/app/pacientes/patient-1/editar']}>
        <Routes>
          <Route path="/app/pacientes/:patientId/editar" element={<PatientFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText(/cédula de identidad/i)).toHaveValue('12345678')

    fireEvent.click(screen.getByRole('checkbox', { name: /habilitar acceso domiciliario/i }))

    expect(screen.getByLabelText(/usuario/i)).toHaveValue('rodrigomachin')
    expect(screen.getByLabelText(/cédula como clave temporal/i)).toHaveValue('12345678')
  })
})
