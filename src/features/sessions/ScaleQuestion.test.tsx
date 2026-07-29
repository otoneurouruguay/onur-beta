import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScaleQuestion } from './ScaleQuestion'

describe('ScaleQuestion', () => {
  it('mantiene el título dentro de la tarjeta y conserva el nombre accesible del grupo', () => {
    const { container } = render(
      <ScaleQuestion
        label="Malestar antes de comenzar"
        hint="0 significa ningún malestar."
        min={0}
        max={10}
        value={null}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: 'Malestar antes de comenzar' })).toBeInTheDocument()
    expect(container.querySelector('legend')).not.toBeInTheDocument()
  })
})
