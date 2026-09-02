import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RevokeSessionDialog } from './RevokeSessionDialog'

afterEach(cleanup)

describe('diálogo de anulación de sesión', () => {
  it('exige motivo y entrega una razón normalizada', () => {
    const confirm = vi.fn()
    render(<RevokeSessionDialog sessionTitle="Sesión de prueba" onCancel={vi.fn()} onConfirm={confirm}/>)
    const submit = screen.getByRole('button', { name: 'Anular y conservar registro' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo obligatorio'), { target: { value: '  Error en la selección de un ejercicio  ' } })
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)
    expect(confirm).toHaveBeenCalledWith('Error en la selección de un ejercicio')
  })

  it('ofrece motivos frecuentes y explica que el registro permanece', () => {
    render(<RevokeSessionDialog sessionTitle="Sesión antigua" onCancel={vi.fn()} onConfirm={vi.fn()}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Era una sesión de prueba' }))
    expect(screen.getByLabelText('Motivo obligatorio')).toHaveValue('Era una sesión de prueba')
    expect(screen.getByText(/quedará visible en gris/i)).toBeInTheDocument()
  })
})
