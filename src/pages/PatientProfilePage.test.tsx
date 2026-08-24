import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { ClinicalStudySummary } from '../features/studies/types'
import { VestibularStudySlot } from './PatientProfilePage'

afterEach(cleanup)

const loadedStudy: ClinicalStudySummary = {
  id: 'vestibular-loaded', patientId: 'patient-1', patientName: 'Paciente', treatmentCycleId: 'cycle-1',
  sourceFilename: 'vhit-cargado.pdf', studyType: 'vhit', cyclePhase: 'unspecified',
  performedAt: '2026-08-20T12:00:00.000Z', deviceName: '', protocolCode: 'vhit', protocolVersion: '1',
  status: 'reviewed', interpretable: true, metricCount: 4, issueCount: 0,
}

describe('acceso a estudios vestibulares desde el perfil', () => {
  it('abre el estudio existente en vez de mostrar la carga vacía', () => {
    render(<MemoryRouter><VestibularStudySlot studies={[loadedStudy]} patientId="patient-1" cycleId="cycle-1"/></MemoryRouter>)

    const link = screen.getByRole('link', { name: /informe vestibular.*cargado/i })
    expect(link).toHaveAttribute('href', '/app/estudios/vestibular-loaded/revisar')
    expect(screen.getByText(/vhit-cargado\.pdf/i)).toBeInTheDocument()
    expect(screen.getByText('Ver estudio cargado →')).toBeInTheDocument()
    expect(screen.queryByText('Cargar y extraer localmente →')).not.toBeInTheDocument()
  })

  it('mantiene el acceso al cargador cuando todavía no hay estudios', () => {
    render(<MemoryRouter><VestibularStudySlot studies={[]} patientId="patient-1" cycleId="cycle-1"/></MemoryRouter>)

    expect(screen.getByRole('link', { name: /estudios vestibulares/i })).toHaveAttribute('href', '/app/estudios/importar?patient=patient-1&kind=vestibular&cycle=cycle-1')
    expect(screen.getByText('Cargar y extraer localmente →')).toBeInTheDocument()
  })
})
