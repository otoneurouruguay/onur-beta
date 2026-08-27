import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PatientDetailsCard } from './PatientDetailsCard'
import type { PatientRecord } from './repository'

const patient: PatientRecord = {
  id: 'patient-1', fullName: 'Valentina Mendez', initials: 'VM', age: 33, insurer: 'SUMMUM', status: 'active', cycleLabel: 'Ciclo 1 · Activo', todaySession: null, lastActivity: '', portalAccess: 'enabled',
  documentNumber: '4475592', birthDate: '1992-11-25', affiliateNumber: 'M23152512', phone: '094520391', privateNotes: 'Síndrome Vestibular Agudo.', username: 'valentina',
}

describe('ficha visible del paciente', () => {
  it('muestra todos los datos sin abrir la edición', () => {
    render(<MemoryRouter><PatientDetailsCard patient={patient} activeCycle={{ id: 'cycle-1', patientId: patient.id, label: 'Ciclo 1', reason: '', objectives: '', startedOn: '2026-08-18', endedOn: '', status: 'active' }} activePermissions={2}/></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Datos del paciente' })).toBeInTheDocument()
    expect(screen.getByText('4475592')).toBeInTheDocument()
    expect(screen.getByText('25/11/1992')).toBeInTheDocument()
    expect(screen.getByText('M23152512')).toBeInTheDocument()
    expect(screen.getByText('094520391')).toBeInTheDocument()
    expect(screen.getByText('Síndrome Vestibular Agudo.')).toBeInTheDocument()
    expect(screen.getByText('Ciclo 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar datos' })).toHaveAttribute('href', '/app/pacientes/patient-1/editar')
  })
})
