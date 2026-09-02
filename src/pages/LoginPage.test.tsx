import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../features/auth/AuthProvider'

afterEach(cleanup)

describe('LoginPage', () => {
  it('presenta ambos tipos de acceso y bloquea el ingreso si falta autenticación', () => {
    render(
      <MemoryRouter>
        <AuthProvider><LoginPage /></AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Profesional/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Paciente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acceso no disponible' })).toBeDisabled()
    expect(screen.getByText(/acceso permanece bloqueado/i)).toBeInTheDocument()
  })

  it('limpia las credenciales al cambiar el tipo de acceso', () => {
    render(
      <MemoryRouter>
        <AuthProvider><LoginPage /></AuthProvider>
      </MemoryRouter>,
    )

    const identifier = screen.getByLabelText('Correo profesional')
    const password = screen.getByLabelText('Contraseña')
    fireEvent.change(identifier, { target: { value: 'profesional@ejemplo.com' } })
    fireEvent.change(password, { target: { value: 'secreto' } })
    fireEvent.click(screen.getByRole('button', { name: /Paciente/i }))

    expect(screen.getByLabelText('Usuario')).toHaveValue('')
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('placeholder', 'Nombre de usuario')
    expect(screen.getByLabelText('PIN o cédula temporal')).toHaveValue('')
  })
})
