import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('traduce el estado técnico a una etiqueta clara', () => {
    render(<StatusBadge status="quarantine" />)
    expect(screen.getByText('Cuarentena')).toBeInTheDocument()
  })

  it('muestra en español el estado de una sesión iniciada', () => {
    render(<StatusBadge status="started" />)
    expect(screen.getByText('Iniciada')).toBeInTheDocument()
  })
})
