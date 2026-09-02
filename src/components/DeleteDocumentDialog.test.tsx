import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeleteDocumentDialog } from './DeleteDocumentDialog'

describe('DeleteDocumentDialog', () => {
  it('explica el alcance y exige una confirmación explícita', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteDocumentDialog
        documentLabel="Informe clínico"
        filename="informe.pdf"
        removesStudyData
        isPending={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Eliminar informe clínico' })).toHaveTextContent('También se borrarán los valores y la revisión')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
