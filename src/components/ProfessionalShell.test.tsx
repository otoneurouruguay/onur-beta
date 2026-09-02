import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfessionalShell } from './ProfessionalShell'

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({ displayName: 'Profesional ONUr', signOut: vi.fn() }),
}))

vi.mock('../features/studies/hooks', () => ({
  useStatisticalSuggestions: () => ({ data: [{ status: 'pending' }, { status: 'pending' }] }),
}))

vi.mock('./GlobalSearch', () => ({ GlobalSearch: () => null }))

afterEach(cleanup)

function renderShell(pathname = '/app/pacientes/patient-1') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/app" element={<ProfessionalShell />}>
          <Route path="*" element={<div>Página actual</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProfessionalShell navigation', () => {
  it('mantiene ocultos los submenús hasta desplegar el grupo', () => {
    renderShell()

    expect(screen.queryByRole('link', { name: 'Escenarios 360°' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sugerencias' })).not.toBeInTheDocument()

    const exercises = screen.getByRole('button', { name: 'Ejercicios' })
    fireEvent.click(exercises)
    expect(exercises).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Crear ejercicio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Escenarios 360°' })).toBeInTheDocument()

    fireEvent.click(exercises)
    expect(exercises).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Escenarios 360°' })).not.toBeInTheDocument()
  })

  it('despliega automáticamente el grupo de la página actual', () => {
    renderShell('/app/escenarios-360')

    expect(screen.getByRole('button', { name: 'Ejercicios' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Escenarios 360°' })).toBeInTheDocument()
  })

  it('muestra en Estudios el contador solo cuando hay revisiones pendientes', () => {
    renderShell()

    expect(screen.getByLabelText('2 revisiones pendientes')).toBeInTheDocument()
  })
})
