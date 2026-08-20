import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('traduce el estado técnico a una etiqueta clara', () => {
    render(<StatusBadge status="quarantine" />)
    expect(screen.getByText('Cuarentena')).toBeInTheDocument()
  })

  it('muestra como en curso una sesión iniciada', () => {
    render(<StatusBadge status="started" />)
    expect(screen.getByText('En curso')).toBeInTheDocument()
  })
})
