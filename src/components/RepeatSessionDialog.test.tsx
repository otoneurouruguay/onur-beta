import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepeatSessionDialog } from './RepeatSessionDialog'

afterEach(cleanup)

describe('diálogo para repetir sesiones', () => {
  it('crea una serie de días consecutivos con una sola confirmación', () => {
    const onConfirm = vi.fn()
    render(<RepeatSessionDialog sessionTitle="Sesión vestibular" today="2026-08-26" onCancel={vi.fn()} onConfirm={onConfirm}/>)

    fireEvent.click(screen.getByRole('button', { name: 'Días consecutivos' }))
    fireEvent.change(screen.getByLabelText('Cantidad de días'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear 3 sesiones' }))

    expect(onConfirm).toHaveBeenCalledWith({
      dates: ['2026-08-27', '2026-08-28', '2026-08-29'],
      seriesId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    })
  })

  it('permite elegir fechas no consecutivas y evita repetir una fecha', () => {
    render(<RepeatSessionDialog sessionTitle="Sesión vestibular" today="2026-08-26" onCancel={vi.fn()} onConfirm={vi.fn()}/>)

    fireEvent.click(screen.getByRole('button', { name: 'Fechas específicas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    fireEvent.change(screen.getByLabelText('Fecha específica'), { target: { value: '2026-08-27' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Esa fecha ya está incluida')
    expect(screen.getByRole('button', { name: 'Crear 1 sesión' })).toBeEnabled()
  })
})
